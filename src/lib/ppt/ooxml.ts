const AT_RE = /<a:t((?:\s[^>]*)?)>([^<]*)<\/a:t>/g;

export function listTextRuns(xml: string): string[] {
  const runs: string[] = [];
  const re = new RegExp(AT_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    runs.push(m[2] ?? "");
  }
  return runs;
}

/**
 * 인덱스별 텍스트로 `<a:t>` 런을 교체한다.
 * 템플릿에 유독 작은 글자(예: 10행 품번 sz=800)가 있으면 1100으로 맞춤.
 */
export function setTextRuns(
  xml: string,
  updates: Map<number, string> | Record<number, string>,
  options?: { minSz?: number },
): string {
  const map =
    updates instanceof Map
      ? updates
      : new Map(
          Object.entries(updates).map(([k, v]) => [Number(k), v] as const),
        );
  const minSz = options?.minSz ?? 1100;
  let index = -1;
  return xml.replace(/<a:r\b[\s\S]*?<\/a:r>/g, (run) => {
    if (!/<a:t[\s>]/.test(run)) return run;
    let updated = false;
    let nextRun = run.replace(AT_RE, (_full, attrs: string, _text: string) => {
      index += 1;
      if (!map.has(index)) {
        return `<a:t${attrs}>${_text}</a:t>`;
      }
      updated = true;
      const next = escapeXml(map.get(index) ?? "");
      return `<a:t${attrs}>${next}</a:t>`;
    });
    // 갱신한 런에 템플릿 잔여 작은 폰트(예: sz=800)가 있으면 맞춤
    if (updated) {
      nextRun = nextRun.replace(
        /(<a:rPr\b[^>]*\bsz=")(\d+)(")/,
        (m, a: string, n: string, c: string) =>
          Number(n) > 0 && Number(n) < minSz ? `${a}${minSz}${c}` : m,
      );
    }
    return nextRun;
  });
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPptInt(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatPptFixed(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPptDelta(value: number, digits = 1): string {
  if (value === 0) return digits > 0 ? "0.0" : "0";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPptFixed(value, digits)}`;
}

export function formatPptPercent(value: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  const body = formatPptFixed(value, digits);
  return `${body}%`;
}

export function formatPptNullable(
  value: number | null,
  digits = 1,
): string {
  if (value == null || Number.isNaN(value)) return "-";
  return formatPptFixed(value, digits);
}

/** 템플릿/화면 설비코드 (P-01, GP01, PG-03, IN14 등) */
const EQUIPMENT_LABEL_RE = /^(P|GP|PG|PS|IN)-?\d+$/i;

/**
 * 템플릿에 남아 있는 이전 월 설비 수치를 먼저 "-"로 지운다.
 * (조회월에 없는 설비가 5월 값으로 남는 문제 방지)
 */
export function clearEquipmentMetricRows(xml: string): string {
  const runs = listTextRuns(xml);
  const updates = new Map<number, string>();
  for (let i = 0; i < runs.length; i += 1) {
    const key = runs[i]!.trim();
    if (!EQUIPMENT_LABEL_RE.test(key)) continue;
    if (i + 1 < runs.length) updates.set(i + 1, "-");
    if (i + 2 < runs.length) updates.set(i + 2, "-");
  }
  return setTextRuns(xml, updates);
}

/**
 * 화면 설비 목록 순서대로 템플릿 설비 슬롯(라벨+값2개)을 덮어쓴다.
 * 템플릿이 GP-05인데 화면이 PG01인 경우처럼 이름이 달라도 매칭된다.
 *
 * @param fromHint 이 텍스트 런 이후부터 탐색 (예: "Press", "Injection")
 * @param untilHint 이 텍스트 런 직전까지만 (기본 "평균")
 */
export function fillEquipmentSlots(
  xml: string,
  rows: Array<{ label: string; values: [string, string] }>,
  options?: { fromHint?: string; untilHint?: string },
): string {
  const runs = listTextRuns(xml);
  const untilHint = options?.untilHint ?? "평균";
  let start = 0;
  if (options?.fromHint) {
    const hint = options.fromHint.toLowerCase();
    const at = runs.findIndex((t) => t.toLowerCase().includes(hint));
    if (at >= 0) start = at;
  }
  let end = runs.length;
  const untilAt = runs.findIndex(
    (t, i) => i > start && t.trim() === untilHint,
  );
  if (untilAt >= 0) end = untilAt;

  const slotIndexes: number[] = [];
  for (let i = start; i < end; i += 1) {
    if (EQUIPMENT_LABEL_RE.test(runs[i]!.trim())) slotIndexes.push(i);
  }

  const updates = new Map<number, string>();
  for (let s = 0; s < slotIndexes.length; s += 1) {
    const idx = slotIndexes[s]!;
    const row = rows[s];
    if (row) {
      updates.set(idx, row.label);
      updates.set(idx + 1, row.values[0]);
      updates.set(idx + 2, row.values[1]);
    } else {
      updates.set(idx, "-");
      updates.set(idx + 1, "-");
      updates.set(idx + 2, "-");
    }
  }
  return setTextRuns(xml, updates);
}

/** @deprecated 이름 매칭 대신 fillEquipmentSlots 사용 */
export function updateRowsAfterLabels(
  xml: string,
  rows: Array<{ label: string; values: Array<string | null> }>,
): string {
  return fillEquipmentSlots(
    xml,
    rows.map((r) => ({
      label: r.label,
      values: [r.values[0] ?? "-", r.values[1] ?? "-"] as [string, string],
    })),
  );
}

function buildStrCache(values: string[]): string {
  const pts = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`)
    .join("");
  return `<c:ptCount val="${values.length}"/>${pts}`;
}

function buildNumCache(values: number[], formatCode = "General"): string {
  // 비유한 값(조회월 이후 NaN)은 포인트를 생략해 선이 끊기게 함
  const pts = values
    .map((v, i) => {
      if (!Number.isFinite(v)) return "";
      return `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`;
    })
    .join("");
  return `<c:formatCode>${escapeXml(formatCode)}</c:formatCode><c:ptCount val="${values.length}"/>${pts}`;
}

/**
 * 차트 시리즈의 표시 캐시(이름·카테고리·값)를 갱신한다.
 * seriesIndex 순서의 `<c:ser>`에 매핑한다.
 */
export function updateChartCaches(
  chartXml: string,
  options: {
    categories?: string[];
    series: Array<{
      name?: string;
      values?: number[];
      /** true면 이 시리즈는 건너뜀 (생산금액 등) */
      skip?: boolean;
    }>;
  },
): string {
  let xml = chartXml;
  const serBlocks = [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)];
  if (!serBlocks.length) return xml;

  for (let i = 0; i < serBlocks.length; i += 1) {
    const spec = options.series[i];
    if (!spec || spec.skip) continue;
    let ser = serBlocks[i]![0];

    if (spec.name != null) {
      ser = ser.replace(
        /(<c:tx>[\s\S]*?<c:strCache>)[\s\S]*?(<\/c:strCache>)/,
        `$1${buildStrCache([spec.name])}$2`,
      );
    }

    if (options.categories) {
      const catCount = options.categories.length;
      const catMatch = ser.match(/<c:cat>[\s\S]*?<\/c:cat>/);
      if (catMatch) {
        const prevFormula =
          catMatch[0].match(/<c:f>([^<]*)<\/c:f>/)?.[1] ?? "Sheet1!$A$2:$A$11";
        const nextFormula = prevFormula.replace(
          /\$([A-Z]+)\$(\d+):\$([A-Z]+)\$\d+/i,
          (_m, c1: string, start: string, c2: string) =>
            `$${c1}$${start}:$${c2}$${Number(start) + catCount - 1}`,
        );
        // numCache 카테고리(숫자 품번)도 문자열로 바꿔 축에 품번이 보이게 함
        // (값 numCache를 덮어쓰면 축에 생산수량이 표시되던 문제 방지)
        const newCat = `<c:cat><c:strRef><c:f>${nextFormula}</c:f><c:strCache>${buildStrCache(options.categories)}</c:strCache></c:strRef></c:cat>`;
        ser = ser.replace(/<c:cat>[\s\S]*?<\/c:cat>/, newCat);
      }
    }

    if (spec.values) {
      const valMatch = ser.match(/<c:val>[\s\S]*?<\/c:val>/);
      const formatMatch = valMatch?.[0].match(
        /<c:numCache>\s*<c:formatCode>([^<]*)<\/c:formatCode>/,
      );
      const formatCode = formatMatch?.[1] ?? "General";
      // 값 축 numCache만 갱신 (카테고리 numCache와 혼동 금지)
      ser = ser.replace(
        /(<c:val>[\s\S]*?)<c:numCache>[\s\S]*?<\/c:numCache>/,
        `$1<c:numCache>${buildNumCache(spec.values, formatCode)}</c:numCache>`,
      );
      const valCount = spec.values.length;
      ser = ser.replace(
        /(<c:val>[\s\S]*?<c:f>)([^<]+)(<\/c:f>)/,
        (_full, a: string, formula: string, c: string) => {
          const next = formula.replace(
            /\$([A-Z]+)\$(\d+):\$([A-Z]+)\$\d+/i,
            (_m, c1: string, start: string, c2: string) =>
              `$${c1}$${start}:$${c2}$${Number(start) + valCount - 1}`,
          );
          return `${a}${next}${c}`;
        },
      );
    }

    xml = xml.replace(serBlocks[i]![0], ser);
  }

  return xml;
}

