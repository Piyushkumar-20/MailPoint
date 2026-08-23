import "@/styles/globals.css";

import { type Metadata } from "next";
import { Inter, Oxanium, Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { cn } from "@/lib/utils";

const geistHeading = Geist({subsets:['latin'],variable:'--font-heading'});

const oxanium = Oxanium({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "MailPoint",
  description: "Gmail and Calendar powered by Corsair",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", oxanium.variable, geistHeading.variable)}>
      <body className={oxanium.variable}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}