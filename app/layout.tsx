import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NIA Results Tracker",
  description:
    "Track organizational performance metrics aligned to the Baldrige Excellence Framework",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Header */}
        <header className="bg-gradient-to-r from-[#55787c] to-[#324a4d] text-white shadow-lg">
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
                <h1 className="text-xl font-bold">NIA Results Tracker</h1>
                <p className="text-sm text-white/70">
                  Baldrige Excellence Framework
                </p>
              </div>
            </div>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-[#f79935] transition-colors">
                Dashboard
              </Link>
              <Link
                href="/categories"
                className="hover:text-[#f79935] transition-colors"
              >
                Categories
              </Link>
              <Link
                href="/schedule"
                className="hover:text-[#f79935] transition-colors"
              >
                Review Schedule
              </Link>
              <Link
                href="/letci"
                className="hover:text-[#f79935] transition-colors"
              >
                LeTCI Summary
              </Link>
              <Link
                href="/log"
                className="hover:text-[#f79935] transition-colors"
              >
                Log Data
              </Link>
              <Link
                href="/metric/new"
                className="hover:text-[#f79935] transition-colors"
              >
                + Add Metric
              </Link>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
