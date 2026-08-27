import type { Metadata } from "next";
import { Bebas_Neue, Poppins } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { GYM_NAME, GYM_SHORT_NAME, GYM_TAGLINE } from "@/lib/nav";
import StandaloneLoginButton from "@/components/StandaloneLoginButton";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${GYM_NAME} | ${GYM_TAGLINE}`,
  description:
    "Stellar Fitness Club is a premium strength and conditioning gym offering expert coaching, group classes, and a results-driven training community.",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: GYM_SHORT_NAME,
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black text-zinc-100">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <StandaloneLoginButton />
      </body>
    </html>
  );
}