export function getChartTargetsFromRels(relsXml: string): string[] {
  const out: string[] = [];
  const re = /Target="\.\.\/charts\/(chart\d+\.xml)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml))) {
    out.push(m[1]!);
  }
  return out;
}

/** 슬라이드에 배치된 위→아래 순으로 차트 파일을 반환 (GROMMET 상단 / SEAL 하단) */
export function getChartTargetsOrderedOnSlide(
  slideXml: string,
  relsXml: string,
): string[] {
  const ridToChart = new Map<string, string>();
  const relRe =
    /Id="(rId\d+)"[^>]*Target="\.\.\/charts\/(chart\d+\.xml)"|Target="\.\.\/charts\/(chart\d+\.xml)"[^>]*Id="(rId\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = relRe.exec(relsXml))) {
    if (m[1] && m[2]) ridToChart.set(m[1], m[2]);
    else if (m[4] && m[3]) ridToChart.set(m[4], m[3]);
  }

  const frames = [...slideXml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)]
    .map((match) => {
      const block = match[0];
      const rid = block.match(/r:id="(rId\d+)"/)?.[1];
      const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
      const x = Number(off?.[1] ?? 0);
      const y = Number(off?.[2] ?? 0);
      const chart = rid ? ridToChart.get(rid) : undefined;
      return chart ? { x, y, chart } : null;
    })
    .filter((f): f is { x: number; y: number; chart: string } => !!f)
    // 같은 행(y 근접)이면 좌→우, 아니면 위→아래
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) < 500_000) return a.x - b.x;
      return a.y - b.y;
    });

  if (frames.length) return frames.map((f) => f.chart);
  return getChartTargetsFromRels(relsXml);
}

/** 값 축 최소값을 고정(잘림 방지). 기존 min이 있으면 덮어씀. */
export function setChartValueAxisMin(chartXml: string, min: number): string {
  if (/<c:scaling>[\s\S]*?<c:min /.test(chartXml)) {
    return chartXml.replace(
      /(<c:scaling>[\s\S]*?)<c:min val="[^"]*"\/>/,
      `$1<c:min val="${min}"/>`,
    );
  }
  return chartXml.replace(
    /<c:scaling>/,
    `<c:scaling><c:min val="${min}"/>`,
  );
}

/** 값 축 고정 max 제거 → 데이터에 맞게 자동 스케일 */
export function clearChartValueAxisMax(chartXml: string): string {
  return chartXml.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, (block) =>
    block
      .replace(/<c:max val="[^"]*"\/>/g, "")
      .replace(/<c:majorUnit val="[^"]*"\/>/g, ""),
  );
}

export type ChartPlotLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * 순위 세로 막대(col) plotArea — 하단 대각선 라벨 여유.
 * 빨간 1등 테두리와 동일 값 사용.
 */
export const RANK_CHART_PLOT: ChartPlotLayout = {
  x: 0.19,
  y: 0.08,
  w: 0.76,
  h: 0.58,
};

/** 순위 가로 막대(bar) plotArea — 좌측 품명 라벨 여유 */
export const RANK_CHART_PLOT_HORIZONTAL: ChartPlotLayout = {
  x: 0.4,
  y: 0.12,
  w: 0.56,
  h: 0.78,
};

/**
 * 효율 TOP5 plot — 축 라벨(눈금·품번)이 차트 프레임 안에 들어오도록
 * 좌·하단 여유를 남긴다. (템플릿 테두리 박스와 맞춤)
 */
export const EFFICIENCY_TOP5_PLOT: ChartPlotLayout = {
  x: 0.18,
  y: 0.2,
  w: 0.76,
  h: 0.58,
};

/**
 * 막대 두께·간격 (gapWidth↑ = 막대 얇아짐, 품번 라벨 공간 확보).
 * overlap은 클러스터 간 겹침(%), 음수면 더 벌어짐.
 */
