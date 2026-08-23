"use client";

import { authClient } from "@/lib/auth-client";

export function GoogleLoginButton() {
  const handleGoogleLogin = async () => {
    await authClient.signIn.social({
      provider: "google",
    });
  };

  return (
    <button type="button" onClick={handleGoogleLogin}>
      Continue with Google
    </button>
  );
}