"use client";

import { useState } from "react";
import type { ShoppingItem } from "@/lib/gemini";

const TAGS = [
  { id: "buy",      icon: "🛍️", label: "살까말까" },
  { id: "outfit",   icon: "✨",  label: "코디 영감" },
  { id: "gift",     icon: "🎁",  label: "선물용" },
  { id: "interior", icon: "🏠",  label: "인테리어" },
  { id: "sale",     icon: "⏰",  label: "할인 대기" },
  { id: "color",    icon: "🎨",  label: "컬러 참고" },
  { id: "fit",      icon: "🏷️", label: "핏/사이즈" },
  { id: "brand",    icon: "🔖",  label: "브랜드 기억" },
  { id: "custom",   icon: "✏️", label: "직접 입력" },
];

interface Props {
  preview: string;
  result: ShoppingItem;
  onSave: (tags: string[], memo: string) => void;
  onBack: () => void;
}

export default function ResultScreen({ preview, result, onSave, onBack }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [memo, setMemo] = useState("");

  function toggleTag(id: string) {
    if (id === "custom") {
      setShowCustom((v) => !v);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    const tags = Array.from(selected).map(
      (id) => TAGS.find((t) => t.id === id)?.label ?? id
    );
    if (customText.trim()) tags.push(customText.trim());
    onSave(tags, memo.trim());
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#16161E",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 20px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "#2D2D3A",
            border: "none",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          ‹
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
          분석 완료 및 태그
        </span>
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div style={{ flex: 1, padding: "4px 20px 0", overflowY: "auto" }}>

        {/* 분석 결과 카드 */}
        <div
          style={{
            backgroundColor: "#1E1E2A",
            borderRadius: 16,
            padding: 14,
            display: "flex",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {/* 썸네일 */}
          <img
            src={preview}
            alt="capture"
            style={{
              width: 82,
              height: 82,
              objectFit: "cover",
              borderRadius: 10,
              flexShrink: 0,
            }}
          />

          {/* 분석 정보 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#00D4AA", marginBottom: 4 }}>
              AI 분석 완료
            </div>
            {result.brand && result.brand !== "미상" && result.brand !== "" && (
              <div style={{ fontSize: 12, color: "#888888", marginBottom: 2 }}>
                {result.brand}
              </div>
            )}
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: 5,
                lineHeight: 1.35,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {result.itemName}
            </div>
            {result.price && result.price !== "없음" && (
              <div style={{ fontSize: 13, color: "#00D4AA", marginBottom: 6 }}>
                {result.price}
              </div>
            )}
            {result.styleKeywords?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {result.styleKeywords.map((kw, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 20,
                      backgroundColor: "#2D2D3A",
                      color: "#888888",
                    }}
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 저장 이유 태그 */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 16, color: "#AAAAAA" }}>◇</span>
            <span
              style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}
            >
              이 사진을 왜 저장하셨나요?
            </span>
          </div>

          {/* 3열 그리드 태그 버튼 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {TAGS.map((tag) => {
              const isActive =
                selected.has(tag.id) ||
                (tag.id === "custom" && showCustom);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: "11px 6px",
                    borderRadius: 10,
                    backgroundColor: isActive ? "#1E2D2A" : "#2D2D3A",
                    border: `1px solid ${isActive ? "#00D4AA" : "transparent"}`,
                    color: isActive ? "#00D4AA" : "#CCCCCC",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tag.icon}</span>
                  <span>{tag.label}</span>
                </button>
              );
            })}
          </div>

          {/* 직접 입력 텍스트 필드 */}
          {showCustom && (
            <input
              type="text"
              placeholder="태그를 직접 입력하세요"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              autoFocus
              style={{
                marginTop: 10,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                backgroundColor: "#2D2D3A",
                border: "1px solid #00D4AA",
                color: "#FFFFFF",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 16, color: "#AAAAAA" }}>✎</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
              메모
            </span>
            <span style={{ fontSize: 12, color: "#555555" }}>(선택)</span>
          </div>
          <textarea
            placeholder="기억해두고 싶은 내용을 적어보세요"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              backgroundColor: "#1E1E2A",
              border: "1px solid #2D2D3A",
              color: "#FFFFFF",
              fontSize: 14,
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              lineHeight: 1.6,
              fontFamily: "inherit",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#00D4AA55"; }}
            onBlur={(e) => { e.target.style.borderColor = "#2D2D3A"; }}
          />
        </div>
      </div>

      {/* 하단 저장 버튼 */}
      <div
        style={{
          padding: "14px 20px 36px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleSave}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 14,
            backgroundColor: "#2D2D3A",
            border: "none",
            color: "#AAAAAA",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          내 스크랩북에 저장하기
        </button>
      </div>
    </div>
  );
}
