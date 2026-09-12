import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StormReady",
  description:
    "Your home. Your risk. Your plan. Anonymous household preparedness that stays on this device until you choose to save it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f7fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="stormready-demo-viewport" strategy="beforeInteractive">
          {`try{var m=localStorage.getItem("stormready.demoViewport");document.documentElement.setAttribute("data-demo-viewport",window.innerWidth>=1024&&m==="mobile"?"mobile":"laptop")}catch(e){document.documentElement.setAttribute("data-demo-viewport","laptop")}`}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
