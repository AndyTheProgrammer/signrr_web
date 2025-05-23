"use client";

import TopBar from "../components/topBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <TopBar
        buttonTitle="Sign-up"
        onClick={() => console.log("Back clicked")}
      />
      <main className="flex w-full min-h-screen px-20 py-10">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
