import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { AppChrome } from "@/components/app-chrome";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MicroBiz POS",
  description: "Web POS for Philippine micro retail stores",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
