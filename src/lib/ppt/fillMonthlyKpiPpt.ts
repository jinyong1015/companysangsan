import JSZip from "jszip";
import {
  syncDailyQtyEmbedding,
  syncDowntimeCompareEmbedding,
  syncMonthlyTrendEmbedding,
  syncRankEmbedding,
} from "@/lib/ppt/chartEmbeddings";
import {
  EFFICIENCY_TOP5_PLOT,
  getChartTargetsOrderedOnSlide,
  unifyPairedChartLayouts,
} from "@/lib/ppt/ooxml";
import {
  EXCLUDED_SLIDE_NUMBERS,
  removeExcludedSlides,
} from "@/lib/ppt/removeSlides";
import {
  applyDailyQtyChart,
  applyDowntimeCompareChart,
  applyMonthlyTrendChart,
  applyRankChart,
  applySlide1,
  applySlide10,
  applySlide11,
  applySlide13,
  applySlide14,
  applySlide15,
  applySlide16,
  applySlide17,
  applySlide18,
  applySlide19,
  applySlide2,
  applySlide22,
  applySlide23,
  applySlide3,
  applySlide4,
  applySlide5,
  applySlide6,
  applySlide7,
  applySlide8,
  applySlide9,
} from "@/lib/ppt/slideMaps";
import type { MonthlyKpiPptSnapshot } from "@/lib/ppt/types";

const TEMPLATE_URL = "/templates/monthly-kpi-report.pptx";

type SlideApplier = (
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
) => string;

const SLIDE_APPLIERS: Record<number, SlideApplier> = {
  1: applySlide1,
  2: applySlide2,
  3: applySlide3,
  4: applySlide4,
  5: applySlide5,
  6: applySlide6,
  7: applySlide7,
  8: applySlide8,
  9: applySlide9,
  10: applySlide10,
  11: applySlide11,
  13: applySlide13,
  14: applySlide14,
  15: applySlide15,
  16: applySlide16,
  17: applySlide17,
  18: applySlide18,
  19: applySlide19,
  22: applySlide22,
  23: applySlide23,
};

const EXCLUDED = new Set<number>(EXCLUDED_SLIDE_NUMBERS);

