import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400"],
});

const DESCRIPTION =
  "Consulte o preço máximo (PMC) de mais de 22 mil medicamentos na lista oficial da CMED/Anvisa, com o valor certo para o ICMS do seu estado.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MedPreço — Preço máximo de medicamentos no Brasil",
    template: "%s | MedPreço",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: "MedPreço — Preço máximo de medicamentos no Brasil",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AppHeader />
        <div className="pb-24 md:pb-12">
          {children}
          <Footer />
        </div>
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
