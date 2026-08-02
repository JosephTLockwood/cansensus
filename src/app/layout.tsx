import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// Archivo Black is not a variable font, so the weight has to be pinned.
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Energy League — the definitive energy drink league table",
  description:
    "A crowd-sourced scoreboard for energy drinks. Rate cans on taste, kick, aftertaste and value, then see how the crowd ranks them against what is actually in the can.",
};

export const viewport: Viewport = {
  themeColor: "#0A0B09",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
