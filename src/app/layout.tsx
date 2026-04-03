import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plum OPD Claims — AI-Powered Adjudication",
  description: "AI-Powered OPD Claim Adjudication System with RAG, Explainability, and Human-in-the-Loop Review",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground" style={{ fontFeatureSettings: '"cv01", "ss03"' }}>
        <nav className="sticky top-0 z-50 border-b border-[#f0eee6] bg-[#faf0ec]/92 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2.5 font-semibold text-[15px] tracking-[-0.2px]">
                  <Image src="/plum-logo.svg" alt="Plum" width={80} height={25} className="h-6 w-auto" />
                  <span className="text-[#5e5d59] text-[13px] font-normal">Claims</span>
                </Link>
                <div className="hidden sm:flex items-center gap-0.5 text-[13px] font-medium">
                  <Link href="/" className="text-[#87867f] hover:text-[#141413] px-3 py-1.5 rounded-lg transition-colors">Dashboard</Link>
                  <Link href="/submit" className="text-[#87867f] hover:text-[#141413] px-3 py-1.5 rounded-lg transition-colors">Submit Claim</Link>
                  <Link href="/policy" className="text-[#87867f] hover:text-[#141413] px-3 py-1.5 rounded-lg transition-colors">Policy Explorer</Link>
                  <Link href="/test-runner" className="text-[#87867f] hover:text-[#141413] px-3 py-1.5 rounded-lg transition-colors">Test Runner</Link>
                  <Link href="/settings" className="text-[#87867f] hover:text-[#141413] px-3 py-1.5 rounded-lg transition-colors">Settings</Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#87867f]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#27a644] animate-pulse" />
                  <span>AI Active</span>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
          {children}
        </main>
        <footer className="border-t border-[#f0eee6] py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[12px] text-[#87867f]">
            <span>Plum OPD Claims Adjudication</span>
            <span>Built with Next.js + Groq AI + RAG</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
