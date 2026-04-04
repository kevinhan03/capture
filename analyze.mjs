import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = "playwright-analysis";
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const findings = [];
function note(category, severity, message) {
  findings.push({ category, severity, message });
}

const browser = await chromium.launch();

// ── 1. 모바일 (iPhone 12 기준) ────────────────────────────────────────────
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
});
const mPage = await mobile.newPage();

// 콘솔 에러 수집
const consoleErrors = [];
mPage.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
const pageErrors = [];
mPage.on("pageerror", (err) => pageErrors.push(err.message));

await mPage.goto(BASE_URL, { waitUntil: "networkidle" });
await mPage.screenshot({ path: `${OUT_DIR}/01_mobile_home.png`, fullPage: true });

// 헤더 높이
const headerH = await mPage.evaluate(() => document.querySelector("header")?.offsetHeight ?? 0);
note("레이아웃", headerH > 80 ? "warning" : "ok", `헤더 높이: ${headerH}px`);

// 터치 타겟 크기 검사 (버튼/a 태그 40px 미만)
const smallTargets = await mPage.evaluate(() => {
  const els = [...document.querySelectorAll("button, a")];
  return els
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, text: el.textContent?.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
    })
    .filter((t) => t.w > 0 && t.h > 0 && (t.w < 40 || t.h < 40));
});
if (smallTargets.length > 0) {
  note("접근성", "warning", `터치 타겟 40px 미만: ${JSON.stringify(smallTargets)}`);
} else {
  note("접근성", "ok", "모든 터치 타겟 크기 적절");
}

// 텍스트 가독성 (12px 미만 폰트)
const tinyTexts = await mPage.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const results = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const style = window.getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    if (size > 0 && size < 12 && el.textContent?.trim()) {
      results.push({ tag: el.tagName, text: el.textContent.trim().slice(0, 30), size });
    }
  }
  return [...new Map(results.map((r) => [r.text, r])).values()].slice(0, 10);
});
if (tinyTexts.length > 0) {
  note("가독성", "warning", `12px 미만 텍스트: ${JSON.stringify(tinyTexts)}`);
} else {
  note("가독성", "ok", "모든 텍스트 12px 이상");
}

// 수평 스크롤 여부
const hasHScroll = await mPage.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth
);
note("레이아웃", hasHScroll ? "error" : "ok", hasHScroll ? "수평 스크롤 발생 (레이아웃 오버플로우)" : "수평 스크롤 없음");

// 이미지 alt 속성
const missingAlt = await mPage.evaluate(() =>
  [...document.querySelectorAll("img")].filter((i) => !i.alt).map((i) => i.src.slice(0, 60))
);
if (missingAlt.length > 0) {
  note("접근성", "warning", `alt 없는 이미지 ${missingAlt.length}개`);
} else {
  note("접근성", "ok", "모든 이미지 alt 속성 있음");
}

// 빈 상태 화면 스크린샷 (로그인 안 된 상태)
await mPage.screenshot({ path: `${OUT_DIR}/02_mobile_empty_state.png` });

// ── 2. 로그인 페이지 ────────────────────────────────────────────────────────
await mPage.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
await mPage.screenshot({ path: `${OUT_DIR}/03_auth_page.png`, fullPage: true });

const inputsFocusVisible = await mPage.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  return inputs.map((inp) => ({
    type: inp.type,
    placeholder: inp.placeholder,
    hasFocusStyle: inp.style.outline !== "none" || inp.className.includes("focus"),
  }));
});
note("UX", "info", `로그인 폼 input: ${JSON.stringify(inputsFocusVisible)}`);

// ── 3. 데스크탑 뷰 ─────────────────────────────────────────────────────────
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dPage = await desktop.newPage();
await dPage.goto(BASE_URL, { waitUntil: "networkidle" });
await dPage.screenshot({ path: `${OUT_DIR}/04_desktop_home.png`, fullPage: true });

const desktopW = await dPage.evaluate(() => {
  const main = document.querySelector("div[style]");
  return main?.getBoundingClientRect().width ?? 0;
});
note("레이아웃", desktopW > 500 ? "warning" : "ok",
  `데스크탑에서 컨테이너 폭: ${Math.round(desktopW)}px (maxWidth 480px 설정 확인)`);

// 배경 색상 확인 (양옆 빈 공간)
const bodyBg = await dPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
note("디자인", "info", `body 배경색: ${bodyBg} (데스크탑 양옆 여백 색상)`);

// ── 4. 네비게이션 인터랙션 테스트 ─────────────────────────────────────────
await mPage.goto(BASE_URL, { waitUntil: "networkidle" });

// + 버튼 클릭 (비로그인)
const addBtn = mPage.locator("button").filter({ hasText: "+" });
if (await addBtn.count() > 0) {
  await addBtn.click();
  await mPage.waitForTimeout(500);
  const errorVisible = await mPage.locator("text=캡쳐를 저장하려면").isVisible();
  note("UX", errorVisible ? "ok" : "warning", "+ 버튼 비로그인 클릭 → 에러 메시지 표시: " + errorVisible);
  await mPage.screenshot({ path: `${OUT_DIR}/05_add_without_login.png` });
}

// 검색 버튼 클릭
const searchBtn = mPage.locator("button").filter({ hasText: "🔍" });
if (await searchBtn.count() > 0) {
  await searchBtn.click();
  await mPage.waitForTimeout(400);
  const searchBarVisible = await mPage.locator("input[placeholder]").isVisible();
  note("UX", searchBarVisible ? "ok" : "warning", "검색 버튼 클릭 → 검색바 표시: " + searchBarVisible);
  await mPage.screenshot({ path: `${OUT_DIR}/06_search_open.png` });
}

// ── 5. 성능 지표 ────────────────────────────────────────────────────────────
const perfPage = await mobile.newPage();
await perfPage.goto(BASE_URL, { waitUntil: "load" });
const perf = await perfPage.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const paint = performance.getEntriesByType("paint");
  return {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
    fcp: Math.round(paint.find((p) => p.name === "first-contentful-paint")?.startTime ?? 0),
  };
});
note("성능", perf.fcp < 1800 ? "ok" : "warning", `FCP: ${perf.fcp}ms`);
note("성능", perf.domContentLoaded < 2000 ? "ok" : "warning", `DOMContentLoaded: ${perf.domContentLoaded}ms`);
note("성능", perf.loadComplete < 3000 ? "ok" : "warning", `Load: ${perf.loadComplete}ms`);

// ── 콘솔 에러 ───────────────────────────────────────────────────────────────
if (consoleErrors.length > 0) {
  note("코드", "error", `콘솔 에러 ${consoleErrors.length}건: ${consoleErrors.slice(0, 3).join(" | ")}`);
} else {
  note("코드", "ok", "콘솔 에러 없음");
}
if (pageErrors.length > 0) {
  note("코드", "error", `페이지 에러: ${pageErrors.slice(0, 3).join(" | ")}`);
}

await browser.close();

// ── 결과 출력 ────────────────────────────────────────────────────────────────
const icons = { ok: "✅", warning: "⚠️", error: "❌", info: "ℹ️" };
console.log("\n====== SNAPY 사이트 분석 결과 ======\n");
for (const f of findings) {
  console.log(`${icons[f.severity] ?? "•"} [${f.category}] ${f.message}`);
}
console.log("\n스크린샷 저장 위치:", OUT_DIR);
