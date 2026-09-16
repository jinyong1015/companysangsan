"use client";

import Link from "next/link";

export type TopRankCardItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

export function TopRankCards({ items }: { items: TopRankCardItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
        표시할 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const className =
          "block w-full rounded-xl bg-[color-mix(in_srgb,var(--app-bg)_70%,transparent)] px-3 py-2.5 text-left transition hover:bg-[var(--accent-soft)]";

        const body = (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text)]">
              {item.title}
            </p>
            <p className="num mt-0.5 truncate text-xs text-[var(--text-secondary)]">
              {item.detail}
            </p>
          </div>
        );

        if (item.href) {
          return (
            <Link key={item.id} href={item.href} className={className}>
              {body}
            </Link>
          );
        }

        return (
          <div key={item.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
