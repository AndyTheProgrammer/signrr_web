import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export type InputType = "input" | "checkbox" | "dropdown";

interface InputProps {
  id: string;
  label: string;
  placeholder: string;
  onChange?: () => void;
  type: InputType;
}

const Inputfield = (props: InputProps) => {
  const { id, label, placeholder, onChange, type } = props;
  return (
    <div className="space-y-2">
      {type === "input" ? (
        <>
          <Label htmlFor={id}>{label}</Label>
          <Input
            className="py-5 bg-slate-100 rounded-lg"
            id={id}
            placeholder={placeholder}
            onChange={onChange}
          />
        </>
      ) : type === "checkbox" ? (
        <div className="flex items-center space-x-2">
          <Checkbox id={id} />
          <Label htmlFor={id}>{label}</Label>
        </div>
      ) : null}
    </div>
  );
};

export default Inputfield;
