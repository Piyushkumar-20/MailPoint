import "@/styles/globals.css";

import { type Metadata } from "next";
import { Manrope, Montserrat } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";
import { PWAInstallPrompt } from "@/app/pwa-install-prompt";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope-next",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat-next",
});

export const metadata: Metadata = {
  title: "MailPoint",
  description: "Gmail and Calendar powered by MailPoint",
  icons: [
    { rel: "icon", url: "/mailpoint-icon.png?v=2" },
    { rel: "shortcut icon", url: "/favicon.ico?v=2" },
    { rel: "apple-touch-icon", url: "/icons/mailpoint-192.png" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MailPoint",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(manrope.variable, montserrat.variable)}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            {children}
            <PWAInstallPrompt />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}