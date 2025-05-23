import React from "react";

interface ButtonProps {
  buttonTitle: string;
  onClick: () => void;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ className = "", ...props }) => {
  const { onClick, buttonTitle } = props;
  return (
    <div>
      <button
        onClick={onClick}
        className={`px-5 py-2 cursor-pointer rounded-lg transition-colors duration-200 ease-in-out ${className}`}
      >
        {buttonTitle}
      </button>
    </div>
  );
};

export default Button;
