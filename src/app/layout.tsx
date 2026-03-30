import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WishSnap",
  description: "나만의 AI 캡쳐 스크랩북",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: "#16161E",
        color: "#FFFFFF",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        minHeight: "100vh",
      }}>
        {children}
      </body>
    </html>
  );
}
