"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { ShoppingItem } from "@/lib/gemini";
import { createClient } from "@/lib/supabase";
import CropScreen from "@/components/CropScreen";
import ResultScreen from "@/components/ResultScreen";
import OnboardingOverlay from "@/components/OnboardingOverlay";

interface CaptureItem {
  id: string;
  preview: string;
  result: ShoppingItem;
  tags: string[];
  memo: string;
  purchaseUrl: string;
  relatedUrl: string;
  createdAt: string;
  isPublic: boolean;
  shareToken: string | null;
}

interface CropState {
  dataUrl: string;
  mimeType: string;
}

interface ResultState {
  preview: string;
  result: ShoppingItem;
}

interface EditFormState {
  brand: string;
  itemName: string;
  price: string;
  styleKeywords: string;
  tags: string;
  memo: string;
  purchaseUrl: string;
  relatedUrl: string;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [resultState, setResultState] = useState<ResultState | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "name_asc">("newest");
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // 로그인 상태 감지 및 캡쳐 목록 불러오기
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error?.message?.includes("Refresh Token")) {
        supabase.auth.signOut();
        return;
      }
      setUser(user);
      if (user) loadCaptures(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        supabase.auth.signOut();
        return;
      }
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadCaptures(currentUser.id);
      } else {
        setCaptures([]);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCaptures(userId: string) {
    setDbLoading(true);
    const { data, error } = await supabase
      .from("captures")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCaptures(
        data.map((row) => ({
          id: row.id,
          preview: row.preview,
          result: {
            brand: row.brand,
            itemName: row.item_name,
            price: row.price,
            styleKeywords: row.style_keywords ?? [],
          },
          tags: row.tags ?? [],
          memo: row.memo ?? "",
          purchaseUrl: row.purchase_url,
          relatedUrl: row.related_url,
          createdAt: row.created_at,
          isPublic: row.is_public ?? false,
          shareToken: row.share_token ?? null,
        }))
      );
    }
    setDbLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

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

  function handleCropSkip(croppedDataUrl: string) {
    setCropState(null);
    setResultState({
      preview: croppedDataUrl,
      result: { brand: "미상", itemName: "", price: "없음", styleKeywords: [] },
    });
  }

  async function handleSave(tags: string[], memo: string) {
    if (!resultState) return;

    if (!user) {
      setError("저장하려면 로그인이 필요합니다.");
      setResultState(null);
      return;
    }

    setLoading(true);

    try {
      // base64 → Blob 변환 후 Storage 업로드
      const base64Data = resultState.preview.split(",")[1];
      const mimeType = resultState.preview.split(":")[1].split(";")[0];
      const byteChars = atob(base64Data);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mimeType });

      const ext = mimeType.split("/")[1] ?? "jpg";
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(filePath, blob, { contentType: mimeType });

      if (uploadError) throw new Error("이미지 업로드 실패: " + uploadError.message);

      // Signed URL 생성 (10년 유효)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("captures")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

      if (urlError || !urlData) throw new Error("URL 생성 실패");

      const { data, error } = await supabase
        .from("captures")
        .insert({
          user_id: user.id,
          preview: urlData.signedUrl,
          brand: resultState.result.brand,
          item_name: resultState.result.itemName,
          price: resultState.result.price,
          style_keywords: resultState.result.styleKeywords,
          tags,
          memo,
          purchase_url: "",
          related_url: "",
          is_public: false,
          share_token: null,
        })
        .select()
        .single();

      if (error) throw new Error("DB 저장 실패");

      setCaptures((prev) => [
        {
          id: data.id,
          preview: data.preview,
          result: {
            brand: data.brand,
            itemName: data.item_name,
            price: data.price,
            styleKeywords: data.style_keywords ?? [],
          },
          tags: data.tags ?? [],
          memo: data.memo ?? "",
          purchaseUrl: data.purchase_url,
          relatedUrl: data.related_url,
          createdAt: data.created_at,
          isPublic: data.is_public ?? false,
          shareToken: data.share_token ?? null,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }

    setResultState(null);
  }

  function normalizeListInput(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function openCaptureDetail(captureId: string) {
    setSelectedCaptureId(captureId);
    setEditingCaptureId(null);
    setEditForm(null);
  }

  function closeCaptureDetail() {
    setSelectedCaptureId(null);
    setEditingCaptureId(null);
    setEditForm(null);
  }

  function startEditingCapture(capture: CaptureItem) {
    setSelectedCaptureId(capture.id);
    setEditingCaptureId(capture.id);
    setEditForm({
      brand: capture.result.brand,
      itemName: capture.result.itemName,
      price: capture.result.price,
      styleKeywords: capture.result.styleKeywords.join(", "),
      tags: capture.tags.join(", "),
      memo: capture.memo,
      purchaseUrl: capture.purchaseUrl,
      relatedUrl: capture.relatedUrl,
    });
  }

  function handleEditFieldChange(field: keyof EditFormState, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function deleteCapture(captureId: string) {
    const { error } = await supabase.from("captures").delete().eq("id", captureId);
    if (!error) {
      setCaptures((prev) => prev.filter((c) => c.id !== captureId));
      closeCaptureDetail();
    }
  }

  async function saveCaptureEdit() {
    if (!editingCaptureId || !editForm) return;

    const updated = {
      brand: editForm.brand.trim() || "미상",
      item_name: editForm.itemName.trim(),
      price: editForm.price.trim() || "없음",
      style_keywords: normalizeListInput(editForm.styleKeywords),
      tags: normalizeListInput(editForm.tags),
      memo: editForm.memo,
      purchase_url: editForm.purchaseUrl.trim(),
      related_url: editForm.relatedUrl.trim(),
    };

    const { error } = await supabase
      .from("captures")
      .update(updated)
      .eq("id", editingCaptureId);

    if (!error) {
      setCaptures((prev) =>
        prev.map((capture) =>
          capture.id === editingCaptureId
            ? {
                ...capture,
                result: {
                  ...capture.result,
                  brand: updated.brand,
                  itemName: updated.item_name,
                  price: updated.price,
                  styleKeywords: updated.style_keywords,
                },
                tags: updated.tags,
                memo: updated.memo,
                purchaseUrl: updated.purchase_url,
                relatedUrl: updated.related_url,
              }
            : capture
        )
      );
    }

    setEditingCaptureId(null);
    setEditForm(null);
  }

  async function handleShareCapture(capture: CaptureItem) {
    let token = capture.shareToken;

    if (!token) {
      token = crypto.randomUUID();
      const { error } = await supabase
        .from("captures")
        .update({ is_public: true, share_token: token })
        .eq("id", capture.id);

      if (error) { setError("공유 링크 생성 실패"); return; }

      setCaptures((prev) =>
        prev.map((c) =>
          c.id === capture.id ? { ...c, isPublic: true, shareToken: token } : c
        )
      );
    }

    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedShareId(capture.id);
    setTimeout(() => setCopiedShareId(null), 2500);
  }

  // 크롭 화면
  if (cropState) {
    return (
      <CropScreen
        dataUrl={cropState.dataUrl}
        mimeType={cropState.mimeType}
        onComplete={handleCropComplete}
        onSkip={handleCropSkip}
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

  const KNOWN_TAGS = ["살까말까","코디 영감","선물용","인테리어","할인 대기","컬러 참고","핏/사이즈","브랜드 기억"];
  const categoryFiltered = selectedCategory === "전체"
    ? captures
    : selectedCategory === "기타"
      ? captures.filter((c) => c.tags.some((tag) => !KNOWN_TAGS.includes(tag)))
      : captures.filter((c) => c.tags.includes(selectedCategory));

  const q = searchQuery.trim().toLowerCase();
  const searchFiltered = q
    ? categoryFiltered.filter((c) =>
        c.result.itemName.toLowerCase().includes(q) ||
        c.result.brand.toLowerCase().includes(q) ||
        c.result.price.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.result.styleKeywords.some((kw) => kw.toLowerCase().includes(q))
      )
    : categoryFiltered;

  const filteredCaptures = [...searchFiltered].sort((a, b) => {
    if (sortOrder === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortOrder === "name_asc") return a.result.itemName.localeCompare(b.result.itemName, "ko");
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
  });

  const selectedCapture =
    selectedCaptureId ? captures.find((capture) => capture.id === selectedCaptureId) ?? null : null;

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
      <OnboardingOverlay />
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
              SNAPY
            </div>
            <div style={{ fontSize: 11, color: "#888888", lineHeight: 1.2 }}>
              나만의 AI 캡쳐 스크랩북
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? (
            <button
              onClick={handleLogout}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                backgroundColor: "#2D2D3A",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/auth"
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                backgroundColor: "#2D2D3A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              로그인
            </Link>
          )}
          <button
            onClick={() => {
              setShowSearch((v) => {
                if (v) setSearchQuery("");
                setTimeout(() => searchInputRef.current?.focus(), 50);
                return !v;
              });
            }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: showSearch ? "#00D4AA" : "#2D2D3A", border: "none",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: showSearch ? "#000000" : "#FFFFFF", fontSize: 16,
              transition: "all 0.15s ease",
            }}
          >
            🔍
          </button>
          <button
            onClick={() => {
              if (!user) {
                setError("캡쳐를 저장하려면 먼저 로그인해주세요.");
                return;
              }
              inputRef.current?.click();
            }}
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

      {/* 검색 바 */}
      {showSearch && (
        <div style={{ padding: "0 20px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#1E1E2A",
              borderRadius: 14,
              padding: "10px 14px",
              border: "1px solid #00D4AA55",
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="내용, 출처, 태그로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#FFFFFF",
                fontSize: 14,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: "none", border: "none",
                  color: "#666666", cursor: "pointer",
                  fontSize: 18, padding: 0, flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* 로딩 */}
      {(loading || dbLoading) && (
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
            {loading ? "AI가 이미지를 분석하고 있어요..." : "캡쳐 목록을 불러오는 중..."}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>
            {error}
            {error.includes("로그인") && (
              <Link
                href="/auth"
                style={{
                  marginLeft: 8,
                  color: "#FF9999",
                  fontWeight: 700,
                  textDecoration: "underline",
                }}
              >
                로그인하기 →
              </Link>
            )}
          </span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "#FF6666", cursor: "pointer", fontSize: 16, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* 카테고리 필터 바 */}
      {captures.length > 0 && (() => {
        const TAG_META: { label: string; icon: string }[] = [
          { label: "살까말까", icon: "🛍️" },
          { label: "코디 영감", icon: "✨" },
          { label: "선물용",   icon: "🎁" },
          { label: "인테리어", icon: "🏠" },
          { label: "할인 대기", icon: "⏰" },
          { label: "컬러 참고", icon: "🎨" },
          { label: "핏/사이즈", icon: "🏷️" },
          { label: "브랜드 기억", icon: "🔖" },
        ];
        const existingLabels = new Set(captures.flatMap((c) => c.tags));
        const visibleTags = TAG_META.filter((t) => existingLabels.has(t.label));
        const hasCustom = captures.some((c) =>
          c.tags.some((tag) => !TAG_META.map((t) => t.label).includes(tag))
        );
        if (hasCustom) visibleTags.push({ label: "기타", icon: "✏️" });

        return (
          <div
            style={{
              overflowX: "auto",
              padding: "0 20px 12px",
              display: "flex",
              gap: 8,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {[{ label: "전체", icon: "✦" }, ...visibleTags].map(({ label, icon }) => {
              const isActive = selectedCategory === label;
              return (
                <button
                  key={label}
                  onClick={() => setSelectedCategory(label)}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "8px 14px",
                    borderRadius: 20,
                    backgroundColor: isActive ? "#00D4AA" : "#2D2D3A",
                    border: "none",
                    color: isActive ? "#000000" : "#AAAAAA",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* 정렬 UI */}
      {captures.length > 0 && (
        <div style={{ padding: "0 20px 10px", display: "flex", gap: 6 }}>
          {(["newest", "oldest", "name_asc"] as const).map((order) => {
            const labels = { newest: "최신순", oldest: "오래된순", name_asc: "이름순" };
            const isActive = sortOrder === order;
            return (
              <button
                key={order}
                onClick={() => setSortOrder(order)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: `1px solid ${isActive ? "#00D4AA" : "#2D2D3A"}`,
                  backgroundColor: isActive ? "#1E2D2A" : "transparent",
                  color: isActive ? "#00D4AA" : "#666666",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {labels[order]}
              </button>
            );
          })}
        </div>
      )}

      {/* 비로그인 안내 — 에러 메시지가 없을 때만 표시 */}
      {!user && !dbLoading && !error && (
        <div
          style={{
            margin: "0 20px 12px",
            padding: "12px 16px",
            backgroundColor: "#1E1E2A",
            borderRadius: 12,
            borderLeft: "3px solid #00D4AA",
            fontSize: 13,
            color: "#888888",
          }}
        >
          <Link href="/auth" style={{ color: "#00D4AA", fontWeight: 700, textDecoration: "none" }}>
            로그인
          </Link>
          하면 캡쳐 카드를 저장하고 어디서든 불러올 수 있어요.
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main style={{ flex: 1, padding: "8px 20px 20px" }}>
        {captures.length === 0 && !loading && !dbLoading ? (
          /* 빈 상태 */
          <div
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: "calc(100vh - 180px)", gap: 16,
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
                {user ? "상단 우측의 + 버튼을 눌러 추가해보세요!" : "로그인 후 캡쳐를 저장해보세요!"}
              </p>
            </div>
          </div>
        ) : filteredCaptures.length === 0 ? (
          /* 필터 결과 없음 */
          <div
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: "calc(100vh - 280px)", gap: 12,
            }}
          >
            <div style={{ fontSize: 36 }}>{q ? "😶" : "🔍"}</div>
            <p style={{ margin: 0, fontSize: 14, color: "#666666", textAlign: "center" }}>
              {q
                ? `"${searchQuery}"에 해당하는 캡쳐가 없어요.`
                : `'${selectedCategory}' 카테고리에 저장된 캡쳐가 없어요.`}
            </p>
          </div>
        ) : (
          /* 캡쳐 목록 */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {filteredCaptures.map((capture) => (
              <button
                key={capture.id}
                onClick={() => openCaptureDetail(capture.id)}
                style={{
                  backgroundColor: "#1E1E2A",
                  borderRadius: 16,
                  overflow: "hidden",
                  minWidth: 0,
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <img
                  src={capture.preview}
                  alt="capture"
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover", display: "block",
                  }}
                />
                <div style={{ padding: "12px" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      marginBottom: 4,
                      lineHeight: 1.35,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {capture.result.itemName}
                  </div>
                  {capture.result.brand && capture.result.brand !== "미상" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#00D4AA",
                        marginBottom: 6,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {capture.result.brand}
                    </div>
                  )}
                  {capture.result.price && capture.result.price !== "없음" && (
                    <div style={{ fontSize: 12, color: "#CCCCCC", marginBottom: 8 }}>
                      {capture.result.price}
                    </div>
                  )}
                  {capture.result.styleKeywords?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: capture.tags?.length > 0 ? 8 : 0 }}>
                      {capture.result.styleKeywords.map((kw, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 10, padding: "3px 8px",
                            borderRadius: 20, backgroundColor: "#2D2D3A", color: "#AAAAAA",
                          }}
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                  {capture.tags?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: capture.memo ? 8 : 0 }}>
                      {capture.tags.map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 10, padding: "3px 8px",
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
                  {capture.memo && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 5,
                        backgroundColor: "#16161E",
                        borderRadius: 8,
                        padding: "6px 8px",
                      }}
                    >
                      <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>✎</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#888888",
                          lineHeight: 1.4,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {capture.memo}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selectedCapture && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "24px 16px",
          }}
          onClick={closeCaptureDetail}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "96vh",
              overflowY: "auto",
              backgroundColor: "#16161E",
              borderRadius: 24,
              border: "1px solid #2D2D3A",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px",
                borderBottom: "1px solid #2D2D3A",
              }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>
                  {editingCaptureId === selectedCapture.id ? "사진 카드 수정" : "사진 카드 상세"}
                </div>
                <div style={{ fontSize: 12, color: "#7F8797", marginTop: 4 }}>
                  {editingCaptureId === selectedCapture.id
                    ? "상품 정보와 링크를 직접 수정할 수 있습니다."
                    : "상세 정보 확인 후 구매 링크를 연결할 수 있습니다."}
                </div>
              </div>
              <button
                onClick={closeCaptureDetail}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: "#2D2D3A",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <img
                src={selectedCapture.preview}
                alt="capture detail"
                onClick={() => setLightboxUrl(selectedCapture.preview)}
                style={{
                  width: "56%",
                  display: "block",
                  margin: "0 auto 18px",
                  borderRadius: 20,
                  cursor: "zoom-in",
                }}
              />

              {editingCaptureId === selectedCapture.id && editForm ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>출처</span>
                    <input
                      value={editForm.brand}
                      onChange={(e) => handleEditFieldChange("brand", e.target.value)}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>핵심 내용</span>
                    <input
                      value={editForm.itemName}
                      onChange={(e) => handleEditFieldChange("itemName", e.target.value)}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>참고 정보</span>
                    <input
                      value={editForm.price}
                      onChange={(e) => handleEditFieldChange("price", e.target.value)}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>스타일 키워드</span>
                    <input
                      value={editForm.styleKeywords}
                      onChange={(e) => handleEditFieldChange("styleKeywords", e.target.value)}
                      placeholder="쉼표로 구분"
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>태그</span>
                    <input
                      value={editForm.tags}
                      onChange={(e) => handleEditFieldChange("tags", e.target.value)}
                      placeholder="쉼표로 구분"
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>메모</span>
                    <textarea
                      value={editForm.memo}
                      onChange={(e) => handleEditFieldChange("memo", e.target.value)}
                      placeholder="기억해두고 싶은 내용을 적어보세요"
                      rows={3}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                        resize: "none", fontFamily: "inherit", lineHeight: 1.6,
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>구매 링크</span>
                    <input
                      value={editForm.purchaseUrl}
                      onChange={(e) => handleEditFieldChange("purchaseUrl", e.target.value)}
                      placeholder="https://..."
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#AAB1C3" }}>관련 링크</span>
                    <input
                      value={editForm.relatedUrl}
                      onChange={(e) => handleEditFieldChange("relatedUrl", e.target.value)}
                      placeholder="https://..."
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        border: "1px solid #2D2D3A", backgroundColor: "#1E1E2A",
                        color: "#FFFFFF", fontSize: 14, outline: "none",
                      }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      onClick={() => { setEditingCaptureId(null); setEditForm(null); }}
                      style={{
                        flex: 1, padding: "14px 0", borderRadius: 14,
                        border: "1px solid #2D2D3A", backgroundColor: "transparent",
                        color: "#FFFFFF", fontSize: 14, cursor: "pointer",
                      }}
                    >
                      취소
                    </button>
                    <button
                      onClick={saveCaptureEdit}
                      style={{
                        flex: 1, padding: "14px 0", borderRadius: 14,
                        border: "none",
                        background: "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
                        color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div
                    style={{
                      padding: 16, borderRadius: 18,
                      backgroundColor: "#1E1E2A", border: "1px solid #2D2D3A",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 6 }}>출처</div>
                    <div style={{ fontSize: 15, color: "#FFFFFF", fontWeight: 600 }}>
                      {selectedCapture.result.brand}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 16, borderRadius: 18,
                      backgroundColor: "#1E1E2A", border: "1px solid #2D2D3A",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 6 }}>핵심 내용</div>
                    <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, lineHeight: 1.4 }}>
                      {selectedCapture.result.itemName}
                    </div>
                  </div>
                  {selectedCapture.result.price && selectedCapture.result.price !== "없음" && (
                    <div
                      style={{
                        padding: 16, borderRadius: 18,
                        backgroundColor: "#1E1E2A", border: "1px solid #2D2D3A",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 6 }}>참고 정보</div>
                      <div style={{ fontSize: 15, color: "#CDD3DF" }}>
                        {selectedCapture.result.price}
                      </div>
                    </div>
                  )}

                  {selectedCapture.result.styleKeywords.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {selectedCapture.result.styleKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          style={{
                            padding: "6px 10px", borderRadius: 999,
                            backgroundColor: "#2D2D3A", color: "#CED3DD", fontSize: 12,
                          }}
                        >
                          #{keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedCapture.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {selectedCapture.tags.map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            padding: "6px 10px", borderRadius: 999,
                            backgroundColor: "#17342F", border: "1px solid #00D4AA44",
                            color: "#00D4AA", fontSize: 12,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedCapture.memo && (
                    <div
                      style={{
                        padding: 16, borderRadius: 18,
                        backgroundColor: "#1E1E2A", border: "1px solid #2D2D3A",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#7F8797", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                        <span>✎</span><span>메모</span>
                      </div>
                      <div style={{ fontSize: 14, color: "#CCCCCC", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {selectedCapture.memo}
                      </div>
                    </div>
                  )}

                  {(selectedCapture.purchaseUrl || selectedCapture.relatedUrl) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedCapture.purchaseUrl && (
                        <a
                          href={selectedCapture.purchaseUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block", textDecoration: "none", textAlign: "center",
                            padding: "14px 16px", borderRadius: 14,
                            background: "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
                            color: "#FFFFFF", fontWeight: 700,
                          }}
                        >
                          구매 링크 열기
                        </a>
                      )}
                      {selectedCapture.relatedUrl && (
                        <a
                          href={selectedCapture.relatedUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block", textDecoration: "none", textAlign: "center",
                            padding: "14px 16px", borderRadius: 14,
                            backgroundColor: "#2D2D3A", color: "#FFFFFF", fontWeight: 600,
                          }}
                        >
                          관련 링크 열기
                        </a>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => handleShareCapture(selectedCapture)}
                    style={{
                      width: "100%", padding: "15px 16px", borderRadius: 14,
                      border: "1px solid #2D2D3A",
                      backgroundColor: copiedShareId === selectedCapture.id ? "#1E2D2A" : "#2D2D3A",
                      color: copiedShareId === selectedCapture.id ? "#00D4AA" : "#FFFFFF",
                      fontWeight: 600, cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {copiedShareId === selectedCapture.id ? "✓ 링크 복사됨!" : "🔗 공유 링크 복사"}
                  </button>
                  <button
                    onClick={() => startEditingCapture(selectedCapture)}
                    style={{
                      width: "100%", padding: "15px 16px", borderRadius: 14,
                      border: "1px solid #00D4AA55", backgroundColor: "#102A26",
                      color: "#00D4AA", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    수정하기
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("이 캡쳐를 삭제할까요?")) deleteCapture(selectedCapture.id);
                    }}
                    style={{
                      width: "100%", padding: "10px 16px", borderRadius: 14,
                      border: "1px solid #FF444433", backgroundColor: "transparent",
                      color: "#FF6666", fontSize: 12, cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
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
            src={lightboxUrl}
            alt="fullscreen"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 16,
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </div>
  );
}
