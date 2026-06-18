import type { Metadata } from "next";
import Link from "next/link";
import { SavedBakeriesProvider } from "@/components/saved-bakeries-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "빵길",
    template: "%s | 빵길",
  },
  description: "출처와 확인일을 보여주는 전국 빵집 탐색 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SavedBakeriesProvider>
          <div className="app-shell">
            <header className="site-header">
              <Link className="brand" href="/" aria-label="빵길 홈">
                <span className="brand-mark" aria-hidden="true">
                  ㅂ
                </span>
                <span>
                  <strong>빵길</strong>
                  <small>믿고 떠나는 전국 빵집 지도</small>
                </span>
              </Link>
              <nav className="desktop-nav" aria-label="주요 메뉴">
                <Link href="/">홈</Link>
                <Link href="/explore">탐색</Link>
                <Link href="/saved">저장</Link>
              </nav>
            </header>
            <main>{children}</main>
            <nav className="bottom-nav" aria-label="모바일 주요 메뉴">
              <Link href="/">홈</Link>
              <Link href="/explore">탐색</Link>
              <Link href="/saved">저장</Link>
            </nav>
          </div>
        </SavedBakeriesProvider>
      </body>
    </html>
  );
}