export function setChartBarGapWidth(
  chartXml: string,
  gapWidth: number,
  overlap = -40,
): string {
  let xml = chartXml;
  if (/<c:gapWidth\b/.test(xml)) {
    xml = xml.replace(
      /<c:gapWidth\b[^/]*\/>/g,
      `<c:gapWidth val="${gapWidth}"/>`,
    );
  } else {
    xml = xml.replace(
      /(<c:barDir\b[^/]*\/>)/,
      `$1<c:gapWidth val="${gapWidth}"/>`,
    );
  }
  if (/<c:overlap\b/.test(xml)) {
    xml = xml.replace(
      /<c:overlap\b[^/]*\/>/g,
      `<c:overlap val="${overlap}"/>`,
    );
  } else if (/<c:gapWidth\b/.test(xml)) {
    xml = xml.replace(
      /(<c:gapWidth\b[^/]*\/>)/,
      `$1<c:overlap val="${overlap}"/>`,
    );
  }
  return xml;
}

/** col ↔ bar (가로 막대). 축 위치도 함께 맞춤. */
export function setChartBarDirection(
  chartXml: string,
  dir: "bar" | "col",
): string {
  let xml = chartXml;
  if (/<c:barDir\b/.test(xml)) {
    xml = xml.replace(
      /<c:barDir\b[^/]*\/>/g,
      `<c:barDir val="${dir}"/>`,
    );
  } else {
    xml = xml.replace(
      /(<c:barChart\b[^>]*>)/g,
      `$1<c:barDir val="${dir}"/>`,
    );
  }
  // bar=카테고리 왼쪽·값 아래 / col=카테고리 아래·값 왼쪽
  const catPos = dir === "bar" ? "l" : "b";
  const valPos = dir === "bar" ? "b" : "l";
  xml = xml.replace(/<c:catAx>[\s\S]*?<\/c:catAx>/g, (block) =>
    block.replace(/<c:axPos val="[^"]*"\/>/, `<c:axPos val="${catPos}"/>`),
  );
  xml = xml.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, (block) =>
    block.replace(/<c:axPos val="[^"]*"\/>/, `<c:axPos val="${valPos}"/>`),
  );
  return xml;
}

/**
 * 카테고리 축 라벨 — 회전/폰트, 말줄임(...) 없이 전체 표시.
 */
export function setChartCategoryAxisStyle(
  chartXml: string,
  options?: {
    rot?: number;
    sz?: number;
    /** 생략 시 세로 막대용 RANK_CHART_PLOT */
    plot?: ChartPlotLayout | false;
  },
): string {
  // PPT 템플릿 관례: -60000000 ≈ 대각선 라벨, 0 = 가로
  const rot = options?.rot ?? -60_000_000;
  const sz = options?.sz ?? 1000;

  let xml = chartXml.replace(/<c:catAx>[\s\S]*?<\/c:catAx>/g, (block) => {
    let next = block;

    // 모든 카테고리 라벨 표시 (하나 걸러 숨김 방지)
    if (/<c:tickLblSkip\b/.test(next)) {
      next = next.replace(
        /<c:tickLblSkip\b[^/]*\/>/g,
        '<c:tickLblSkip val="1"/>',
      );
    } else if (/<c:tickLblPos\b/.test(next)) {
      next = next.replace(
        /(<c:tickLblPos\b[^/]*\/>)/,
        `$1<c:tickLblSkip val="1"/>`,
      );
    } else {
      next = next.replace(/(<\/c:catAx>)/, `<c:tickLblSkip val="1"/>$1`);
    }

    if (/<a:bodyPr\b/.test(next)) {
      next = next.replace(/<a:bodyPr\b[^/]*\/?>|<a:bodyPr\b[^>]*>/g, (bp) => {
        let tag = bp;
        if (/\brot="/.test(tag)) {
          tag = tag.replace(/\brot="[^"]*"/, `rot="${rot}"`);
        } else {
          tag = tag.replace(/<a:bodyPr\b/, `<a:bodyPr rot="${rot}"`);
        }
        if (/\bvertOverflow="/.test(tag)) {
          tag = tag.replace(
            /\bvertOverflow="[^"]*"/,
            'vertOverflow="overflow"',
          );
        } else {
          tag = tag.replace(/<a:bodyPr\b/, `<a:bodyPr vertOverflow="overflow"`);
        }
        if (/\bwrap="/.test(tag)) {
          tag = tag.replace(/\bwrap="[^"]*"/, 'wrap="none"');
        } else {
          tag = tag.replace(/(\s*\/?>)$/, ` wrap="none"$1`);
        }
        if (!/\bvert=/.test(tag)) {
          tag = tag.replace(/(\s*\/?>)$/, ` vert="horz"$1`);
        }
        return tag;
      });
    }

    if (/<a:defRPr\b/.test(next)) {
      next = next.replace(/<a:defRPr\b[^>]*>/g, (rp) => {
        if (/\bsz="/.test(rp)) {
          return rp.replace(/\bsz="[^"]*"/, `sz="${sz}"`);
        }
        return rp.replace(/<a:defRPr\b/, `<a:defRPr sz="${sz}"`);
      });
    } else if (/<c:txPr>/.test(next)) {
      next = next.replace(
        /(<c:txPr>[\s\S]*?<a:pPr>)([\s\S]*?)(<\/a:pPr>)/,
        `$1<a:defRPr sz="${sz}" b="0" i="0"/>$3`,
      );
    } else {
      const txPr = `<c:txPr><a:bodyPr rot="${rot}" spcFirstLastPara="1" vertOverflow="overflow" vert="horz" wrap="none" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="0" i="0" u="none" strike="noStrike" kern="1200" baseline="0"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="75000"/><a:lumOff val="25000"/></a:schemeClr></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>`;
      next = next.replace(/(<c:crossAx\b)/, `${txPr}$1`);
    }

    return next;
  });

  if (options?.plot !== false) {
    xml = ensureCategoryLabelPlotSpace(xml, options?.plot ?? RANK_CHART_PLOT);
  }
  return xml;
}

/** plotArea manualLayout 적용 */
function ensureCategoryLabelPlotSpace(
  chartXml: string,
  target: ChartPlotLayout = RANK_CHART_PLOT,
): string {
  const { x, y, w, h } = target;
  const ml = `<c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${x}"/><c:y val="${y}"/><c:w val="${w}"/><c:h val="${h}"/></c:manualLayout>`;

  if (
    /<c:plotArea>\s*<c:layout>[\s\S]*?<\/c:layout>/.test(chartXml)
  ) {
    return chartXml.replace(
      /(<c:plotArea>\s*<c:layout>)[\s\S]*?(<\/c:layout>)/,
      `$1${ml}$2`,
    );
  }
  if (/<c:plotArea>\s*<c:layout\/>/.test(chartXml)) {
    return chartXml.replace(
      /<c:plotArea>\s*<c:layout\/>/,
      `<c:plotArea><c:layout>${ml}</c:layout>`,
    );
  }
  return chartXml.replace(
    /<c:plotArea>/,
    `<c:plotArea><c:layout>${ml}</c:layout>`,
  );
}

