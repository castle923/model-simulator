import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "model simulator · 웹 시뮬레이션 랩",
  description: "기체별 임무와 공통 지도 편집을 제공하는 웹 시뮬레이션. 실제 엔진·실물 로봇 연결과 구분합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
