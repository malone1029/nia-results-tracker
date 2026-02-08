import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import Nav from "./nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NIA Excellence Hub",
  description:
    "Process documentation and performance metrics aligned to the Baldrige Excellence Framework",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} antialiased`}
      >
        {/* Header */}
        <header className="bg-gradient-to-r from-[#55787c] to-[#324a4d] text-white shadow-lg relative">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="NIA Logo"
                width={40}
                height={40}
                className="rounded"
              />
              <div>
                <h1 className="text-xl font-bold font-display">NIA Excellence Hub</h1>
                <p className="text-sm text-white/70">
                  Baldrige Excellence Framework
                </p>
              </div>
            </div>
            <Nav />
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