/** 보기 좋은 눈금 단위 (대략 ticks개 구간) */
function niceAxisUnit(raw: number, ticks = 5): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const rough = raw / ticks;
  const exp = 10 ** Math.floor(Math.log10(rough));
  const frac = rough / exp;
  const nice =
    frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * 값 축 min=0, max·majorUnit을 데이터에 맞게 설정 (눈금 약 4구간).
 * majorUnit은 OOXML 순서상 crossBetween 뒤에 넣어야 PowerPoint가 인식한다.
 */
export function setChartValueAxisNiceScale(
  chartXml: string,
  dataMax: number,
): string {
  const peak = Math.max(0, Number.isFinite(dataMax) ? dataMax : 0);
  // 큰 수량(백만 단위)도 라벨이 빽빽하지 않게 4눈금 기준
  const major = niceAxisUnit(peak > 0 ? peak : 1, 4);
  const max = Math.max(major, Math.ceil((peak * 1.15) / major) * major);

  return chartXml.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, (block) => {
    let next = block
      .replace(/<c:max val="[^"]*"\/>/g, "")
      .replace(/<c:min val="[^"]*"\/>/g, "")
      .replace(/<c:majorUnit val="[^"]*"\/>/g, "")
      .replace(/<c:minorUnit val="[^"]*"\/>/g, "")
      .replace(/<c:dispUnits>[\s\S]*?<\/c:dispUnits>/g, "");

    if (/<c:scaling>[\s\S]*?<\/c:scaling>/.test(next)) {
      next = next.replace(
        /<c:scaling>([\s\S]*?)<\/c:scaling>/,
        `<c:scaling>$1<c:min val="0"/><c:max val="${max}"/></c:scaling>`,
      );
    } else {
      next = next.replace(
        /<c:scaling\/>/,
        `<c:scaling><c:orientation val="minMax"/><c:min val="0"/><c:max val="${max}"/></c:scaling>`,
      );
    }

    // CT_ValAx: … crossBetween → majorUnit → minorUnit → dispUnits
    if (/<c:crossBetween\b[^/]*\/>/.test(next)) {
      next = next.replace(
        /(<c:crossBetween\b[^/]*\/>)/,
        `$1<c:majorUnit val="${major}"/>`,
      );
    } else if (/<c:crosses\b[^/]*\/>/.test(next)) {
      next = next.replace(
        /(<c:crosses\b[^/]*\/>)/,
        `$1<c:majorUnit val="${major}"/>`,
      );
    } else if (/<c:crossesAt\b[^/]*\/>/.test(next)) {
      next = next.replace(
        /(<c:crossesAt\b[^/]*\/>)/,
        `$1<c:majorUnit val="${major}"/>`,
      );
    } else {
      next = next.replace(
        /<\/c:valAx>/,
        `<c:majorUnit val="${major}"/></c:valAx>`,
      );
    }

    // 축 숫자 포맷 통일
    next = next.replace(
      /<c:numFmt[^/]*\/>/,
      `<c:numFmt formatCode="#,##0" sourceLinked="0"/>`,
    );
    return next;
  });
}

/**
 * 효율 TOP5 슬라이드: 빈 테두리 도형을 차트에 맞추되,
 * 아래 TOP5 표 영역을 침범하지 않도록 하단을 클램프한다.
 */
export function fitEfficiencyChartBorders(slideXml: string): string {
  const frames = [
    ...slideXml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g),
  ].map((m) => {
    const block = m[0];
    const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!off || !ext) return null;
    return {
      block,
      isChart: /2006\/chart|c:chart/.test(block),
      x: Number(off[1]),
      y: Number(off[2]),
      cx: Number(ext[1]),
      cy: Number(ext[2]),
    };
  }).filter((f): f is NonNullable<typeof f> => !!f);

  const charts = frames.filter((f) => f.isChart).sort((a, b) => a.x - b.x);
  if (!charts.length) return slideXml;

  // 차트 아래에 있는 표(TOP5) 상단 — 테두리가 이 선을 넘지 않음
  const chartBottomMax = Math.max(...charts.map((c) => c.y + c.cy));
  const tableTops = frames
    .filter((f) => !f.isChart && f.y > chartBottomMax - 800_000)
    .map((f) => f.y);
  const tableTop =
    tableTops.length > 0 ? Math.min(...tableTops) : Number.POSITIVE_INFINITY;
  const maxBorderBottom = Number.isFinite(tableTop)
    ? tableTop - 50_000
    : chartBottomMax + 40_000;

  const borders = [...slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
    .map((m) => m[0])
    .filter((block) => {
      if (!/<a:ln\b/.test(block)) return false;
      const texts = [...block.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) =>
        (t[1] ?? "").trim(),
      );
      if (texts.some((t) => t.length > 0)) return false;
      const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!ext) return false;
      const cx = Number(ext[1]);
      const cy = Number(ext[2]);
      return cx > 2_000_000 && cy > 1_500_000;
    })
    .map((block) => {
      const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
      const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!off || !ext) return null;
      return {
        block,
        x: Number(off[1]),
        y: Number(off[2]),
        cx: Number(ext[1]),
        cy: Number(ext[2]),
      };
    })
    .filter((b): b is NonNullable<typeof b> => !!b)
    .sort((a, b) => a.x - b.x);

  if (!borders.length) return slideXml;

  let xml = slideXml;
  const padL = 90_000;
  const padR = 50_000;
  const padB = 40_000;
  const padT = 0;

  for (const chart of charts) {
    const chartMid = chart.x + chart.cx / 2;
    let best = borders[0]!;
    let bestDist = Math.abs(best.x + best.cx / 2 - chartMid);
    for (const b of borders) {
      const d = Math.abs(b.x + b.cx / 2 - chartMid);
      if (d < bestDist) {
        best = b;
        bestDist = d;
      }
    }

    const nx = Math.round(chart.x - padL);
    const ny = Math.round(chart.y - padT);
    const ncx = Math.round(chart.cx + padL + padR);
    // 표 상단 아래에서 끊기
    const desiredBottom = Math.min(chart.y + chart.cy + padB, maxBorderBottom);
    const ncy = Math.max(1_200_000, Math.round(desiredBottom - ny));

    const next = best.block
      .replace(
        /<a:off x="-?\d+" y="-?\d+"\/>/,
        `<a:off x="${nx}" y="${ny}"/>`,
      )
      .replace(
        /(<a:xfrm\b[^>]*>[\s\S]*?)<a:ext cx="\d+" cy="\d+"\/>/,
        `$1<a:ext cx="${ncx}" cy="${ncy}"/>`,
      );
    xml = xml.replace(best.block, next);
    best.block = next;
    best.x = nx;
    best.y = ny;
    best.cx = ncx;
    best.cy = ncy;
  }

  return xml;
}

