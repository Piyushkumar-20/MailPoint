"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CalendarPanel } from "@/app/_components/calendar-panel";
import { GmailPanel } from "@/app/_components/gmail-panel";
import { authClient } from "@/lib/auth-client";

export function MailPointApp() {
  const router = useRouter();

  const [tab, setTab] = useState<"gmail" | "calendar">("gmail");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);

      await authClient.signOut();

      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main>
      <h1>MailPoint</h1>

      <p className="muted">
        Gmail and Calendar powered by Corsair
      </p>

      <p>
        {tab === "gmail" ? (
          <>
            <strong>Email</strong>
            {" · "}
            <button
              type="button"
              className="link"
              onClick={() => setTab("calendar")}
            >
              Calendar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="link"
              onClick={() => setTab("gmail")}
            >
              Email
            </button>
            {" · "}
            <strong>Calendar</strong>
          </>
        )}
      </p>

      <hr />

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>

      <hr />

      {tab === "gmail" ? <GmailPanel /> : <CalendarPanel />}
    </main>
  );
}