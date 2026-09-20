"use client";

import type { AnalysisGroupBundle } from "@/lib/analysisGroups";
import { clsx, formatNumber, formatPercent, formatQuantity } from "@/lib/format";

type Props = {
  bundle: AnalysisGroupBundle;
};

function InlineBar({
  percent,
  color,
  alert,
}: {
  percent: number;
  color: string;
  alert?: boolean;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="mt-1.5 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${width}%`,
          background: alert ? "var(--error)" : color,
        }}
      />
    </div>
  );
}

export function AnalysisGroupComparison({ bundle }: Props) {
  const { total, groups } = bundle;
  const maxDefectRate = Math.max(
    0,
    ...groups.map((g) => g.kpi.defectRatePercent ?? 0),
    total.defectRatePercent ?? 0,
  );

  return (
    <section className="card mb-4 p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold">분석 그룹 비교</h2>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          오류 제외 유효 DATA · SEAL / GROMMET 비교
        </p>
      </div>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--border)]"
        role="img"
        aria-label="생산량 그룹 비중"
      >
        {groups.map((g) =>
          g.productionSharePercent > 0 ? (
            <div
              key={g.id}
              style={{
                width: `${g.productionSharePercent}%`,
                background: g.color,
              }}
              title={`${g.label} ${formatNumber(g.productionSharePercent, 1)}%`}
            />
          ) : null,
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {groups.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]"
          >
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: g.color }}
              aria-hidden
            />
            <span className="text-[var(--text)]">{g.label}</span>
            <span className="font-medium text-[var(--text)]">
              {formatNumber(g.productionSharePercent, 1)}%
            </span>
          </span>
        ))}
        <span className="ml-auto text-[var(--text-secondary)]">
          합계{" "}
          <span className="font-semibold text-[var(--text)]">
            {formatNumber(total.productionQuantity)}
          </span>
        </span>
      </div>

      <div className="table-wrap mt-5">
        <table className="data-table">
          <thead>
            <tr>
              <th>그룹</th>
              <th className="num">생산량</th>
              <th className="num">불량률</th>
              <th className="num">불량수량</th>
              <th className="num">가동률</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="font-semibold">전체</span>
              </td>
              <td className="num">
                <div className="flex flex-col items-end">
                  <span className="font-medium">
                    {formatQuantity(total.productionQuantity)}
                  </span>
                  <InlineBar percent={100} color="var(--text-secondary)" />
                </div>
              </td>
              <td className="num">
                <div className="flex flex-col items-end">
                  <span>{formatPercent(total.defectRatePercent, 2)}</span>
                  <InlineBar
                    percent={
                      maxDefectRate > 0
                        ? ((total.defectRatePercent ?? 0) / maxDefectRate) * 100
                        : 0
                    }
                    color="var(--metric-defect)"
                  />
                </div>
              </td>
              <td className="num">{formatQuantity(total.defectQuantity)}</td>
              <td className="num">
                {formatPercent(total.utilizationRatePercent)}
              </td>
            </tr>

            {groups.map((g) => {
              const rateAlert = g.defectRateAboveTotal;
              return (
                <tr key={g.id}>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ background: g.color }}
                        aria-hidden
                      />
                      <span className="font-medium">{g.label}</span>
                      {rateAlert ? (
                        <span className="rounded-md bg-[var(--error)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--error)]">
                          불량률↑
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="num">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">
                        {formatQuantity(g.kpi.productionQuantity)}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {formatNumber(g.productionSharePercent, 1)}%
                      </span>
                      <InlineBar
                        percent={g.productionSharePercent}
                        color={g.color}
                      />
                    </div>
                  </td>
                  <td className="num">
                    <div className="flex flex-col items-end">
                      <span
                        className={clsx(
                          "font-medium",
                          rateAlert && "text-[var(--error)]",
                        )}
                      >
                        {formatPercent(g.kpi.defectRatePercent, 2)}
                      </span>
                      <InlineBar
                        percent={
                          maxDefectRate > 0
                            ? ((g.kpi.defectRatePercent ?? 0) / maxDefectRate) *
                              100
                            : 0
                        }
                        color={g.color}
                        alert={rateAlert}
                      />
                    </div>
                  </td>
                  <td className="num">
                    {formatQuantity(g.kpi.defectQuantity)}
                  </td>
                  <td className="num">
                    {formatPercent(g.kpi.utilizationRatePercent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
