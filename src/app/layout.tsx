import type { Metadata } from "next";
import { Red_Hat_Display, Alegreya } from "next/font/google";
import "./globals.css";

const display = Red_Hat_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const body = Red_Hat_Display({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const accent = Alegreya({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "BeeFlow | Dijital Arı",
  description: "Ajans içi sosyal medya ve operasyon yönetimi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${display.variable} ${body.variable} ${accent.variable} h-full`}
    >
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        {children}
      </body>
    </html>
  );
}