/** 좌·우 나란히 있는 차트 프레임의 y·높이를 왼쪽에 맞춤 (0 기준선 정렬) */
export function alignSideBySideChartFrames(slideXml: string): string {
  const charts = [
    ...slideXml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g),
  ]
    .map((m) => {
      const block = m[0];
      if (!/2006\/chart|c:chart/.test(block)) return null;
      const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
      const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!off || !ext) return null;
      return {
        block,
        x: Number(off[1]),
        y: Number(off[2]),
        cx: Number(ext[1]),
        cy: Number(ext[2]),
      };
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => a.x - b.x);

  if (charts.length < 2) return slideXml;
  const left = charts[0]!;
  const right = charts[1]!;
  // 같은 행이 아니면 건드리지 않음
  if (Math.abs(left.y - right.y) > 800_000) return slideXml;
  if (left.y === right.y && left.cy === right.cy) return slideXml;

  const nextRight = right.block
    .replace(
      /<a:off x="-?\d+" y="-?\d+"\/>/,
      `<a:off x="${right.x}" y="${left.y}"/>`,
    )
    .replace(
      /(<a:xfrm\b[^>]*>[\s\S]*?)<a:ext cx="\d+" cy="\d+"\/>/,
      `$1<a:ext cx="${right.cx}" cy="${left.cy}"/>`,
    );
  return slideXml.replace(right.block, nextRight);
}

const DEFAULT_EFFICIENCY_PLOT = {
  x: 0.1479093833461195,
  y: 0.22299353211810749,
  w: 0.82199155756942754,
  h: 0.66960864222821959,
};

function extractInnerPlotLayout(chartXml: string): {
  x: number;
  y: number;
  w: number;
  h: number;
} | null {
  const m = chartXml.match(
    /<c:plotArea>[\s\S]*?<c:manualLayout>[\s\S]*?<c:layoutTarget val="inner"\/>[\s\S]*?<c:x val="([^"]+)"\/>[\s\S]*?<c:y val="([^"]+)"\/>[\s\S]*?<c:w val="([^"]+)"\/>[\s\S]*?<c:h val="([^"]+)"\/>[\s\S]*?<\/c:manualLayout>/,
  );
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  const w = Number(m[3]);
  const h = Number(m[4]);
  if (![x, y, w, h].every((v) => Number.isFinite(v))) return null;
  return { x, y, w, h };
}

function setPlotAreaInnerLayout(
  chartXml: string,
  layout: { x: number; y: number; w: number; h: number },
): string {
  const ml = `<c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${layout.x}"/><c:y val="${layout.y}"/><c:w val="${layout.w}"/><c:h val="${layout.h}"/></c:manualLayout>`;
  if (
    /<c:plotArea>\s*<c:layout>[\s\S]*?<\/c:layout>/.test(chartXml)
  ) {
    return chartXml.replace(
      /(<c:plotArea>\s*<c:layout>)[\s\S]*?(<\/c:layout>)/,
      `$1${ml}$2`,
    );
  }
  if (/<c:plotArea>\s*<c:layout\/>/.test(chartXml)) {
    return chartXml.replace(
      /<c:plotArea>\s*<c:layout\/>/,
      `<c:plotArea><c:layout>${ml}</c:layout>`,
    );
  }
  return chartXml.replace(
    /<c:plotArea>/,
    `<c:plotArea><c:layout>${ml}</c:layout>`,
  );
}

/** 차트 제목 영역 layout y를 통일 (좌우 TOP5 제목 높이) */
function setOuterChartLayoutY(chartXml: string, y: number): string {
  let replaced = false;
  return chartXml.replace(
    /<c:layout>\s*<c:manualLayout>([\s\S]*?)<\/c:manualLayout>\s*<\/c:layout>/g,
    (full, body: string) => {
      if (body.includes('layoutTarget val="inner"')) return full;
      if (replaced) return full;
      replaced = true;
      let next = body;
      if (/<c:y val="[^"]*"\/>/.test(next)) {
        next = next.replace(/<c:y val="[^"]*"\/>/, `<c:y val="${y}"/>`);
      } else {
        next = `${next}<c:y val="${y}"/>`;
      }
      return `<c:layout><c:manualLayout>${next}</c:manualLayout></c:layout>`;
    },
  );
}

/**
 * 효율 TOP5 좌·우 차트의 plotArea·제목 layout을 동일하게 맞춤.
 * (GROMMET 우측 플롯이 더 짧아 0 기준선이 어긋나던 문제 해결)
 */
export function unifyPairedChartLayouts(
  leftChartXml: string,
  rightChartXml: string,
  preferredPlot?: ChartPlotLayout,
): [string, string] {
  const plot =
    preferredPlot ??
    extractInnerPlotLayout(leftChartXml) ??
    extractInnerPlotLayout(rightChartXml) ??
    DEFAULT_EFFICIENCY_PLOT;

  let left = setPlotAreaInnerLayout(leftChartXml, plot);
  let right = setPlotAreaInnerLayout(rightChartXml, plot);

  let titleY = 0.035226043021736729;
  for (const m of left.matchAll(
    /<c:manualLayout>([\s\S]*?)<\/c:manualLayout>/g,
  )) {
    const body = m[1] ?? "";
    if (body.includes('layoutTarget val="inner"')) continue;
    const y = Number(body.match(/<c:y val="([^"]+)"\/>/)?.[1]);
    if (Number.isFinite(y)) {
      titleY = y;
      break;
    }
  }
  left = setOuterChartLayoutY(left, titleY);
  right = setOuterChartLayoutY(right, titleY);

  return [left, right];
}

/**
 * 제품별/작업자별 순위 차트의 1위 빨간 점선 박스.
 * - 가로: 첫 번째 막대 슬롯 중앙
 * - 세로: plot 상단~0 기준선(하단이 품번 라벨로 넘치지 않음)
 * plot 비율은 ensureCategoryLabelPlotSpace(RANK_CHART_PLOT)와 동일.
 */
