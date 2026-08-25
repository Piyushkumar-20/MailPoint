import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Oxanium } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

const geistHeading = Geist({
  subsets: ["latin"],
  variable: "--font-heading",
});

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MailPoint",
  description: "Gmail and Calendar powered by MailPoint",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
      className={cn(
        oxanium.variable,
        geistHeading.variable,
      )}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}