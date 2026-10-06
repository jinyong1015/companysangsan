import type JSZip from "jszip";

/**
 * 데이터가 없어 후순위로 미룬 슬라이드 (생산금액·재료·검사).
 * 템플릿 원본 번호 기준.
 */
/** 12=일별금액 등, 20·21=재료, 24·25=검사 — 16(GROMMET 제품별)은 포함 */
export const EXCLUDED_SLIDE_NUMBERS = [12, 20, 21, 24, 25] as const;

/**
 * presentation.xml / rels / Content_Types에서 지정 슬라이드를 제거하고
 * 슬라이드 XML·노트도 패키지에서 삭제한다.
 */
export async function removeExcludedSlides(
  zip: JSZip,
  slideNumbers: readonly number[] = EXCLUDED_SLIDE_NUMBERS,
): Promise<void> {
  const exclude = new Set(slideNumbers);
  const relsPath = "ppt/_rels/presentation.xml.rels";
  const presPath = "ppt/presentation.xml";
  const ctPath = "[Content_Types].xml";

  const relsEntry = zip.file(relsPath);
  const presEntry = zip.file(presPath);
  const ctEntry = zip.file(ctPath);
  if (!relsEntry || !presEntry || !ctEntry) {
    throw new Error("PPT 패키지 구조를 읽지 못했습니다.");
  }

  let relsXml = await relsEntry.async("string");
  const slideRidByNum = new Map<number, string>();
  const relRe =
    /<Relationship([^>]*?)Target="slides\/slide(\d+)\.xml"([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  const relCopy = relsXml;
  while ((m = relRe.exec(relCopy))) {
    const num = Number(m[2]);
    const idMatch = `${m[1]}${m[3]}`.match(/\bId="(rId\d+)"/);
    if (idMatch) slideRidByNum.set(num, idMatch[1]!);
  }

  // rels에서 제외 슬라이드 Relationship 제거
  for (const num of exclude) {
    relsXml = relsXml.replace(
      new RegExp(
        `<Relationship[^>]*Target="slides/slide${num}\\.xml"[^>]*/>`,
        "g",
      ),
      "",
    );
  }
  zip.file(relsPath, relsXml);

  // presentation sldIdLst에서 해당 rId 제거
  let presXml = await presEntry.async("string");
  for (const num of exclude) {
    const rid = slideRidByNum.get(num);
    if (!rid) continue;
    presXml = presXml.replace(
      new RegExp(`<p:sldId[^>]*r:id="${rid}"[^>]*/>`, "g"),
      "",
    );
  }
  zip.file(presPath, presXml);

  // Content_Types Override 제거
  let ctXml = await ctEntry.async("string");
  for (const num of exclude) {
    ctXml = ctXml.replace(
      new RegExp(
        `<Override[^>]*PartName="/ppt/slides/slide${num}\\.xml"[^>]*/>`,
        "g",
      ),
      "",
    );
    ctXml = ctXml.replace(
      new RegExp(
        `<Override[^>]*PartName="/ppt/notesSlides/notesSlide${num}\\.xml"[^>]*/>`,
        "g",
      ),
      "",
    );
  }
  zip.file(ctPath, ctXml);

  // 파일 삭제
  for (const num of exclude) {
    zip.remove(`ppt/slides/slide${num}.xml`);
    zip.remove(`ppt/slides/_rels/slide${num}.xml.rels`);
    zip.remove(`ppt/notesSlides/notesSlide${num}.xml`);
    zip.remove(`ppt/notesSlides/_rels/notesSlide${num}.xml.rels`);
  }
}
