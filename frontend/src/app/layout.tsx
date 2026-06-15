import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./css/shared.css";
import "./css/styles.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Secure Cookie Share",
  description: "Secure multi-service session provider",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
