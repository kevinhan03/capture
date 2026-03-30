"use client";

import { useState, useRef } from "react";
import type { ShoppingItem } from "@/lib/gemini";
import CropScreen from "@/components/CropScreen";
import ResultScreen from "@/components/ResultScreen";

interface CaptureItem {
  id: string;
  preview: string;
  result: ShoppingItem;
  tags: string[];
}

interface CropState {
  dataUrl: string;
  mimeType: string;
}

interface ResultState {
  preview: string;
  result: ShoppingItem;
}

export default function Home() {
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [resultState, setResultState] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const mimeType = dataUrl.split(":")[1].split(";")[0];
      setCropState({ dataUrl, mimeType });
    };
    reader.readAsDataURL(file);
  }

  async function analyze(dataUrl: string, mimeType: string) {
    setError(null);
    setCropState(null);
    setLoading(true);

    const base64Data = dataUrl.split(",")[1];

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");

      // 분석 완료 → ResultScreen 표시
      setResultState({ preview: dataUrl, result: data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  function handleCropComplete(croppedDataUrl: string) {
    const mimeType = cropState?.mimeType ?? "image/jpeg";
    analyze(croppedDataUrl, mimeType);
  }

  function handleSave(tags: string[]) {
    if (!resultState) return;
    setCaptures((prev) => [
      {
        id: Date.now().toString(),
        preview: resultState.preview,
        result: resultState.result,
        tags,
      },
      ...prev,
    ]);
    setResultState(null);
  }

  // 크롭 화면
  if (cropState) {
    return (
      <CropScreen
        dataUrl={cropState.dataUrl}
        mimeType={cropState.mimeType}
        onComplete={handleCropComplete}
        onBack={() => setCropState(null)}
      />
    );
  }

  // 결과/태그 화면
  if (resultState) {
    return (
      <ResultScreen
        preview={resultState.preview}
        result={resultState.result}
        onSave={handleSave}
        onBack={() => setResultState(null)}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        backgroundColor: "#16161E",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 상단 네비게이션 바 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>📷</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2 }}>
              WishSnap
            </div>
            <div style={{ fontSize: 11, color: "#888888", lineHeight: 1.2 }}>
              나만의 AI 캡쳐 스크랩북
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: "#2D2D3A", border: "none",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "#FFFFFF", fontSize: 16,
            }}
          >
            🔍
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: loading ? "#555" : "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#FFFFFF", fontSize: 22, fontWeight: 300,
              boxShadow: loading ? "none" : "0 2px 12px rgba(0, 212, 170, 0.4)",
            }}
          >
            +
          </button>
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {/* 로딩 */}
      {loading && (
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "#1E1E2A",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid #00D4AA", borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: 13, color: "#888888" }}>
            AI가 이미지를 분석하고 있어요...
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div
          style={{
            margin: "12px 20px",
            padding: "12px 16px",
            backgroundColor: "#2A1A1A",
            borderRadius: 12,
            borderLeft: "3px solid #FF4444",
            fontSize: 13,
            color: "#FF6666",
          }}
        >
          {error}
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main style={{ flex: 1, padding: "8px 20px 20px" }}>
        {captures.length === 0 && !loading ? (
          /* 빈 상태 */
          <div
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: "calc(100vh - 140px)", gap: 16,
            }}
          >
            <div
              style={{
                width: 88, height: 88, borderRadius: "50%",
                backgroundColor: "#2D2D3A",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
              }}
            >
              🖼️
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
                아직 저장된 캡쳐가 없어요.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#666666" }}>
                상단 우측의 + 버튼을 눌러 추가해보세요!
              </p>
            </div>
          </div>
        ) : (
          /* 캡쳐 목록 */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {captures.map((capture) => (
              <div
                key={capture.id}
                style={{
                  backgroundColor: "#1E1E2A",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <img
                  src={capture.preview}
                  alt="capture"
                  style={{
                    width: "100%", maxHeight: 220,
                    objectFit: "cover", display: "block",
                  }}
                />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>
                    {capture.result.itemName}
                  </div>
                  {capture.result.brand && capture.result.brand !== "미상" && (
                    <div style={{ fontSize: 12, color: "#00D4AA", marginBottom: 6 }}>
                      {capture.result.brand}
                    </div>
                  )}
                  {capture.result.price && capture.result.price !== "미정" && (
                    <div style={{ fontSize: 14, color: "#CCCCCC", marginBottom: 8 }}>
                      {capture.result.price}
                    </div>
                  )}
                  {capture.result.styleKeywords?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: capture.tags?.length > 0 ? 8 : 0 }}>
                      {capture.result.styleKeywords.map((kw, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11, padding: "3px 10px",
                            borderRadius: 20, backgroundColor: "#2D2D3A", color: "#AAAAAA",
                          }}
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                  {capture.tags?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {capture.tags.map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11, padding: "3px 10px",
                            borderRadius: 20,
                            backgroundColor: "#1E2D2A",
                            color: "#00D4AA",
                            border: "1px solid #00D4AA44",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
