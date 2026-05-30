import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedData {
  rows: Record<string, unknown>[];
  columns: ColumnInfo[];
  rowCount: number;
  fileName: string;
}

export interface ColumnInfo {
  name: string;
  type: "numeric" | "string" | "date" | "boolean";
  nullCount: number;
  uniqueCount: number;
  sampleValues: unknown[];
  min?: number;
  max?: number;
}

// Max rows held in memory for analysis & rendering (the rest are counted only)
const MAX_ROWS_IN_MEMORY = 50_000;

export async function parseFile(file: File): Promise<ParsedData> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "csv":
      return parseCSV(file, ",");
    case "tsv":
      return parseCSV(file, "\t");
    case "txt":
      return parseCSV(file, "auto");   // PapaParse auto-detects delimiter
    case "xlsx":
    case "xls":
    case "xlsm":
    case "xlsb":
    case "ods":
      return parseExcel(file);
    case "json":
      return parseJSON(file);
    case "xml":
      return parseXML(file);
    case "parquet":
    case "feather":
      throw new Error(
        `.${ext} files must be uploaded via the backend API (/upload) — the browser cannot parse binary columnar formats directly.`
      );
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

// ── CSV / TSV / TXT ────────────────────────────────────────────────────────────
async function parseCSV(file: File, delimiter: string | "auto"): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    let totalCount = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: delimiter === "auto" ? "" : delimiter, // "" = PapaParse auto-detect
      chunk: (results: Papa.ParseResult<Record<string, unknown>>) => {
        for (const row of results.data) {
          totalCount++;
          if (rows.length < MAX_ROWS_IN_MEMORY) rows.push(row);
        }
      },
      complete: () =>
        resolve({ rows, columns: inferColumns(rows), rowCount: totalCount, fileName: file.name }),
      error: (err: Error) => reject(err),
    });
  });
}

// ── Excel family + ODS ────────────────────────────────────────────────────────
async function parseExcel(file: File): Promise<ParsedData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", dense: true, cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
  const rows = allRows.slice(0, MAX_ROWS_IN_MEMORY);
  return { rows, columns: inferColumns(rows), rowCount: allRows.length, fileName: file.name };
}

// ── JSON ───────────────────────────────────────────────────────────────────────
async function parseJSON(file: File): Promise<ParsedData> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }

  // Handle nested: { data: [...] } or { results: [...] } or { items: [...] }
  let allRows: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    allRows = parsed as Record<string, unknown>[];
  } else if (typeof parsed === "object" && parsed !== null) {
    // Try to find the first array property
    const firstArray = Object.values(parsed as object).find(Array.isArray);
    allRows = firstArray ? (firstArray as Record<string, unknown>[]) : [parsed as Record<string, unknown>];
  } else {
    throw new Error("JSON must contain an array of records or an object with an array property.");
  }

  const rows = allRows.slice(0, MAX_ROWS_IN_MEMORY);
  return { rows, columns: inferColumns(rows), rowCount: allRows.length, fileName: file.name };
}

// ── XML ────────────────────────────────────────────────────────────────────────
async function parseXML(file: File): Promise<ParsedData> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Invalid XML — " + parseError.textContent?.slice(0, 120));

  const root = doc.documentElement;
  const children = Array.from(root.children);

  if (children.length === 0) {
    throw new Error("XML file appears to have no child records. Expected a list of elements under the root.");
  }

  const rows: Record<string, unknown>[] = children.slice(0, MAX_ROWS_IN_MEMORY).map((el) => {
    const row: Record<string, unknown> = {};
    // Attributes on the element itself
    for (const attr of Array.from(el.attributes)) row[attr.name] = attr.value;
    // Child elements → columns
    for (const child of Array.from(el.children)) {
      row[child.tagName] = child.children.length === 0 ? child.textContent : child.innerHTML;
    }
    // Leaf element with no children — use tag name as column
    if (el.children.length === 0 && el.textContent) row[el.tagName] = el.textContent;
    return row;
  });

  return { rows, columns: inferColumns(rows), rowCount: children.length, fileName: file.name };
}

// ── Column inference ──────────────────────────────────────────────────────────
export function inferColumns(rows: Record<string, unknown>[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  return keys.map((name) => {
    const values = rows.map((r) => r[name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const nullCount = values.length - nonNull.length;
    const uniqueCount = new Set(nonNull).size;

    const type = inferType(nonNull);
    const info: ColumnInfo = { name, type, nullCount, uniqueCount, sampleValues: nonNull.slice(0, 5) };

    if (type === "numeric") {
      const nums = nonNull.map(Number).filter((n) => !isNaN(n));
      info.min = Math.min(...nums);
      info.max = Math.max(...nums);
    }

    return info;
  });
}

function inferType(values: unknown[]): ColumnInfo["type"] {
  if (values.length === 0) return "string";

  const sample = values.slice(0, 20);
  const numericCount = sample.filter(
    (v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
  ).length;
  if (numericCount / sample.length > 0.8) return "numeric";

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{2}-\d{2}-\d{4}/,
  ];
  const dateCount = sample.filter(
    (v) => typeof v === "string" && datePatterns.some((p) => p.test(v))
  ).length;
  if (dateCount / sample.length > 0.6) return "date";

  return "string";
}
