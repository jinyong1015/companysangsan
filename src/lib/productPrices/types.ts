export type ProductPriceRow = {
  id: string;
  part_number: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
};

export type ProductPriceUploadSummary = {
  id: string;
  uploaded_at: string;
  file_name: string | null;
  total_count: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  error_count: number;
};

export type PriceUploadAction =
  | "insert"
  | "update"
  | "unchanged"
  | "error";

export type PricePreviewRow = {
  excelRow: number;
  partNumber: string;
  existingPrice: number | null;
  uploadPrice: number | null;
  action: PriceUploadAction;
  errorReason?: string;
};

export type ParsedPriceRow = {
  excelRow: number;
  partNumber: string;
  unitPrice: number;
};
