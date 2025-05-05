import Inputfield, { InputType } from "@/app/components/form/inputfield";
import TopBar from "@/app/components/topBar";
import { SIGN_IN_FIELDS } from "@/app/lib/formFields";
import React from "react";

const SignInPage = () => {
  return (
    <div className="flex flex-col py-10 pl-10 items-center">
      <div>
        <h1 className="text-4xl font-bold">Welcome Back To Signrr</h1>
        <p className="text-lg py-5">Sign in to your account</p>

        {/* Input fields */}
        <div className="flex flex-col gap-10 py-5">
          {SIGN_IN_FIELDS.map((item, index) => {
            const { id, label, placeholder, type } = item;
            return (
              <React.Fragment key={index}>
                <Inputfield id={id} label={label} placeholder={placeholder} type={type as InputType } />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
