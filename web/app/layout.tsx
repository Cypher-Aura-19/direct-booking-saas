import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Nastaliq_Urdu, Libre_Caslon_Display } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Register figures: counts, dates, rates and slugs. Never used for prose.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Libre_Caslon_Display({ variable: "--font-display", subsets: ["latin"], weight: "400" });

/*
  Weights 300, 500 and 600 render badly in Nastaliq — the script's
  connected forms break down at intermediate weights. 400 and 700 are
  the only two Google serves, and the only two we use.
*/
const notoNastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-noto-nastaliq",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description:
    "Bookings, guest chat and Hotel Eye records for Pakistani hosts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} ${notoNastaliq.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
