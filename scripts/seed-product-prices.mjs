import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s][^=]*)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function normHeader(v) {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  });
  let headerRowIndex = -1;
  let partCol = -1;
  let priceCol = -1;
  for (let r = 0; r < Math.min(matrix.length, 40); r++) {
    const row = matrix[r] ?? [];
    let p = -1;
    let pr = -1;
    for (let c = 0; c < row.length; c++) {
      const h = normHeader(row[c]);
      if (!h) continue;
      if (p < 0 && (h === "품번" || h.includes("품번"))) p = c;
      if (
        pr < 0 &&
        (h === "data 단가" ||
          h === "data단가" ||
          (h.includes("data") && h.includes("단가")))
      ) {
        pr = c;
      }
    }
    if (p >= 0 && pr >= 0) {
      headerRowIndex = r;
      partCol = p;
      priceCol = pr;
      break;
    }
  }
  if (headerRowIndex < 0) throw new Error("header not found");
  const map = new Map();
  const conflictParts = new Set();
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const part = String(row[partCol] ?? "")
      .replace(/\u00a0/g, " ")
      .trim();
    if (!part) continue;
    const raw = row[priceCol];
    const n =
      typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const price = Math.round(n * 10000) / 10000;
    if (price === 0) continue; // DATA 단가 0은 DB에 넣지 않음
    if (map.has(part) && map.get(part) !== price) {
      conflictParts.add(part);
    } else if (!conflictParts.has(part)) {
      map.set(part, price);
    }
  }
  for (const part of conflictParts) map.delete(part);
  return { map, conflicts: [...conflictParts], headerRowIndex };
}

loadEnvLocal();

const excelPath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || "", "Downloads", "5월 기준 제품 단가.xlsx");

const buf = fs.readFileSync(excelPath);
const { map, conflicts, headerRowIndex } = parseExcel(buf);
console.log({
  excelPath,
  headerRowIndex,
  unique: map.size,
  conflicts: conflicts.length,
});

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const rows = [...map.entries()].map(([part_number, unit_price]) => ({
  part_number,
  unit_price,
}));

const { data, error } = await sb.rpc("rpc_upsert_product_prices", {
  p_secret: process.env.PRODUCT_PRICES_RPC_SECRET,
  p_rows: rows,
  p_file_name: path.basename(excelPath),
  p_write_history: true,
});
if (error) {
  console.error(error);
  process.exit(1);
}

const { count, error: countErr } = await sb
  .from("product_prices")
  .select("id", { count: "exact", head: true });
if (countErr) console.error(countErr);
console.log({ ...data, db_count: count, conflicts: conflicts.length });
