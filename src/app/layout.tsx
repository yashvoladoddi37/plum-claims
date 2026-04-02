import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Plum OPD Claims — AI-Powered Adjudication",
  description: "AI-Powered OPD Claim Adjudication System with RAG, Explainability, and Human-in-the-Loop Review",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background">
        <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold">P</div>
                  <span>Plum OPD Claims</span>
                </Link>
                <div className="hidden sm:flex items-center gap-1 text-sm">
                  <Link href="/" className="text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-md transition-all">Dashboard</Link>
                  <Link href="/submit" className="text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-md transition-all">Submit Claim</Link>
                  <Link href="/policy" className="text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-md transition-all">Policy Explorer</Link>
                  <Link href="/test-runner" className="text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-md transition-all">Test Runner</Link>
                  <Link href="/settings" className="text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-md transition-all">⚙️ Settings</Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="AI Active" />
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
          {children}
        </main>
        <footer className="border-t py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground">
            <span>Plum OPD Claims Adjudication — AI Automation Engineer Assignment</span>
            <span>Built with Next.js 16 + Groq AI + RAG</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
