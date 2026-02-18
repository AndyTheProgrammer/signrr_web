"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (response.ok) {
        router.push("/sign-in");
        router.refresh();
      }
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/dashboard/home">
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

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
