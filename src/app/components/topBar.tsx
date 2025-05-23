// import React from 'react'
"use client";

import Link from "next/link";
import { Links } from "../types/resources";

type TopBarType = "Auth" | "App";

interface Props {
  buttonTitle: string;
  onClick: () => void;
  type: TopBarType;
  links: Links[];
}

const TopBar = (props: Props) => {
  const { buttonTitle, onClick, type, links } = props;
  return (
    <nav className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        <div>
          <h1>Logo</h1>
        </div>
        {/* Now Sign add button at the other end. */}

        {type === "Auth" ? (
          <div>
            <button
              onClick={onClick}
              className="bg-black px-5 py-2 rounded-lg text-white cursor-pointer"
            >
              {buttonTitle}
            </button>
          </div>
        ) : (
          <div className="flex gap-10">
            {typeof links !== "undefined" &&
              links.map((item, index) => {
                return (
                  <div className="flex items-center">
                    <Link href={item.href}>{item.title}</Link>
                  </div>
                );
              })}
            <button
              onClick={onClick}
              className="bg-black px-5 py-2 rounded-lg text-white cursor-pointer"
            >
              {buttonTitle}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default TopBar;
