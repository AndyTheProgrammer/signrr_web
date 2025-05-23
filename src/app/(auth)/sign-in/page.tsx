"use client";

import Button from "@/app/components/button";
import Inputfield, { InputType } from "@/app/components/form/inputfield";
import TopBar from "@/app/components/topBar";
import { SIGN_IN_FIELDS } from "@/app/lib/formFields";
import React from "react";

const SignInPage = () => {
  return (
    <div className="flex flex-col py-10 items-center">
      <div>
        <h1 className="text-4xl font-bold">Welcome Back To Signrr</h1>
        <p className="text-lg py-5">Sign in to your account</p>

        {/* Input fields */}
        <div className="flex flex-col gap-10 py-5">
          {SIGN_IN_FIELDS.map((item, index) => {
            const { id, label, placeholder, type } = item;

            if (type === "checkbox" && label === "Remember me") {
              // Special layout for "Remember me" checkbox and "Forgot password" link
              return (
                <div
                  key={index}
                  className="flex items-center justify-between w-full"
                >
                  <Inputfield
                    id={id}
                    label={label} // This will be "Remember me"
                    placeholder={placeholder}
                    type={type as InputType}
                    // You might add a className here if Inputfield needs width adjustment
                    // e.g., className="flex-shrink-0" or className="mr-auto"
                  />
                  <a
                    href="#"
                    className="text-sm hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </a>
                </div>
              );
            } else {
              // Default layout for other input fields
              return (
                <Inputfield
                  key={index}
                  id={id}
                  label={label}
                  placeholder={placeholder}
                  type={type as InputType}
                />
              );
            }
          })}
        </div>

        <div>
          <Button
            onClick={() => console.log("button clicked")}
            buttonTitle="Sign in"
            className="w-full bg-black text-white hover:scale-105"
          />
        </div>

        {/* Now add the Button */}

        <div className="flex flex-col py-20 gap-5">
          <div className="flex items-center justify-center">
            <h1>Dont have an account?</h1>
          </div>
          <div>
            <Button
              onClick={() => console.log("button clicked")}
              buttonTitle="Sign up"
              className="w-full border-1 text-black hover:bg-gray-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