export function alignProductRankHighlightBoxes(
  slideXml: string,
  categoryCount = 10,
): string {
  const charts = [
    ...slideXml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g),
  ]
    .map((m) => {
      const block = m[0];
      if (!/2006\/chart|c:chart/.test(block)) return null;
      const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
      const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!off || !ext) return null;
      return {
        x: Number(off[1]),
        y: Number(off[2]),
        cx: Number(ext[1]),
        cy: Number(ext[2]),
      };
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
    .filter((f) => f.x < 5_000_000)
    .sort((a, b) => a.y - b.y);

  if (!charts.length) return slideXml;

  const { x: plotX, y: plotY, w: plotWFrac, h: plotHFrac } = RANK_CHART_PLOT;
  const n = Math.max(1, categoryCount);

  const boxes = [...slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
    .map((m) => m[0])
    .filter(
      (block) =>
        block.includes('prstDash val="sysDash"') &&
        /srgbClr val="FF0000"/i.test(block),
    )
    .map((block) => {
      const y = Number(
        block.match(/<a:off x="-?\d+" y="(-?\d+)"\/>/)?.[1] ?? 0,
      );
      return { block, y };
    })
    .sort((a, b) => a.y - b.y);

  let xml = slideXml;
  const count = Math.min(charts.length, boxes.length);
  for (let i = 0; i < count; i += 1) {
    const chart = charts[i]!;
    const box = boxes[i]!;
    const plotLeft = chart.x + chart.cx * plotX;
    const plotTop = chart.y + chart.cy * plotY;
    const plotW = chart.cx * plotWFrac;
    const plotH = chart.cy * plotHFrac;
    const slotW = plotW / n;
    // 막대보다 약간 넓은 슬롯 중앙 (너무 왼쪽으로 빠지지 않게)
    const boxW = Math.round(slotW * 0.72);
    const centerX = plotLeft + slotW * 0.5;
    const boxX = Math.round(centerX - boxW / 2);
    // 하단 = 0 기준선 (plot 바닥). 품번 라벨 영역으로 내리지 않음
    const boxY = Math.round(plotTop);
    const boxH = Math.round(plotH);
    let next = setShapeSize(box.block, boxW, boxH);
    next = replaceShapeXfrm(next, boxX, boxY, null, { clearFlip: true });
    xml = xml.replace(box.block, next);
  }
  return xml;
}

function replaceShapeXfrm(
  shapeXml: string,
  x: number,
  y: number,
  rot?: number | null,
  options?: { clearFlip?: boolean },
): string {
  return shapeXml.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, (xfrm) => {
    let next = xfrm.replace(
      /<a:off x="-?\d+" y="-?\d+"\/>/,
      `<a:off x="${Math.round(x)}" y="${Math.round(y)}"/>`,
    );
    if (options?.clearFlip) {
      next = next
        .replace(/\sflipH="[^"]*"/g, "")
        .replace(/\sflipV="[^"]*"/g, "");
    }
    if (rot === undefined) {
      // 위치만 이동
    } else if (rot == null) {
      next = next.replace(/\srot="[^"]+"/g, "");
    } else if (/<a:xfrm[^>]*\brot=/.test(next)) {
      next = next.replace(/\brot="[^"]+"/, `rot="${rot}"`);
    } else {
      next = next.replace(/<a:xfrm\b/, `<a:xfrm rot="${rot}"`);
    }
    return next;
  });
}

/** 차트 데이터 라벨(값) 전체 숨김 */
export function hideChartValueLabels(chartXml: string): string {
  return chartXml.replace(
    /<c:showVal val="1"\/>/g,
    '<c:showVal val="0"/>',
  );
}

/** 축/값의 thousands 등 표시단위 제거 (이미 천 단위로 넣은 값과 라벨이 어긋나는 것 방지) */
export function clearChartDisplayUnits(chartXml: string): string {
  return chartXml
    .replace(/<c:dispUnits>[\s\S]*?<\/c:dispUnits>/g, "")
    .replace(/<c:dispUnitsLst>[\s\S]*?<\/c:dispUnitsLst>/g, "");
}

/** 차트 축 제목 "단위 (천)" → "단위 (EA)" */
export function setChartAxisUnitToEa(chartXml: string): string {
  return chartXml.replace(/<a:t>천<\/a:t>/g, "<a:t>EA</a:t>");
}

/** 생산량 추이 plot — 큰 EA 눈금·단위 라벨 여유 */
export const QTY_TREND_PLOT: ChartPlotLayout = {
  x: 0.28,
  y: 0.16,
  w: 0.68,
  h: 0.72,
};

/**
 * 생산량(EA)처럼 큰 눈금 숫자와 "단위 (EA)"가 겹치지 않도록
 * plot 왼쪽·위 여백을 늘리고 축 제목을 위로 올린다.
 */
export function padValueAxisForLargeLabels(chartXml: string): string {
  let xml = ensureCategoryLabelPlotSpace(chartXml, QTY_TREND_PLOT);
  xml = xml.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, (block) => {
    let next = block;
    // plot 왼쪽(0.28) 근처 — 맨 끝이 아니라 눈금 위에 오도록
    const titleLayout = `<c:manualLayout><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.16"/><c:y val="0.02"/></c:manualLayout>`;
    if (/<c:title>[\s\S]*?<c:layout>[\s\S]*?<\/c:layout>/.test(next)) {
      next = next.replace(
        /(<c:title>[\s\S]*?<c:layout>)[\s\S]*?(<\/c:layout>)/,
        `$1${titleLayout}$2`,
      );
    } else if (/<c:title>/.test(next)) {
      next = next.replace(/<c:title>/, `<c:title><c:layout>${titleLayout}</c:layout>`);
    }
    return next;
  });
  return xml;
}

/** 데이터 라벨 위치를 점 위(t)로 통일 */
export function setChartDataLabelPositionTop(chartXml: string): string {
  let xml = chartXml;
  if (/<c:dLblPos\b/.test(xml)) {
    xml = xml.replace(/<c:dLblPos val="[^"]*"\/>/g, '<c:dLblPos val="t"/>');
  } else {
    xml = xml.replace(
      /(<c:dLbls>)/g,
      `$1<c:dLblPos val="t"/>`,
    );
  }
  return xml;
}

/**
 * 지정 포인트들의 값 라벨을 숨긴다 (조회월 마커·0분/0수량 등).
 * 나머지 월 라벨은 유지.
 */
