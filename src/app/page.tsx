"use client";

import { useState, useRef } from "react";
import type { ShoppingItem } from "@/lib/gemini";

export default function Home() {
  const [result, setResult] = useState<ShoppingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      // data:image/xxx;base64,<data> 에서 base64 부분만 추출
      const [prefix, base64Data] = dataUrl.split(",");
      const mimeType = prefix.split(":")[1].split(";")[0] as
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "image/gif";

      setLoading(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "분석 실패");
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Capture</h1>

      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border: "2px dashed #ccc",
          borderRadius: 12,
          padding: "2rem",
          textAlign: "center",
          cursor: "pointer",
          background: "#fafafa",
        }}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 8 }} />
        ) : (
          <p style={{ color: "#888" }}>이미지를 드래그하거나 클릭해서 업로드</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {loading && <p style={{ marginTop: "1rem", color: "#555" }}>분석 중...</p>}

      {error && (
        <p style={{ marginTop: "1rem", color: "crimson" }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f0f4ff", borderRadius: 10 }}>
          <p><strong>브랜드:</strong> {result.brand}</p>
          <p><strong>상품명:</strong> {result.itemName}</p>
          <p><strong>가격:</strong> {result.price}</p>
          <p><strong>스타일:</strong> {result.styleKeywords.join(", ")}</p>
        </div>
      )}
    </main>
  );
}
