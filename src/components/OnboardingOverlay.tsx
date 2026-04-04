"use client";

import { useState, useEffect } from "react";

const SLIDES = [
  {
    emoji: "📷",
    title: "SNAPY에 오신 것을 환영해요!",
    desc: "마음에 드는 사진을 캡쳐하면\nAI가 자동으로 정보를 분석해줘요.",
  },
  {
    emoji: "✦",
    title: "AI가 분석하고, 내가 정리해요",
    desc: "+ 버튼으로 이미지를 올리면\n출처·핵심 내용·키워드를 자동으로 추출해요.",
  },
  {
    emoji: "🗂️",
    title: "나만의 스크랩북을 만들어요",
    desc: "태그로 분류하고, 메모를 남기고,\n구매 링크까지 한 곳에 모아두세요.",
  },
];

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem("snapy_onboarded")) {
      setVisible(true);
    }
  }, []);

  function finish() {
    localStorage.setItem("snapy_onboarded", "1");
    setVisible(false);
  }

  if (!visible) return null;

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#1E1E2A",
          borderRadius: 24,
          border: "1px solid #2D2D3A",
          padding: "36px 28px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* 이모지 */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "#16161E",
            border: "1px solid #2D2D3A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            marginBottom: 24,
          }}
        >
          {current.emoji}
        </div>

        {/* 제목 */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#FFFFFF",
            textAlign: "center",
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          {current.title}
        </div>

        {/* 설명 */}
        <div
          style={{
            fontSize: 14,
            color: "#888888",
            textAlign: "center",
            lineHeight: 1.7,
            whiteSpace: "pre-line",
            marginBottom: 32,
          }}
        >
          {current.desc}
        </div>

        {/* 점 인디케이터 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === slide ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === slide ? "#00D4AA" : "#2D2D3A",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          {!isLast && (
            <button
              onClick={finish}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 14,
                border: "1px solid #2D2D3A",
                backgroundColor: "transparent",
                color: "#666666",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              건너뛰기
            </button>
          )}
          <button
            onClick={() => (isLast ? finish() : setSlide((s) => s + 1))}
            style={{
              flex: isLast ? undefined : 1,
              width: isLast ? "100%" : undefined,
              padding: "14px 0",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isLast ? "시작하기 🚀" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
