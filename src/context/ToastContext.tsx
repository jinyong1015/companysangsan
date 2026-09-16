"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "info" | "error";

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toasts: Toast[];
  pushToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [{ id, message, tone }, ...prev].slice(0, 3));
      const ms = tone === "success" ? 4000 : tone === "error" ? 8000 : 5000;
      window.setTimeout(() => dismissToast(id), ms);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              t.tone === "success"
                ? "border-[var(--success)]/30 bg-[var(--card)] text-[var(--success)]"
                : t.tone === "error"
                  ? "border-[var(--error)]/30 bg-[var(--card)] text-[var(--error)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{t.message}</p>
              <button
                type="button"
                className="text-[var(--text-secondary)]"
                aria-label="닫기"
                onClick={() => dismissToast(t.id)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
