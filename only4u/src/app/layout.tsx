import type { Metadata } from "next";
import { SessionProvider } from 'next-auth/react';
import { Geist, Geist_Mono } from "next/font/google";
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Only4U Fashion",
  description: "Shop the latest fashion trends at Only4U Fashion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <SessionProvider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
          <Toaster position="top-right" />
        </SessionProvider>
      </body>
    </html>
  );
}