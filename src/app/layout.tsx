import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Outfit } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { Providers } from "@/app/providers";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: {
    default: "Sales Persona Trainer",
    template: "%s · Sales Persona Trainer",
  },
  description: "Practise objection handling against seven independent-business buyers. Rule-based, scored, and ready for a Postgres connection.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body className={`${fraunces.variable} ${outfit.variable} ${plex.variable} font-sans antialiased`}>
        <Providers>
          <AppHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
