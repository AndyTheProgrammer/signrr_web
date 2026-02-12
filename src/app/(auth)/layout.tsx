"use client";

import Link from "next/link";
import { FileSignature } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple auth navbar */}
      <nav className="bg-white border-b border-gray-100">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center space-x-2">
            <FileSignature className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold tracking-tight">SignrR</span>
          </Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
