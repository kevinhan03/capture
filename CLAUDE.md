# CLAUDE.md — SNAPY 프로젝트

## 프로젝트 개요

**SNAPY**는 쇼핑 이미지를 캡쳐하면 AI가 자동으로 상품 정보를 추출해 스크랩북처럼 저장하는 Next.js 웹앱이다.

- 사용자가 이미지를 업로드 → 크롭 → Gemini AI 분석 → 태그 선택 → Supabase에 저장
- 저장된 캡쳐를 그리드로 보여주며 카테고리 필터링 및 상세 모달 제공

---

## 기술 스택

| 역할 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript |
| 스타일 | Inline styles (CSS-in-JS 없음, Tailwind 없음) |
| AI 분석 | Google Gemini 2.5 Flash API |
| DB / Auth / Storage | Supabase (PostgreSQL + Storage) |
| 배포 | Vercel |

---

## 파일 구조

```
src/
├── app/
│   ├── page.tsx          # 메인 페이지 (홈 화면, 카드 그리드, 모달)
│   ├── layout.tsx        # 루트 레이아웃
│   ├── auth/page.tsx     # 로그인/회원가입 페이지
│   └── api/
│       └── analyze/route.ts  # POST /api/analyze — Gemini 호출 엔드포인트
├── components/
│   ├── CropScreen.tsx    # 이미지 크롭 화면
│   └── ResultScreen.tsx  # AI 분석 결과 + 태그 선택 화면
└── lib/
    ├── gemini.ts         # Gemini API 클라이언트 (exponential backoff 포함)
    └── supabase.ts       # Supabase 브라우저 클라이언트
```

---

## 핵심 데이터 흐름

1. `page.tsx` → 파일 선택 → `CropScreen` → `analyze()` → `/api/analyze`
2. `/api/analyze` → `analyzeShoppingImage()` (gemini.ts) → `ShoppingItem` 반환
3. `ResultScreen` → 태그 선택 → `handleSave()` → Supabase Storage + DB 저장
4. `loadCaptures()` → Supabase `captures` 테이블 조회 → 카드 그리드 렌더링

---

## Supabase 테이블 스키마 (`captures`)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | auth.users FK |
| `preview` | text | Supabase Storage signed URL (10년) |
| `brand` | text | 브랜드명 (없으면 "미상") |
| `item_name` | text | 상품명 |
| `price` | text | 가격 (없으면 "미정") |
| `style_keywords` | text[] | 스타일 키워드 배열 |
| `tags` | text[] | 저장 이유 태그 배열 |
| `purchase_url` | text | 구매 링크 |
| `related_url` | text | 관련 링크 |
| `created_at` | timestamptz | 생성 시각 |

---

## 태그 시스템 (저장 이유 카테고리)

`ResultScreen.tsx`의 `TAGS` 배열 기준. `tags` 컬럼에는 label 문자열이 저장된다.

| id | icon | label |
|---|---|---|
| buy | 🛍️ | 살까말까 |
| outfit | ✨ | 코디 영감 |
| gift | 🎁 | 선물용 |
| interior | 🏠 | 인테리어 |
| sale | ⏰ | 할인 대기 |
| color | 🎨 | 컬러 참고 |
| fit | 🏷️ | 핏/사이즈 |
| brand | 🔖 | 브랜드 기억 |
| custom | ✏️ | 직접 입력 |

카테고리 필터 바는 `page.tsx`에서 `captures` 데이터를 기반으로 동적으로 생성된다.

---

## 환경 변수

`.env.local`에 설정 필요:

```
GEMINI_API_KEY=                  # Google AI Studio
NEXT_PUBLIC_SUPABASE_URL=        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
```

---

## 개발 명령어

```bash
npm run dev    # 개발 서버 (localhost:3000)
npm run build  # 프로덕션 빌드
npm run lint   # ESLint 검사
```

---

## 스타일 관련 주의사항

- **모든 스타일은 inline style**로 작성한다. Tailwind나 CSS 모듈을 사용하지 않는다.
- 기본 배경색: `#16161E`, 카드 배경: `#1E1E2A`, 보조 배경: `#2D2D3A`
- 브랜드 컬러(강조): `#00D4AA` (민트/초록), 에러: `#FF4444`
- 최대 너비: `480px` (모바일 우선 디자인)

---

## Gemini API 주의사항

- `gemini.ts`는 429 및 5xx 응답에 대해 최대 5회 exponential backoff 재시도를 한다.
- 모델: `gemini-2.5-flash`
- 응답은 JSON schema로 강제(`response_mime_type: "application/json"`)하여 파싱 안정성을 보장한다.
