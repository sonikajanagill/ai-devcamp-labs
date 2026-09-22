"use client";

// Drag handle for the CopilotKit sidebar's width. The sidebar is anchored to
// the right edge (see .copilotKitSidebar .copilotKitWindow in
// @copilotkit/react-ui), so widening it extends the panel leftward — this
// writes the new width to the --chat-width CSS var that globals.css's
// override rules read.

import { useCallback, useEffect, useRef } from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH_FRACTION = 0.85; // never let the chat swallow the whole page
const DEFAULT_WIDTH = 448; // 28rem — CopilotKit's own default
const STORAGE_KEY = "social-spark-chat-width";

function clampWidth(width: number): number {
  const max = Math.min(window.innerWidth - 80, window.innerWidth * MAX_WIDTH_FRACTION);
  return Math.min(Math.max(width, MIN_WIDTH), Math.max(max, MIN_WIDTH));
}

function setChatWidth(px: number) {
  document.documentElement.style.setProperty("--chat-width", `${px}px`);
}

export function ChatResizeHandle({ visible }: { visible: boolean }) {
  const draggingRef = useRef(false);

  // Restore the last width the user dragged to (per-browser convenience;
  // never required for the app to work correctly).
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      setChatWidth(saved > 0 ? clampWidth(saved) : DEFAULT_WIDTH);
    } catch {
      setChatWidth(DEFAULT_WIDTH);
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      setChatWidth(clampWidth(window.innerWidth - e.clientX));
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        const current = getComputedStyle(document.documentElement).getPropertyValue(
          "--chat-width",
        );
        localStorage.setItem(STORAGE_KEY, current.trim().replace("px", ""));
      } catch {
        // private-mode / storage disabled — resizing still works this session
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="chat-resize-handle"
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat panel"
    />
  );
}
