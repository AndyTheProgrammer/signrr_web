"use client";

import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple auth navbar */}
      <nav className="bg-white border-b border-gray-100">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/">
            <div className="overflow-hidden h-12">
              <Image
                src="/signrR_Logo_3-1.png"
                alt="SignrR"
                width={150}
                height={150}
                className="h-[150px] w-auto -mt-[58px]"
              />
            </div>
          </Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