export function hideChartPointValueLabels(
  chartXml: string,
  pointIndexes: number[],
): string {
  const unique = [
    ...new Set(pointIndexes.filter((i) => Number.isInteger(i) && i >= 0)),
  ];
  if (!unique.length) return chartXml;
  const delLbls = unique
    .map((i) => `<c:dLbl><c:idx val="${i}"/><c:delete val="1"/></c:dLbl>`)
    .join("");
  return chartXml.replace(
    /<c:dLbls>([\s\S]*?)<\/c:dLbls>/g,
    (_full, body: string) => {
      let cleaned = body;
      for (const i of unique) {
        cleaned = cleaned.replace(
          new RegExp(
            `<c:dLbl>[\\s\\S]*?<c:idx val="${i}"\\s*\\/>[\\s\\S]*?<\\/c:dLbl>`,
            "g",
          ),
          "",
        );
      }
      const withShow = cleaned.includes('<c:showVal val="0"/>')
        ? cleaned.replace('<c:showVal val="0"/>', '<c:showVal val="1"/>')
        : cleaned;
      return `<c:dLbls>${delLbls}${withShow}</c:dLbls>`;
    },
  );
}

export function hideChartPointValueLabel(
  chartXml: string,
  pointIndex: number,
): string {
  return hideChartPointValueLabels(chartXml, [pointIndex]);
}

function setShapeSingleText(
  shapeXml: string,
  text: string,
  fillColor = "000000",
): string {
  const run = `<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="1200" b="1" dirty="0"><a:solidFill><a:srgbClr val="${fillColor}"/></a:solidFill><a:latin typeface="맑은 고딕" pitchFamily="34" charset="-122"/><a:ea typeface="맑은 고딕" pitchFamily="34" charset="-122"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>`;
  const txBody = `<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="l"><a:defRPr/></a:pPr>${run}<a:endParaRPr lang="ko-KR" sz="1200" b="1"/></a:p></p:txBody>`;

  if (/<p:txBody>[\s\S]*?<\/p:txBody>/.test(shapeXml)) {
    return shapeXml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, txBody);
  }
  return shapeXml.replace(/<\/p:sp>/, `${txBody}</p:sp>`);
}

/** 조회월 마커 기본 글자 — 차트 값 라벨과 동일 (템플릿 dLbl sz=1400 b=1) */
const TREND_MARKER_FONT_SZ = 1400;

/** 숫자 + 삼각형을 같은 문단·한 줄로 (wrap 없음 → 아래로 떨어지지 않음) */
function setShapeMarkerLabel(
  shapeXml: string,
  label: string,
  triChar: "▲" | "▼",
  triColor: string,
  fontSz = TREND_MARKER_FONT_SZ,
): string {
  const sz = fontSz;
  const numRun = `<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="${sz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="맑은 고딕" pitchFamily="34" charset="-122"/><a:ea typeface="맑은 고딕" pitchFamily="34" charset="-122"/></a:rPr><a:t>${escapeXml(label)}</a:t></a:r>`;
  const gapRun = `<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="${sz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="맑은 고딕" pitchFamily="34" charset="-122"/><a:ea typeface="맑은 고딕" pitchFamily="34" charset="-122"/></a:rPr><a:t> </a:t></a:r>`;
  const triRun = `<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="${sz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${triColor}"/></a:solidFill><a:latin typeface="맑은 고딕" pitchFamily="34" charset="-122"/><a:ea typeface="맑은 고딕" pitchFamily="34" charset="-122"/></a:rPr><a:t>${triChar}</a:t></a:r>`;
  const txBody = `<p:txBody><a:bodyPr wrap="none" rtlCol="0" anchor="ctr" lIns="18000" rIns="18000" tIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="ctr"><a:defRPr/></a:pPr>${numRun}${gapRun}${triRun}<a:endParaRPr lang="ko-KR" sz="${sz}" b="1"/></a:p></p:txBody>`;
  if (/<p:txBody>[\s\S]*?<\/p:txBody>/.test(shapeXml)) {
    return shapeXml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, txBody);
  }
  return shapeXml.replace(/<\/p:sp>/, `${txBody}</p:sp>`);
}

function setShapeSize(shapeXml: string, cx: number, cy: number): string {
  // xfrm 안의 크기만 변경 (다른 a:ext 는 건드리지 않음)
  return shapeXml.replace(
    /(<a:xfrm\b[^>]*>[\s\S]*?)<a:ext cx="\d+" cy="\d+"\/>/,
    `$1<a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/>`,
  );
}

type TrendMarkerOptions = {
  categoryIndex: number;
  categoryCount: number;
  value: number;
  values: number[];
  increased: boolean;
  /** 소수 자리. 기본 1 */
  valueDigits?: number;
  /** 마커 글자 크기(백분의 1pt). 기본 1400=14pt */
  fontSz?: number;
  /** 마커 Y 계산용 plot 비율 (차트 plot과 동일해야 함) */
  plot?: ChartPlotLayout;
};

function listGraphicFrames(slideXml: string): Array<{
  block: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
}> {
  return [...slideXml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)]
    .map((match) => {
      const block = match[0];
      // 차트만 (표 graphicFrame 제외)
      if (!/2006\/chart|c:chart/.test(block)) return null;
      const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
      const ext = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!off || !ext) return null;
      return {
        block,
        x: Number(off[1]),
        y: Number(off[2]),
        cx: Number(ext[1]),
        cy: Number(ext[2]),
      };
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => a.y - b.y);
}

