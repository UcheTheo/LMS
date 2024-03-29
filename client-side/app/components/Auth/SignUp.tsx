import React, { FC, useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  AiOutlineEye,
  AiOutlineEyeInvisible,
  AiFillGithub,
} from "react-icons/ai";
import { FcGoogle } from "react-icons/fc";
import { styles } from "../../../app/styles/style";
import { useRegisterMutation } from "../../../redux/features/auth/authApi";
import toast from "react-hot-toast";

type Props = {
  setRoute: (route: string) => void;
};

const schema = Yup.object().shape({
  name: Yup.string().required("Please enter your name"),
  email: Yup.string()
    .email("Invalid email!")
    .required("Please enter your email!"),
  password: Yup.string().required("Please enter your password!").min(6),
  passwordConfirm: Yup.string()
    .required("Please confirm Your password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
});

const SignUp: FC<Props> = ({ setRoute }) => {
  const [show, setShow] = useState(false);
  const [register, { data, error, isSuccess }] = useRegisterMutation();

  useEffect(() => {
    if (isSuccess) {
      const message = data?.message || "Registration successful";
      toast.success(message);
      setRoute("Verification");
    }
    if (error) {
      if ("data" in error) {
        const errorData = error as any;
        toast.error(errorData.data.message);
      }
    }
  }, [isSuccess, error]);

  const formik = useFormik({
    initialValues: { name: "", email: "", password: "", passwordConfirm: "" },
    validationSchema: schema,
    onSubmit: async ({ name, email, password, passwordConfirm }) => {
      const data = {
        name,
        email,
        password,
        passwordConfirm,
      };
      await register(data);
    },
  });

  const { errors, touched, values, handleChange, handleSubmit } = formik;

  return (
    <div className="w-full">
      <h1 className={`${styles.title}`}>Join to Elearning</h1>
      <form onSubmit={handleSubmit}>
        <div className="mt-3">
          <label className={`${styles.label}`} htmlFor="name">
            Enter your Name
          </label>
          <input
            type="text"
            name=""
            value={values.name}
            onChange={handleChange}
            id="name"
            placeholder="Johndoe"
            className={`${errors.name && touched.name && "border-red-500"}
            ${styles.input}`}
          />
        </div>
        {errors.name && touched.name && (
          <span className="text-red-500 pt-2 block">{errors.name}</span>
        )}

        <div className="mt-3">
          <label className={`${styles.label}`} htmlFor="email">
            Enter your Email
          </label>
          <input
            type="email"
            name=""
            value={values.email}
            onChange={handleChange}
            id="email"
            placeholder="loginmail@gmail.com"
            className={`${errors.email && touched.email && "border-red-500"}
            ${styles.input}`}
          />
        </div>
        {errors.email && touched.email && (
          <span className="text-red-500 pt-2 block">{errors.email}</span>
        )}

        <div className="w-full mt-5 relative mb-1">
          <label className={`${styles.label}`} htmlFor="password">
            Enter your Password
          </label>
          <input
            type={!show ? "password" : "text"}
            name="password"
            value={values.password}
            onChange={handleChange}
            id="password"
            placeholder="password!@%"
            className={`${
              errors.password && touched.password && "border-red-500"
            }
            ${styles.input}`}
          />
          {!show ? (
            <AiOutlineEyeInvisible
              className="absolute bottom-3 dark:fill-white right-2 z-1 cursor-pointer"
              size={20}
              onClick={() => setShow(true)}
            />
          ) : (
            <AiOutlineEye
              className="absolute bottom-3 dark:fill-white right-2 z-1 cursor-pointer"
              size={20}
              onClick={() => setShow(false)}
            />
          )}
        </div>
        {errors.password && touched.password && (
          <span className="text-red-500 pt-2 block">{errors.password}</span>
        )}

        {/* confirm password */}
        <div className="w-full mt-5 relative mb-1">
          <label className={`${styles.label}`} htmlFor="password">
            Confirm Your Password
          </label>
          <input
            type={!show ? "password" : "text"}
            name="passwordConfirm"
            value={values.passwordConfirm}
            onChange={handleChange}
            id="passwordConfirm"
            placeholder="password!@%"
            className={`${
              errors.passwordConfirm &&
              touched.passwordConfirm &&
              "border-red-500"
            }
            ${styles.input}`}
          />
          {!show ? (
            <AiOutlineEyeInvisible
              className="absolute bottom-3 dark:fill-white right-2 z-1 cursor-pointer"
              size={20}
              onClick={() => setShow(true)}
            />
          ) : (
            <AiOutlineEye
              className="absolute bottom-3 dark:fill-white right-2 z-1 cursor-pointer"
              size={20}
              onClick={() => setShow(false)}
            />
          )}
        </div>
        {errors.passwordConfirm && touched.passwordConfirm && (
          <span className="text-red-500 pt-2 block">
            {errors.passwordConfirm}
          </span>
        )}

        {/* submit button */}
        <div className="w-full mt-5">
          <input type="submit" value="SignUp" className={`${styles.button}`} />
        </div>
        <br />
        <h5 className="text-center pt-4 font-Poppins text-[14px] text-black dark:text-white">
          or join with
        </h5>
        <div className="flex items-center justify-center my-3">
          <FcGoogle size={30} className="cursor-pointer mr-2" />
          <AiFillGithub
            size={30}
            className="cursor-pointer ml-2 dark:fill-white"
          />
        </div>
        <h5 className="dark:text-white text-center pt-4 font-Poppins text-[14px]">
          Already have an account?{" "}
          <span
            className="text-[#2190ff] pl-1 cursor-pointer"
            onClick={() => setRoute("Login")}
          >
            Sign In
          </span>
        </h5>
        <br />
      </form>
    </div>
  );
};

export default SignUp;
