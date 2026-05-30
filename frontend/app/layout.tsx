import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnalyticsVisualAI — AI-Powered Dashboard Platform",
  description:
    "Upload data, describe your dashboard in plain English, and get fully interactive analytics — powered by Claude + Gemini.",
  keywords: ["analytics", "dashboard", "AI", "data visualization", "Claude", "Gemini"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
