import type { Locale } from "@zootopia/shared-types";

import { cn } from "@/lib/utils";
import {
  PROTECTED_SIGNATURE_HEART,
  PROTECTED_SIGNATURE_LAPTOP,
  getProtectedSignatureCopy,
} from "@/lib/branding/protected-signature";

type ProtectedSignatureSealProps = {
  locale: Locale;
  className?: string;
  tone?: "shell" | "light" | "dark";
  variant?: "default" | "compact";
  textOverride?: string;
  showBadges?: boolean;
  showEyebrow?: boolean;
};

export function ProtectedSignatureSeal({
  locale,
  className,
  tone = "shell",
  variant = "default",
  textOverride,
  showBadges = true,
  showEyebrow = true,
}: ProtectedSignatureSealProps) {
  const signature = getProtectedSignatureCopy(locale);
  const signatureText = textOverride ?? signature.text;

  return (
    <section
      dir="rtl"
      className={cn(
        "protected-signature-seal",
        variant === "compact" && "protected-signature-seal--compact",
        tone === "light" && "protected-signature-seal--light",
        tone === "dark" && "protected-signature-seal--dark",
        className,
      )}
    >
      {/* This seal is the shared protected-app attribution surface.
          Detached preview/result file surfaces may override the rendered text, badge visibility,
          and eyebrow label visibility so export-facing signatures can remove file-only wording like
          "Platform Seal" without rewriting the broader protected-shell attribution source. */}
      {showBadges ? (
        <span aria-hidden="true" className="protected-signature-seal__badge">
          {PROTECTED_SIGNATURE_LAPTOP}
        </span>
      ) : null}
      <div className="protected-signature-seal__copy">
        {showEyebrow ? (
          <span className="protected-signature-seal__eyebrow">{signature.label}</span>
        ) : null}
        <p className="protected-signature-seal__text">{signatureText}</p>
      </div>
      {showBadges ? (
        <span
          aria-hidden="true"
          className="protected-signature-seal__badge protected-signature-seal__badge--heart"
        >
          {PROTECTED_SIGNATURE_HEART}
        </span>
      ) : null}
    </section>
  );
}
