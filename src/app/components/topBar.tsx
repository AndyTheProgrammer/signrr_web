// import React from 'react'
'use client';

interface Props {
  buttonTitle: string;
  onClick: () => void;
}

const TopBar = (props: Props) => {
  const { buttonTitle, onClick } = props;
  return (
    <nav className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        <div>
          <h1>Logo</h1>
        </div>
        {/* Now Sign add button at the other end. */}
        <div>
          <button
            onClick={onClick}
            className="bg-black px-5 py-2 rounded-lg text-white cursor-pointer"
          >
            {buttonTitle}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopBar;
