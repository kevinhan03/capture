import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capture",
  description: "쇼핑 아이템 분석 앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
