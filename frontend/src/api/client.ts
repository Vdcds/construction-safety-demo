import type { Job, ModelInfo, Options, Violation } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new Error(
      "Cannot reach the backend. Start the Python server on port 8000.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed (${response.status}). Check the backend server.`,
    );
  }
  return response.json();
}

export const api = {
  health: () =>
    request<{ status: string; model: ModelInfo; ffmpeg: boolean }>("/health"),
  jobs: () => request<Job[]>("/jobs"),
  job: (id: string) => request<Job>(`/jobs/${id}`),
  violations: (id?: string) =>
    request<Violation[]>(`/violations${id ? `?job_id=${id}` : ""}`),
  demo: (guided: boolean) =>
    request<Job>(`/demo?guided=${guided}`, { method: "POST" }),
  upload: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Job>("/upload", { method: "POST", body });
  },
  process: (id: string, options: Options) =>
    request<Job>(`/jobs/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    }),
};
