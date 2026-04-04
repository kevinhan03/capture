"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface SharedCapture {
  preview: string;
  brand: string;
  item_name: string;
  price: string;
  style_keywords: string[];
  tags: string[];
  memo: string;
  purchase_url: string;
  related_url: string;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [capture, setCapture] = useState<SharedCapture | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("captures")
      .select("preview,brand,item_name,price,style_keywords,tags,memo,purchase_url,related_url")
      .eq("share_token", token)
      .eq("is_public", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setCapture(data as SharedCapture);
        }
        setLoading(false);
      });
  }, [token]);

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
      {/* 헤더 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #2D2D3A",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 20 }}>📷</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>SNAPY</span>
        </Link>
        <div style={{ fontSize: 12, color: "#555555" }}>공유된 캡쳐</div>
      </header>

      <main style={{ flex: 1, padding: "24px 20px" }}>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid #00D4AA",
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {notFound && !loading && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>
              캡쳐를 찾을 수 없어요
            </div>
            <div style={{ fontSize: 13, color: "#666666", marginBottom: 28 }}>
              링크가 만료되었거나 공개 설정이 해제된 캡쳐예요.
            </div>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              SNAPY 둘러보기
            </Link>
          </div>
        )}

        {capture && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 이미지 */}
            <img
              src={capture.preview}
              alt="shared capture"
              onClick={() => setLightboxOpen(true)}
              style={{
                width: "60%",
                display: "block",
                margin: "0 auto",
                borderRadius: 20,
                cursor: "zoom-in",
              }}
            />

            {/* 정보 카드 */}
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                backgroundColor: "#1E1E2A",
                border: "1px solid #2D2D3A",
              }}
            >
              <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 4 }}>출처</div>
              <div style={{ fontSize: 15, color: "#FFFFFF", fontWeight: 600 }}>
                {capture.brand}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                backgroundColor: "#1E1E2A",
                border: "1px solid #2D2D3A",
              }}
            >
              <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 6 }}>핵심 내용</div>
              <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, lineHeight: 1.4 }}>
                {capture.item_name}
              </div>
            </div>

            {capture.price && capture.price !== "없음" && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: "#1E1E2A",
                  border: "1px solid #2D2D3A",
                }}
              >
                <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 6 }}>참고 정보</div>
                <div style={{ fontSize: 15, color: "#CDD3DF" }}>{capture.price}</div>
              </div>
            )}

            {capture.style_keywords?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {capture.style_keywords.map((kw, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      backgroundColor: "#2D2D3A",
                      color: "#CED3DD",
                      fontSize: 12,
                    }}
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}

            {capture.tags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {capture.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      backgroundColor: "#17342F",
                      border: "1px solid #00D4AA44",
                      color: "#00D4AA",
                      fontSize: 12,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {capture.memo && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: "#1E1E2A",
                  border: "1px solid #2D2D3A",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#7F8797",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span>✎</span>
                  <span>메모</span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#CCCCCC",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {capture.memo}
                </div>
              </div>
            )}

            {capture.purchase_url && (
              <a
                href={capture.purchase_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                }}
              >
                구매 링크 열기
              </a>
            )}

            {capture.related_url && (
              <a
                href={capture.related_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "14px 16px",
                  borderRadius: 14,
                  backgroundColor: "#2D2D3A",
                  color: "#FFFFFF",
                  fontWeight: 600,
                }}
              >
                관련 링크 열기
              </a>
            )}

            {/* SNAPY 홍보 */}
            <div
              style={{
                marginTop: 8,
                padding: 16,
                borderRadius: 18,
                backgroundColor: "#1E2D2A",
                border: "1px solid #00D4AA33",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 13, color: "#888888", marginBottom: 8 }}>
                나도 AI 캡쳐 스크랩북 만들기
              </div>
              <Link
                href="/"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                📷 SNAPY 시작하기
              </Link>
            </div>
          </div>
        )}
      </main>

      {lightboxOpen && capture && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 20,
          }}
        >
          <img
            src={capture.preview}
            alt="fullscreen"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 16, objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}
