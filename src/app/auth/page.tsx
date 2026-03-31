"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type AuthMode = "login" | "signup";

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #2D2D3A",
  backgroundColor: "#16161E",
  color: "#FFFFFF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box" as const,
};

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signup") {
      if (form.password !== form.confirmPassword) {
        setMessage({ text: "비밀번호가 일치하지 않습니다.", isError: true });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name },
        },
      });

      if (error) {
        setMessage({ text: error.message, isError: true });
      } else {
        setMessage({
          text: "가입 완료! 이메일을 확인해 인증 링크를 클릭해주세요.",
          isError: false,
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        setMessage({ text: "이메일 또는 비밀번호가 올바르지 않습니다.", isError: true });
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(0, 212, 170, 0.18), transparent 34%), #101018",
        padding: "24px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <Link
            href="/"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: "#1E1E2A",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              fontSize: 18,
            }}
          >
            ←
          </Link>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>SNAPY</div>
            <div style={{ fontSize: 12, color: "#8B90A0", marginTop: 2 }}>
              계정으로 캡처를 이어서 관리하세요
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#1A1A24",
            border: "1px solid #2A2A38",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 18px 48px rgba(0, 0, 0, 0.24)",
          }}
        >
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
              {mode === "login" ? "로그인" : "회원가입"}
            </div>
            <div style={{ fontSize: 14, color: "#9AA0AF", marginTop: 8, lineHeight: 1.5 }}>
              {mode === "login"
                ? "저장한 사진 카드와 링크를 다시 불러오려면 계정이 필요합니다."
                : "새 계정을 만들고 캡처 카드, 태그, 링크를 내 계정에 저장하세요."}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              backgroundColor: "#13131B",
              padding: 6,
              borderRadius: 16,
              marginBottom: 20,
            }}
          >
            <button
              onClick={() => { setMode("login"); setMessage(null); }}
              style={{
                padding: "12px 0",
                borderRadius: 12,
                border: "none",
                backgroundColor: mode === "login" ? "#00D4AA" : "transparent",
                color: mode === "login" ? "#0F1720" : "#98A0B3",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              로그인
            </button>
            <button
              onClick={() => { setMode("signup"); setMessage(null); }}
              style={{
                padding: "12px 0",
                borderRadius: 12,
                border: "none",
                backgroundColor: mode === "signup" ? "#00D4AA" : "transparent",
                color: mode === "signup" ? "#0F1720" : "#98A0B3",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#AAB1C3" }}>이름</span>
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="이름을 입력하세요"
                  style={inputStyle}
                />
              </label>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#AAB1C3" }}>이메일</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="name@example.com"
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#AAB1C3" }}>비밀번호</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                style={inputStyle}
              />
            </label>

            {mode === "signup" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#AAB1C3" }}>비밀번호 확인</span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  style={inputStyle}
                />
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                padding: "15px 16px",
                borderRadius: 16,
                border: "none",
                background: loading ? "#2D2D3A" : "linear-gradient(135deg, #00D4AA 0%, #0099CC 100%)",
                color: loading ? "#666" : "#FFFFFF",
                fontSize: 15,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "처리 중..." : mode === "login" ? "로그인 계속하기" : "회원가입 완료하기"}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 14,
                backgroundColor: message.isError ? "#2E1A1A" : "#132E29",
                border: `1px solid ${message.isError ? "#FF444433" : "#00D4AA33"}`,
                color: message.isError ? "#FF8888" : "#CCF8F0",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
