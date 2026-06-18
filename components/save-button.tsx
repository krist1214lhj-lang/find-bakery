"use client";

import { useState } from "react";
import { useSavedBakeries } from "@/components/saved-bakeries-provider";

type SaveButtonProps = {
  bakeryId: string;
  bakeryName: string;
  variant?: "icon" | "action";
};

export function SaveButton({
  bakeryId,
  bakeryName,
  variant = "icon",
}: SaveButtonProps) {
  const { isSaved, ready, toggle } = useSavedBakeries();
  const [message, setMessage] = useState("");
  const saved = isSaved(bakeryId);
  const label = saved ? `${bakeryName} 저장 해제` : `${bakeryName} 저장`;

  function handleClick() {
    const result = toggle(bakeryId);
    setMessage(
      result.ok
        ? result.saved
          ? "가고 싶은 빵집에 저장했어요."
          : "저장을 해제했어요."
        : result.message,
    );
  }

  return (
    <span className={`save-control save-${variant}`}>
      <button
        aria-label={label}
        aria-pressed={saved}
        className={saved ? "is-saved" : undefined}
        disabled={!ready}
        onClick={handleClick}
        type="button"
      >
        {variant === "icon" ? (saved ? "♥" : "♡") : saved ? "저장됨" : "저장"}
      </button>
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
    </span>
  );
}
