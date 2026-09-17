import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { AppProviders } from "@/components/layout/AppProviders";
import "./globals.css";

const noto = Noto_Sans_KR({
  variable: "--font-pretendard",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Hyundacorp 생산현황 분석",
  description: "성형작업일보 기반 생산·설비·비가동 분석 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeBootScript = `(function(){try{var k="production-analytics-color-theme";var raw=localStorage.getItem(k);var theme=raw==="dark"?"dark":"light";document.documentElement.setAttribute("data-theme",theme);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

  return (
    <html lang="ko" className={`${noto.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
