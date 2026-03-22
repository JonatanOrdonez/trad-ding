"use client";

import { useEffect } from "react";

interface UseKeyboardOptions {
  onEscape?: () => void;
  onSlash?: () => void;
}

export function useKeyboard({ onEscape, onSlash }: UseKeyboardOptions) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Escape" && onEscape) {
        onEscape();
      }

      if (e.key === "/" && !isInput && onSlash) {
        e.preventDefault();
        onSlash();
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEscape, onSlash]);
}
