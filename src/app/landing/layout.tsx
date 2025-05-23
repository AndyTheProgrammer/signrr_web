"use client";

import TopBar from "../components/topBar";
import { LANDING_PAGE_LINKS } from "../lib/routes";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {



  return (
    <div>
      <TopBar
        type="App"
        links={LANDING_PAGE_LINKS}
        buttonTitle="Sign-up"
        onClick={() => console.log("Back clicked")}
      />
      <main className="flex w-full min-h-screen px-30 py-10">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
