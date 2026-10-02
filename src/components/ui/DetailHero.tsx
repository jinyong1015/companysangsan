"use client";

import type { LucideIcon } from "lucide-react";

export type DetailHeroTone =
  | "grommet"
  | "seal"
  | "part"
  | "operator"
  | "equipment"
  | "mold"
  | "neutral";

export type DetailHeroChip = {
  label: string;
  value: string;
};

interface DetailHeroProps {
  eyebrow: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: DetailHeroTone;
  chips?: DetailHeroChip[];
}

function resolveTone(
  tone: DetailHeroTone | undefined,
  description?: string,
): DetailHeroTone {
  if (tone && tone !== "part" && tone !== "neutral") return tone;
  if (description?.includes("GROMMET")) return "grommet";
  if (description?.includes("SEAL")) return "seal";
  return tone ?? "neutral";
}

export function DetailHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "neutral",
  chips = [],
}: DetailHeroProps) {
  const resolved = resolveTone(tone, description);

  return (
    <header className="detail-hero mb-4" data-tone={resolved}>
      <div className="detail-hero-glow" aria-hidden />
      <div className="detail-hero-inner">
        <div className="detail-hero-main">
          <span className="detail-hero-icon" aria-hidden>
            <Icon size={22} strokeWidth={2.25} />
          </span>
          <div className="detail-hero-copy">
            <p className="detail-hero-eyebrow">{eyebrow}</p>
            <h1 className="detail-hero-title">{title}</h1>
            {description ? (
              <p className="detail-hero-desc">{description}</p>
            ) : null}
          </div>
        </div>
        {chips.length > 0 ? (
          <ul className="detail-hero-chips">
            {chips.map((chip) => (
              <li key={`${chip.label}-${chip.value}`} className="detail-hero-chip">
                <span className="detail-hero-chip-label">{chip.label}</span>
                <strong className="detail-hero-chip-value">{chip.value}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </header>
  );
}
