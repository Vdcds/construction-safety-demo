export type Zone = { x1: number; y1: number; x2: number; y2: number };
export type Options = {
  confidence: number;
  proximity: number;
  zone: Zone | null;
};
export type ModelInfo = {
  name: string;
  custom: boolean;
  helmet: boolean;
  vest: boolean;
  note: string;
  classes: string[];
};
export type Job = {
  id: string;
  filename: string;
  media_type: "image" | "video";
  source: string;
  status: "ready" | "queued" | "processing" | "completed" | "failed";
  progress: number;
  created_at: string;
  width: number;
  height: number;
  fps: number;
  total_frames: number;
  processed_frames?: number;
  duration: number;
  preview_url: string;
  output_url?: string;
  preview_result_url?: string;
  error?: string;
  model?: ModelInfo;
  suggested_zone?: Zone;
  options?: Options;
  summary?: {
    workers: number;
    machinery: number;
    violations: number;
    ppe: number;
    zone: number;
    proximity: number;
  };
};
export type Violation = {
  id: number;
  job_id: string;
  worker_id: number | null;
  type: "missing_helmet" | "missing_vest" | "restricted_zone" | "proximity";
  severity: "warning" | "critical";
  timestamp: number;
  frame: number;
  detail: string;
  created_at: string;
  filename: string;
  source: string;
};
export type Page = "overview" | "history" | "setup" | "guide";
