import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Title, favicon and theme all come from the pharmacy's settings in the database.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const iconUrl = s.logoUrl ?? "/icon.svg";
  return {
    title: { default: s.storeName, template: `%s · ${s.storeName}` },
    description: `${s.storeName} — powered by ${APP_NAME}`,
    icons: [
      { rel: "icon", url: iconUrl },
      { rel: "shortcut icon", url: iconUrl },
      { rel: "apple-touch-icon", url: iconUrl },
    ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const s = await getSettings();
  const iconUrl = s.logoUrl ?? "/icon.svg";
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <style>{`:root{--brand:${s.brandColor}}`}</style>
        <link rel="icon" href={iconUrl} />
        <link rel="shortcut icon" href={iconUrl} />
        <link rel="apple-touch-icon" href={iconUrl} />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
