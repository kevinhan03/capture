"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragType = "move" | "tl" | "tr" | "bl" | "br";

interface DragState {
  type: DragType;
  sx: number;
  sy: number;
  sb: CropBox;
}

interface Props {
  dataUrl: string;
  mimeType: string;
  onComplete: (croppedDataUrl: string) => void;
  onBack: () => void;
}

const HANDLE = 22;
const MIN_SIZE = 60;

export default function CropScreen({ dataUrl, mimeType, onComplete, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [box, setBox] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = () => {
      if (!containerRef.current) return;
      const { offsetWidth: cw, offsetHeight: ch } = containerRef.current;
      const pad = 40;
      setBox({ x: pad, y: pad, w: cw - pad * 2, h: ch - pad * 2 });
      setReady(true);
    };
    // Wait a frame for layout to settle
    requestAnimationFrame(init);
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  }, []);

  const startDrag = useCallback(
    (type: DragType) => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos(e);
      dragRef.current = { type, sx: pos.x, sy: pos.y, sb: { ...box } };
    },
    [box, getPos]
  );

  const onMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      e.preventDefault();
      const pos = getPos(e);
      const dx = pos.x - dragRef.current.sx;
      const dy = pos.y - dragRef.current.sy;
      const { sb, type } = dragRef.current;
      const cw = containerRef.current.offsetWidth;
      const ch = containerRef.current.offsetHeight;

      let { x, y, w, h } = sb;

      switch (type) {
        case "move":
          x = Math.max(0, Math.min(cw - w, sb.x + dx));
          y = Math.max(0, Math.min(ch - h, sb.y + dy));
          break;
        case "tl":
          x = Math.max(0, Math.min(sb.x + sb.w - MIN_SIZE, sb.x + dx));
          y = Math.max(0, Math.min(sb.y + sb.h - MIN_SIZE, sb.y + dy));
          w = sb.x + sb.w - x;
          h = sb.y + sb.h - y;
          break;
        case "tr":
          y = Math.max(0, Math.min(sb.y + sb.h - MIN_SIZE, sb.y + dy));
          w = Math.max(MIN_SIZE, Math.min(cw - sb.x, sb.w + dx));
          h = sb.y + sb.h - y;
          break;
        case "bl":
          x = Math.max(0, Math.min(sb.x + sb.w - MIN_SIZE, sb.x + dx));
          w = sb.x + sb.w - x;
          h = Math.max(MIN_SIZE, Math.min(ch - sb.y, sb.h + dy));
          break;
        case "br":
          w = Math.max(MIN_SIZE, Math.min(cw - sb.x, sb.w + dx));
          h = Math.max(MIN_SIZE, Math.min(ch - sb.y, sb.h + dy));
          break;
      }

      setBox({ x, y, w, h });
    },
    [getPos]
  );

  const stopDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  function handleComplete() {
    if (!containerRef.current || !imgRef.current) return;

    const img = imgRef.current;
    const cw = containerRef.current.offsetWidth;
    const ch = containerRef.current.offsetHeight;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    // object-fit: contain 기준으로 실제 이미지 렌더링 위치 계산
    const containerAspect = cw / ch;
    const imgAspect = naturalW / naturalH;

    let displayW: number, displayH: number, offsetX: number, offsetY: number;
    if (imgAspect > containerAspect) {
      displayW = cw;
      displayH = cw / imgAspect;
      offsetX = 0;
      offsetY = (ch - displayH) / 2;
    } else {
      displayH = ch;
      displayW = ch * imgAspect;
      offsetX = (cw - displayW) / 2;
      offsetY = 0;
    }

    const scaleX = naturalW / displayW;
    const scaleY = naturalH / displayH;

    const cropX = Math.max(0, (box.x - offsetX) * scaleX);
    const cropY = Math.max(0, (box.y - offsetY) * scaleY);
    const cropW = Math.min(naturalW - cropX, box.w * scaleX);
    const cropH = Math.min(naturalH - cropY, box.h * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, cropW);
    canvas.height = Math.max(1, cropH);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    onComplete(canvas.toDataURL(mimeType));
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "100dvh",
        backgroundColor: "#16161E",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      <style>{`
        .crop-header { display: flex; align-items: center; padding: 16px 20px; gap: 12px; flex-shrink: 0; }
        .crop-subtitle { text-align: center; padding: 0 20px; color: #888888; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; }
        .crop-btn-area { flex-shrink: 0; padding: 0 20px max(24px, env(safe-area-inset-bottom)); }
        .crop-btn-area button { width: 100%; padding: 15px 0; border-radius: 14px; background-color: #2D2D3A; border: none; color: #00D4AA; font-size: 15px; font-weight: 600; cursor: pointer; }

        @media (max-height: 700px) {
          .crop-header { padding: 10px 20px; }
          .crop-subtitle { padding: 0 20px; font-size: 12px; }
          .crop-btn-area { padding: 0 20px max(16px, env(safe-area-inset-bottom)); }
          .crop-btn-area button { padding: 12px 0; font-size: 14px; }
        }
        @media (max-height: 580px) {
          .crop-header { padding: 8px 20px; }
          .crop-subtitle { padding: 0 20px; font-size: 11px; }
          .crop-btn-area { padding: 0 20px max(10px, env(safe-area-inset-bottom)); }
          .crop-btn-area button { padding: 10px 0; font-size: 13px; border-radius: 12px; }
        }
      `}</style>

      {/* 헤더 */}
      <div className="crop-header">
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
          사진 자르기
        </span>
      </div>

      {/* 서브타이틀 */}
      <div className="crop-subtitle">

        <span style={{ fontSize: 14 }}>⊡</span>
        <span>분석할 영역을 조절하세요.</span>
      </div>

      {/* 이미지 + 크롭 영역 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          userSelect: "none",
          touchAction: "none",
        }}
        onMouseMove={onMove}
        onTouchMove={onMove}
        onMouseUp={stopDrag}
        onTouchEnd={stopDrag}
        onMouseLeave={stopDrag}
      >
        {/* 실제 이미지 컨테이너 (80% 크기) */}
        <div
          ref={containerRef}
          style={{
            width: "64%",
            height: "100%",
            position: "relative",
            overflow: "visible",
          }}
        >
        {/* 이미지 */}
        <img
          ref={imgRef}
          src={dataUrl}
          alt="crop target"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            pointerEvents: "none",
          }}
        />

        {/* 다크 오버레이 */}
        {ready && (
          <>
            {/* 상단 */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: box.y,
                backgroundColor: "rgba(0,0,0,0.65)",
                pointerEvents: "none",
              }}
            />
            {/* 하단 */}
            <div
              style={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                top: box.y + box.h,
                backgroundColor: "rgba(0,0,0,0.65)",
                pointerEvents: "none",
              }}
            />
            {/* 좌측 */}
            <div
              style={{
                position: "absolute",
                left: 0,
                width: box.x,
                top: box.y,
                height: box.h,
                backgroundColor: "rgba(0,0,0,0.65)",
                pointerEvents: "none",
              }}
            />
            {/* 우측 */}
            <div
              style={{
                position: "absolute",
                right: 0,
                left: box.x + box.w,
                top: box.y,
                height: box.h,
                backgroundColor: "rgba(0,0,0,0.65)",
                pointerEvents: "none",
              }}
            />

            {/* 크롭 박스 (이동 핸들) */}
            <div
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                cursor: "move",
                boxSizing: "border-box",
              }}
              onMouseDown={startDrag("move")}
              onTouchStart={startDrag("move")}
            />

            {/* 코너 핸들 - TL */}
            <div
              style={{
                position: "absolute",
                left: box.x - HANDLE / 2,
                top: box.y - HANDLE / 2,
                width: HANDLE,
                height: HANDLE,
                borderRadius: "50%",
                backgroundColor: "#00D4AA",
                cursor: "nw-resize",
                zIndex: 10,
              }}
              onMouseDown={startDrag("tl")}
              onTouchStart={startDrag("tl")}
            />
            {/* 코너 핸들 - TR */}
            <div
              style={{
                position: "absolute",
                left: box.x + box.w - HANDLE / 2,
                top: box.y - HANDLE / 2,
                width: HANDLE,
                height: HANDLE,
                borderRadius: "50%",
                backgroundColor: "#00D4AA",
                cursor: "ne-resize",
                zIndex: 10,
              }}
              onMouseDown={startDrag("tr")}
              onTouchStart={startDrag("tr")}
            />
            {/* 코너 핸들 - BL */}
            <div
              style={{
                position: "absolute",
                left: box.x - HANDLE / 2,
                top: box.y + box.h - HANDLE / 2,
                width: HANDLE,
                height: HANDLE,
                borderRadius: "50%",
                backgroundColor: "#00D4AA",
                cursor: "sw-resize",
                zIndex: 10,
              }}
              onMouseDown={startDrag("bl")}
              onTouchStart={startDrag("bl")}
            />
            {/* 코너 핸들 - BR */}
            <div
              style={{
                position: "absolute",
                left: box.x + box.w - HANDLE / 2,
                top: box.y + box.h - HANDLE / 2,
                width: HANDLE,
                height: HANDLE,
                borderRadius: "50%",
                backgroundColor: "#00D4AA",
                cursor: "se-resize",
                zIndex: 10,
              }}
              onMouseDown={startDrag("br")}
              onTouchStart={startDrag("br")}
            />
          </>
        )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="crop-btn-area">
        <button onClick={handleComplete}>분석하기</button>
      </div>
    </div>
  );
}