async function loadTemplateZip(): Promise<JSZip> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(`템플릿을 불러오지 못했습니다. (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return JSZip.loadAsync(buf);
}

async function mutateChart(
  zip: JSZip,
  file: string,
  mutate: (xml: string) => string,
): Promise<void> {
  const path = `ppt/charts/${file}`;
  const entry = zip.file(path);
  if (!entry) return;
  const xml = await entry.async("string");
  zip.file(path, mutate(xml));
}

async function applySlideCharts(
  zip: JSZip,
  snapshot: MonthlyKpiPptSnapshot,
  slideNum: number,
  chartFiles: string[],
): Promise<void> {
  const gTrend = snapshot.monthlyTrends.GROMMET;
  const sTrend = snapshot.monthlyTrends.SEAL;
  const gProd = snapshot.productionTrends.GROMMET;
  const sProd = snapshot.productionTrends.SEAL;

  switch (slideNum) {
    case 6:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyMonthlyTrendChart(
            xml,
            gTrend.labels,
            gTrend.downtimeMinutes,
            "비가동 현황",
            {
              valueDigits: 0,
              hideLastPointLabel: true,
              highlightIndex: gTrend.queryMonthIndex,
              hideZeroValueLabels: true,
            },
          ),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[0],
          gTrend.labels,
          gTrend.downtimeMinutes,
          "비가동 현황",
        );
      }
      break;
    case 7:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyDowntimeCompareChart(xml, snapshot, "GROMMET"),
        );
        await syncDowntimeCompareEmbedding(
          zip,
          chartFiles[0],
          snapshot,
          "GROMMET",
        );
      }
      break;
    case 8:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyMonthlyTrendChart(
            xml,
            sTrend.labels,
            sTrend.downtimeMinutes,
            "비가동 현황",
            {
              valueDigits: 0,
              hideLastPointLabel: true,
              highlightIndex: sTrend.queryMonthIndex,
              hideZeroValueLabels: true,
            },
          ),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[0],
          sTrend.labels,
          sTrend.downtimeMinutes,
          "비가동 현황",
        );
      }
      break;
    case 9:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyDowntimeCompareChart(xml, snapshot, "SEAL"),
        );
        await syncDowntimeCompareEmbedding(
          zip,
          chartFiles[0],
          snapshot,
          "SEAL",
        );
      }
      break;
    case 10:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyDailyQtyChart(
            xml,
            snapshot.dailyProduction.GROMMET.days,
            snapshot.dailyProduction.GROMMET.quantities,
          ),
        );
        await syncDailyQtyEmbedding(
          zip,
          chartFiles[0],
          snapshot.dailyProduction.GROMMET.days,
          snapshot.dailyProduction.GROMMET.quantities,
        );
      }
      break;
    case 11:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyDailyQtyChart(
            xml,
            snapshot.dailyProduction.SEAL.days,
            snapshot.dailyProduction.SEAL.quantities,
          ),
        );
        await syncDailyQtyEmbedding(
          zip,
          chartFiles[0],
          snapshot.dailyProduction.SEAL.days,
          snapshot.dailyProduction.SEAL.quantities,
        );
      }
      break;
    case 13: {
      // 실수량(EA) — 천 단위로 나누지 않음 (9,503,400 전체가 보이도록)
      const gQty = gProd.productionQuantity.map((v) =>
        Number.isFinite(v) ? Math.round(v) : Number.NaN,
      );
      const sQty = sProd.productionQuantity.map((v) =>
        Number.isFinite(v) ? Math.round(v) : Number.NaN,
      );
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyMonthlyTrendChart(xml, gProd.labels, gQty, "생산수량", {
            axisMin: 0,
            valueDigits: 0,
            clearDisplayUnits: true,
            hideLastPointLabel: true,
            highlightIndex: gProd.queryMonthIndex,
            hideZeroValueLabels: true,
            niceScale: true,
            unitToEa: true,
            padLargeAxisLabels: true,
            labelOnTop: true,
          }),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[0],
          gProd.labels,
          gQty,
          "생산수량",
        );
      }
      if (chartFiles[1]) {
        await mutateChart(zip, chartFiles[1], (xml) =>
          applyMonthlyTrendChart(xml, sProd.labels, sQty, "생산수량", {
            axisMin: 0,
            valueDigits: 0,
            clearDisplayUnits: true,
            hideLastPointLabel: true,
            highlightIndex: sProd.queryMonthIndex,
            hideZeroValueLabels: true,
            niceScale: true,
            unitToEa: true,
            padLargeAxisLabels: true,
            labelOnTop: true,
          }),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[1],
          sProd.labels,
          sQty,
          "생산수량",
        );
      }
      break;
    }
    case 14:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyMonthlyTrendChart(
            xml,
            gProd.labels,
            gProd.partKindCount,
            "작업품목 종류",
            {
              axisMin: 0,
              valueDigits: 0,
              clearDisplayUnits: true,
              hideLastPointLabel: true,
              highlightIndex: gProd.queryMonthIndex,
              hideZeroValueLabels: true,
              niceScale: true,
              labelOnTop: true,
            },
          ),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[0],
          gProd.labels,
          gProd.partKindCount,
          "작업품목 종류",
        );
      }
      if (chartFiles[1]) {
        await mutateChart(zip, chartFiles[1], (xml) =>
          applyMonthlyTrendChart(
            xml,
            sProd.labels,
            sProd.partKindCount,
            "작업품목 종류",
            {
              axisMin: 0,
              valueDigits: 0,
              clearDisplayUnits: true,
              hideLastPointLabel: true,
              highlightIndex: sProd.queryMonthIndex,
              hideZeroValueLabels: true,
              niceScale: true,
              labelOnTop: true,
            },
          ),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[1],
          sProd.labels,
          sProd.partKindCount,
          "작업품목 종류",
        );
      }
      break;
    case 15:
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyMonthlyTrendChart(
            xml,
            gProd.labels,
            gProd.avgShot,
            "평균 SHOT(Hr)",
            {
              axisMin: 0,
              valueDigits: 1,
              clearDisplayUnits: true,
              hideLastPointLabel: true,
              highlightIndex: gProd.queryMonthIndex,
              hideZeroValueLabels: true,
              niceScale: true,
              labelOnTop: true,
            },
          ),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[0],
          gProd.labels,
          gProd.avgShot,
          "평균 SHOT(Hr)",
        );
      }
      if (chartFiles[1]) {
        await mutateChart(zip, chartFiles[1], (xml) =>
          applyMonthlyTrendChart(
            xml,
            sProd.labels,
            sProd.avgShot,
            "평균 SHOT(Hr)",
            {
              axisMin: 0,
              valueDigits: 1,
              clearDisplayUnits: true,
              hideLastPointLabel: true,
              highlightIndex: sProd.queryMonthIndex,
              hideZeroValueLabels: true,
              niceScale: true,
              labelOnTop: true,
            },
          ),
        );
        await syncMonthlyTrendEmbedding(
          zip,
          chartFiles[1],
          sProd.labels,
          sProd.avgShot,
          "평균 SHOT(Hr)",
        );
      }
      break;
    case 16:
    case 17: {
      const rows =
        slideNum === 16
          ? snapshot.partQtyTop.GROMMET
          : snapshot.partQtyTop.SEAL;
      // 상단=생산수량, 하단=생산금액(데이터 없음)
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyRankChart(xml, rows, { maxPoints: 10 }),
        );
        await syncRankEmbedding(zip, chartFiles[0], rows);
      }
      if (chartFiles[1]) {
        await mutateChart(zip, chartFiles[1], (xml) =>
          applyRankChart(xml, [], { maxPoints: 10, blank: true }),
        );
        await syncRankEmbedding(
          zip,
          chartFiles[1],
          Array.from({ length: 10 }, () => ({ name: "-", value: 0 })),
        );
      }
      break;
    }
    case 18:
    case 19: {
      const rows =
        slideNum === 18
          ? snapshot.operatorQtyTop.GROMMET
          : snapshot.operatorQtyTop.SEAL;
      // 상단=생산수량, 하단=생산금액(데이터 없음)
      if (chartFiles[0]) {
        await mutateChart(zip, chartFiles[0], (xml) =>
          applyRankChart(xml, rows, { maxPoints: 10 }),
        );
        await syncRankEmbedding(zip, chartFiles[0], rows);
      }
      if (chartFiles[1]) {
        await mutateChart(zip, chartFiles[1], (xml) =>
          applyRankChart(xml, [], { maxPoints: 10, blank: true }),
        );
        await syncRankEmbedding(
          zip,
          chartFiles[1],
          Array.from({ length: 10 }, () => ({ name: "-", value: 0 })),
        );
      }
      break;
    }
    case 22:
    case 23: {
      const eff =
        slideNum === 22
          ? snapshot.efficiency.GROMMET
          : snapshot.efficiency.SEAL;
      // 좌=작업시간 TOP5, 우=비가동 TOP5 — 세로 막대 나란히 + 품명 전체 표시
      const rankOpts = {
        maxPoints: 5,
        barDirection: "col" as const,
        // 막대 간격 적당히 — 품번 전부 보이되 프레임 안에 유지
        gapWidth: 260,
        categoryAxisStyle: {
          rot: 0,
          sz: 900,
          plot: EFFICIENCY_TOP5_PLOT,
        },
      };
      const left = chartFiles[0];
      const right = chartFiles[1];
      if (left && right) {
        const leftPath = `ppt/charts/${left}`;
        const rightPath = `ppt/charts/${right}`;
        const leftEntry = zip.file(leftPath);
        const rightEntry = zip.file(rightPath);
        if (leftEntry && rightEntry) {
          let leftXml = applyRankChart(
            await leftEntry.async("string"),
            eff.workTimeTop,
            rankOpts,
          );
          let rightXml = applyRankChart(
            await rightEntry.async("string"),
            eff.downtimeTop,
            rankOpts,
          );
          [leftXml, rightXml] = unifyPairedChartLayouts(
            leftXml,
            rightXml,
            EFFICIENCY_TOP5_PLOT,
          );
          zip.file(leftPath, leftXml);
          zip.file(rightPath, rightXml);
        }
        await syncRankEmbedding(zip, left, eff.workTimeTop);
        await syncRankEmbedding(zip, right, eff.downtimeTop);
      } else if (left) {
        await mutateChart(zip, left, (xml) =>
          applyRankChart(xml, eff.workTimeTop, rankOpts),
        );
        await syncRankEmbedding(zip, left, eff.workTimeTop);
      } else if (right) {
        await mutateChart(zip, right, (xml) =>
          applyRankChart(xml, eff.downtimeTop, rankOpts),
        );
        await syncRankEmbedding(zip, right, eff.downtimeTop);
      }
      break;
    }
    default:
      break;
  }
}

/** 템플릿 PPT에 스냅샷을 채워 Blob으로 반환한다. */
export async function fillMonthlyKpiPpt(
  snapshot: MonthlyKpiPptSnapshot,
): Promise<Blob> {
  const zip = await loadTemplateZip();

  for (let slideNum = 1; slideNum <= 25; slideNum += 1) {
    if (EXCLUDED.has(slideNum)) continue;

    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;

    const applier = SLIDE_APPLIERS[slideNum];
    if (applier) {
      const xml = await slideFile.async("string");
      zip.file(slidePath, applier(xml, snapshot));
    }

    const relsFile = zip.file(relsPath);
    const slideXmlForOrder = await zip.file(slidePath)!.async("string");
    const chartFiles = relsFile
      ? getChartTargetsOrderedOnSlide(
          slideXmlForOrder,
          await relsFile.async("string"),
        )
      : [];
    if (chartFiles.length) {
      await applySlideCharts(zip, snapshot, slideNum, chartFiles);
    }
  }

  // 금액·재료·검사 슬라이드 제거 (후순위)
  await removeExcludedSlides(zip);

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
