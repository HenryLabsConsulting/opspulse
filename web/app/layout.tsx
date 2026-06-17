import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "OpsPulse — Northwind Field Services",
  description:
    "Operations analytics for a field-service company. Revenue, jobs, first-time-fix, technician productivity, and an AI insights layer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div>
              <div className="brand">
                <span className="brand-mark">◎</span>
                <span>OpsPulse</span>
              </div>
              <div className="brand-sub">Northwind Field Services</div>
            </div>
            <Nav />
            <div className="sidebar-foot">
              Demo on 100% synthetic data.
              <br />
              Built by HenryLabs Consulting.
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
