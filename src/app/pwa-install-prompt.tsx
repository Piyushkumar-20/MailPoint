"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalledState = () => {
      setIsInstalled(
        standaloneQuery.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    };

    updateInstalledState();
    standaloneQuery.addEventListener("change", updateInstalledState);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    // Register the service worker for installability and an offline fallback.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("MailPoint service worker registration failed:", error);
      });
    }

    return () => {
      standaloneQuery.removeEventListener("change", updateInstalledState);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  if (isInstalled || !installPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        type="button"
        onClick={handleInstall}
        className="shadow-lg"
        aria-label="Install MailPoint as an app"
      >
        Install MailPoint
      </Button>
    </div>
  );
}
