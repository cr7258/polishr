import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Polishr - Polish Your Writing Instantly",
  description:
    "A desktop app for grammar polishing, rephrasing, and translation. Select text anywhere, press a hotkey, and get instant AI-powered suggestions.",
  keywords: [
    "grammar",
    "writing",
    "polish",
    "rephrase",
    "translate",
    "desktop app",
    "AI writing assistant",
    "Grammarly alternative",
  ],
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
  openGraph: {
    title: "Polishr - Polish Your Writing Instantly",
    description:
      "Select text in any app, press a hotkey, and get instant AI-powered grammar fixes, rephrasing, and translation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
