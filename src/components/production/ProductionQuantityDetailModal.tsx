"use client";

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";

export type QuantityDetailField = {
  label: string;
  value: string;
};

interface ProductionQuantityDetailModalProps {
  title: string;
  subtitle?: string;
  fields: QuantityDetailField[];
  primaryLabel: string;
  onPrimary: () => void;
  onClose: () => void;
}

export function ProductionQuantityDetailModal({
  title,
  subtitle,
  fields,
  primaryLabel,
  onPrimary,
  onClose,
}: ProductionQuantityDetailModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="ppq-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="ppq-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ppq-modal-head">
          <div>
            <h2 className="ppq-modal-title">{title}</h2>
            {subtitle ? <p className="ppq-modal-sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="ppq-modal-close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <dl className="ppq-modal-fields">
          {fields.map((f) => (
            <div key={f.label} className="ppq-modal-field">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="ppq-modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="btn btn-primary ppq-modal-go"
            onClick={onPrimary}
          >
            <ExternalLink size={15} aria-hidden />
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
