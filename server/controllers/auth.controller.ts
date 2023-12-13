import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import User from "../models/user.model";
import AppError from "../errorsHandlers/appError";
import catchAsync from "../utils/catchAsync";
import Email from "../emails/email";
import {
  IActivationRequest,
  ILoginRequest,
  IRegistrationBody,
  IUpdatePassword,
  IUpdateUserInfo,
} from "../DTOs/UserDtos";
import { IActivationToken } from "../DTOs/UserDtos";
import IUser from "../models/Interfaces/userInterface";
import {
  SignInAccessToken,
  SignInRefreshToken,
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/sendToken";
import { redis } from "../dataAccess/redis";

// Create activation token and the token
export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    { user, activationCode },
    process.env.JWT_SECRET as Secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN as string,
    }
  );

  return { token, activationCode };
};

// Verify Account before saving it.
export const verifyAccount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, passwordConfirm } = req.body;

    const checkEmail = await User.findOne({ email });
    if (checkEmail) return next(new AppError("Email Already exists", 400));

    const user: IRegistrationBody = {
      name,
      email,
      password,
      passwordConfirm,
    };

    const { token, activationCode } = createActivationToken(user);
    // const activationCode = activationToken.activationCode;

    const data = {
      user: { name: user.name },
      activationCode,
    };

    await new Email(user, data).activateRegistration();

    res.status(201).json({
      success: true,
      message: `Please check your email: ${user.email} to activate your account!`,
      token,
    });
  }
);

// Sign Up the user - persist user data to database
export const signUp = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Getting token and check of it's there
    let activation_token: string;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      activation_token = req.headers.authorization.split(" ")[1];
    }

    const { activation_code } = req.body as IActivationRequest;

    const newUser: { user: IUser; activationCode: string } = jwt.verify(
      activation_token,
      process.env.JWT_SECRET as string
    ) as { user: IUser; activationCode: string };

    if (newUser.activationCode != activation_code)
      return next(new AppError("Invalid token. Please try again", 401));

    const { name, email, password, passwordConfirm } = newUser.user;

    const user = await User.create({
      name,
      email,
      password,
      passwordConfirm,
    });

    sendToken(user, 201, res);
  }
);

//Log user in and send token
export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as ILoginRequest;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError("Please provide email and password!", 400));
    }
    // 2) Check if user exists && password is correct
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError("Incorrect email or password", 401));
    }

    // 3) If everything ok, send token to client
    sendToken(user, 200, res);
  }
);

//logout User
export const logout = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });

      const userId = req.user?._id || "";
      redis.del(userId);

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (err) {
      return next(new AppError(err.message, 400));
    }
  }
);

// update access token
export const refreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const refresh_token = req.cookies.refresh_token as string;

    const decoded = jwt.verify(
      refresh_token,
      process.env.REFRESH_TOKEN as string
    ) as JwtPayload;

    const message = "Could not refresh token";
    if (!decoded) return next(new AppError(message, 400));

    const session = await redis.get(decoded.id as string);
    if (!session)
      return next(new AppError("Please login to access these resources!", 400));

    const user = JSON.parse(session);
    const currentUser = await User.findById(decoded.id);

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError(
          "User recently changed password! Please log in again.",
          401
        )
      );
    }

    const accessToken = SignInAccessToken(user._id, "5m");
    const refreshToken = SignInRefreshToken(user._id, "3d");

    req.user = user;

    res.cookie("access_token", accessToken, accessTokenOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenOptions);

    await redis.set(user._id, JSON.stringify(user), "EX", 604800); //7days

    res.status(200).json({
      status: "success",
      accessToken,
    });
  }
);

// Update user info
export const updateUserInfo = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email } = req.body as IUpdateUserInfo;
    const userId = req.user?._id;
    const user = await User.findById(userId);

    if (email && user) {
      const emailExist = await User.findOne({ email });
      if (emailExist) return next(new AppError("Email Already exists", 400));

      user.email = email;
    }

    if (name && user) user.name = name;

    await user?.save({ validateBeforeSave: false });

    await redis.set(userId, JSON.stringify(user));

    res.status(200).json({
      status: "success",
      user,
    });
  }
);

// update password
export const updatePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword, confirmPassword } =
      req.body as IUpdatePassword;

    if (!oldPassword || !newPassword)
      return next(
        new AppError("Please provide your old and new passwords", 400)
      );

    if (!confirmPassword)
      return next(new AppError("Please confirm your password", 400));

    // 1) Get user from collection
    const user = await User.findById(req.user._id).select("+password");

    if (user?.password === "undefined") {
      return next(new AppError("Invalid user", 400));
    }
    // 2) Check if POSTed current password is correct
    if (!(await user.correctPassword(oldPassword, user.password))) {
      return next(new AppError("Your current password is wrong.", 401));
    }

    // 3) If so, update password
    user.password = newPassword;
    user.passwordConfirm = confirmPassword;
    await user.save();
    // User.findByIdAndUpdate will NOT work as intended!

    await redis.set(req.user?._id, JSON.stringify(user));

    res.status(200).json({
      success: true,
      user,
    });
  }
);