function applyMarkerOnChartFrame(
  slideXml: string,
  frame: { x: number; y: number; cx: number; cy: number },
  options: TrendMarkerOptions,
  usedShapeKeys: Set<string>,
): string {
  const chartX = frame.x;
  const chartY = frame.y;
  const chartW = frame.cx;
  const chartH = frame.cy;

  const plot = options.plot ?? {
    x: 0.17473787205257055,
    y: 0.11370727749086473,
    w: 0.79854476306807942,
    h: 0.79508433983362015,
  };
  // 템플릿 차트가 음수 x를 쓰는 경우가 있어 그대로 사용
  const plotLeft = chartX + chartW * plot.x;
  const plotTop = chartY + chartH * plot.y;
  const plotW = chartW * plot.w;
  const plotH = chartH * plot.h;

  const n = Math.max(1, options.categoryCount);
  const idx = Math.min(Math.max(0, options.categoryIndex), n - 1);
  const centerX = plotLeft + ((idx + 0.5) / n) * plotW;

  const finiteVals = options.values.filter((v) => Number.isFinite(v));
  const peak = Math.max(0, ...(finiteVals.length ? finiteVals : [0]));
  // 차트 niceScale과 동일 축 상한으로 마커 Y를 맞춤 (라벨이 점 아래로 어긋나지 않게)
  const major = niceAxisUnit(peak > 0 ? peak : 1, 4);
  const maxV = Math.max(major, Math.ceil((peak * 1.15) / major) * major);
  const ratio = Math.min(1, Math.max(0, options.value / Math.max(1, maxV)));
  const pointY = plotTop + plotH * (1 - ratio);

  const digits = options.valueDigits ?? 1;
  const label =
    digits <= 0
      ? formatPptInt(options.value)
      : formatPptFixed(options.value, digits);

  // 숫자 + 삼각형을 점선 박스 한 줄에 (오른쪽에 ▲/▼)
  const fontSz = options.fontSz ?? TREND_MARKER_FONT_SZ;
  const charW = Math.round(65 * fontSz); // ~14pt→91000, 10.5pt→68250
  const pad = Math.round(fontSz * 28);
  const textW = Math.max(200000, (label.length + 2) * charW);
  const boxW = pad * 2 + textW;
  const boxH = Math.round(fontSz * 170);
  const boxX = Math.min(
    Math.max(plotLeft, centerX - boxW / 2),
    plotLeft + plotW - boxW,
  );
  // 항상 데이터 점 위쪽 (공간이 없으면 plot 상단에 붙임 — 점 아래로 내리지 않음)
  const preferredAbove = pointY - boxH - 30000;
  const boxY = Math.max(plotTop + 10000, Math.min(preferredAbove, pointY - boxH));
  const triColor = options.increased ? "FF0000" : "0920FF";
  const triChar: "▲" | "▼" = options.increased ? "▲" : "▼";

  const yMin = chartY - 200000;
  const yMax = chartY + chartH + 200000;
  const xMin = chartX - 200000;
  const xMax = chartX + chartW * 0.95;

  const shapes = [...slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)];
  let xml = slideXml;
  let dashDone = false;

  for (let si = 0; si < shapes.length; si += 1) {
    const block = shapes[si]![0];
    const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    if (!off) continue;
    const x = Number(off[1]);
    const y = Number(off[2]);
    // 인덱스 대신 원본 좌표로 추적 (도형 삭제 후 인덱스가 밀리면 SEAL 마커가 스킵되던 문제)
    const key = `${x},${y}`;
    if (usedShapeKeys.has(key)) continue;
    if (x < xMin || x > xMax || y < yMin || y > yMax) continue;

    const texts = [...block.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) =>
      t[1]!.trim(),
    );

    // 이미 채운 조회월 마커는 재사용하지 않음
    const joined = texts.join("");
    if (/[\d]/.test(joined) && /[▲▼]/.test(joined)) continue;

    const isTriangle =
      texts.length >= 1 &&
      texts.every((t) => t === "" || t === "▲" || t === "▼") &&
      texts.some((t) => t === "▲" || t === "▼");
    const isDashBox =
      !dashDone &&
      block.includes('prstDash val="sysDash"') &&
      (texts.length === 0 ||
        texts.every(
          (t) =>
            t === "" ||
            t === "   " ||
            /^[\s]*$/.test(t) ||
            /^[\d,.+\-▲▼]+$/.test(t) ||
            /^[\d,.+\-]+\s*[▲▼]$/.test(t),
        ));

    if (!isTriangle && !isDashBox) continue;

    let next = block;
    if (isDashBox) {
      next = setShapeSize(next, boxW, boxH);
      next = replaceShapeXfrm(next, boxX, boxY, null, { clearFlip: true });
      next = setShapeMarkerLabel(next, label, triChar, triColor, fontSz);
      dashDone = true;
      usedShapeKeys.add(key);
    } else {
      next = "";
      usedShapeKeys.add(key);
    }
    xml = xml.replace(block, next);
  }

  return xml;
}

/**
 * 추이 슬라이드 잔여 장식 삭제(완전 제거 — 좌표만 옮기면 좌상단에 보임):
 * - 미사용 ▲/▼ 단독 도형
 * - 숫자 없는 빈 점선 박스
 * - 우측 ▶/외국인 근로자 콜아웃 · "-" 장식
 * - 예전에 화면 밖으로 밀어 둔 잔여 도형
 * (조회월 숫자+삼각형이 들어 있는 점선 박스는 유지)
 */
export function clearOrphanTrendDecorations(slideXml: string): string {
  const RIGHT_X = 8_500_000;
  return slideXml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (block) => {
    const texts = [...block.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) =>
      (m[1] ?? "").trim(),
    );
    const joined = texts.join("");
    const off = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    const x = Number(off?.[1] ?? 0);
    const y = Number(off?.[2] ?? 0);

    // 조회월 마커(숫자 + ▲/▼ 한 줄) 유지
    if (
      block.includes('prstDash val="sysDash"') &&
      /[\d]/.test(joined) &&
      /[▲▼]/.test(joined) &&
      x >= 0 &&
      y >= 0
    ) {
      return block;
    }

    const isTri =
      texts.length >= 1 &&
      texts.every((t) => t === "" || t === "▲" || t === "▼") &&
      texts.some((t) => t === "▲" || t === "▼");
    const isEmptyDash =
      block.includes('prstDash val="sysDash"') && !/[\d]/.test(joined);
    const isCalloutText =
      /[▶►]/.test(joined) ||
      joined.includes("외국인") ||
      joined.includes("단속") ||
      joined.includes("근로자");
    const isRightCallout =
      x >= RIGHT_X &&
      (isCalloutText ||
        joined === "-" ||
        joined === "" ||
        isTri ||
        block.includes('prstDash val="sysDash"'));
    // 이전에 -500000 등으로 밀어 둔 잔여물
    const isParkedOffSlide =
      (x < 0 || y < 0) &&
      (isTri || isEmptyDash || isCalloutText || joined === "-" || joined === "");

    if (isTri || isEmptyDash || isRightCallout || isParkedOffSlide) {
      return "";
    }
    return block;
  });
}

/**
 * 월별 추이 차트 위 조회월 마커(빨간 점선 박스 + 숫자 + 증감 삼각형).
 * 차트 프레임이 여러 개면 위→아래 순으로 seriesList를 매핑한다.
 */
export function applyMonthlyTrendMonthMarker(
  slideXml: string,
  options: TrendMarkerOptions,
): string {
  return applyMonthlyTrendMonthMarkers(slideXml, [options]);
}

export function applyMonthlyTrendMonthMarkers(
  slideXml: string,
  seriesList: TrendMarkerOptions[],
): string {
  const frames = listGraphicFrames(slideXml);
  if (!frames.length || !seriesList.length) {
    return clearOrphanTrendDecorations(slideXml);
  }
  let xml = slideXml;
  const used = new Set<string>();
  for (let i = 0; i < Math.min(frames.length, seriesList.length); i += 1) {
    xml = applyMarkerOnChartFrame(xml, frames[i]!, seriesList[i]!, used);
  }
  return clearOrphanTrendDecorations(xml);
}
