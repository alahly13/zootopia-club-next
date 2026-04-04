"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

type AssessmentFileFooterProps = {
  footerLine: {
    leadingEmoji: string;
    text: string;
    trailingEmoji: string;
  };
  pageNumber: number;
  sealAssetUrl: string;
  themeMode: "light" | "dark";
  className?: string;
};

export function AssessmentFileFooter({
  footerLine,
  pageNumber,
  sealAssetUrl,
  themeMode,
  className,
}: AssessmentFileFooterProps) {
  const dark = themeMode === "dark";

  return (
    <footer
      className={cn(
        "mt-auto flex items-center gap-3 rounded-[1.35rem] border px-4 py-3",
        dark
          ? "border-emerald-200/15 bg-[linear-gradient(180deg,rgba(4,13,27,0.97),rgba(3,10,22,0.92))] text-white shadow-[inset_0_0_0_1px_rgba(94,234,212,0.12),0_12px_28px_rgba(1,4,14,0.18)]"
          : "border-emerald-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,251,249,0.82))] text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,118,110,0.08),0_10px_22px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {/* This shared file footer keeps the left seal, centered Arabic attribution line, and
          right page-number arc on one baseline so detached preview pages and paged exports stay
          visually aligned instead of drifting into separate footer treatments. */}
      <span
        className={cn(
          "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border",
          dark
            ? "border-emerald-200/20 bg-white/[0.055]"
            : "border-emerald-700/12 bg-white/80",
        )}
      >
        <Image
          src={sealAssetUrl}
          alt=""
          fill
          sizes="64px"
          className="object-contain p-1.5"
        />
      </span>

      <div className="min-w-0 flex-1 text-center" dir="rtl">
        <p
          className={cn(
            "inline-flex flex-wrap items-center justify-center gap-1.5 text-center text-[0.74rem] font-semibold leading-6 md:flex-nowrap",
            dark ? "text-white/88" : "text-slate-800/90",
          )}
        >
          <span className="shrink-0">{footerLine.leadingEmoji}</span>
          <span>{footerLine.text}</span>
          <span className="shrink-0">{footerLine.trailingEmoji}</span>
        </p>
      </div>

      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 64 64"
          className="absolute inset-0 h-full w-full"
        >
          <circle
            cx="32"
            cy="32"
            r="23"
            fill="none"
            stroke={dark ? "rgba(220,255,249,0.92)" : "#0f766e"}
            strokeWidth="3"
            strokeDasharray="111 35"
            strokeLinecap="round"
            transform="rotate(-136 32 32)"
          />
        </svg>
        <span
          className={cn(
            "relative text-sm font-black tracking-[0.14em]",
            dark ? "text-emerald-50" : "text-emerald-700",
          )}
        >
          {pageNumber}
        </span>
      </span>
    </footer>
  );
}
