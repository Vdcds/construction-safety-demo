import {
  Users,
  ShieldAlert,
  HardHat,
  Forklift,
  ArrowUpRight,
} from "lucide-react";
import type { Job } from "../types";

export default function Stats({ job }: { job: Job | null }) {
  const summary = job?.status === "completed" ? job.summary : undefined;
  const ppeAvailable = !!job?.model?.helmet || !!job?.model?.vest;
  const stats = [
    {
      label: "Workers detected",
      value: summary?.workers,
      icon: Users,
      color: "blue",
      note:
        job?.media_type === "video"
          ? "Unique tracked workers"
          : "Workers in this image",
    },
    {
      label: "Safety violations",
      value: summary?.violations,
      icon: ShieldAlert,
      color: "red",
      note: `${summary?.zone || 0} restricted-zone ${summary?.zone === 1 ? "entry" : "entries"}`,
    },
    {
      label: "PPE violations",
      value: ppeAvailable ? summary?.ppe : undefined,
      icon: HardHat,
      color: "amber",
      note: ppeAvailable
        ? "Helmet & safety vest checks"
        : "Requires a construction PPE model",
    },
    {
      label: "Proximity warnings",
      value: summary?.proximity,
      icon: Forklift,
      color: "purple",
      note: "Worker–machinery proximity",
    },
  ];
  return (
    <div className="stats">
      {stats.map(({ label, value, icon: Icon, color, note }) => (
        <article className="stat" key={label}>
          <div className="stat-top">
            <span>{label}</span>
            <span className={`stat-icon ${color}`}>
              <Icon size={20} />
            </span>
          </div>
          <div className="stat-value">
            {value ?? "—"}
            {value !== undefined && (
              <span
                className={
                  value > 0 && color !== "blue"
                    ? "stat-state attention"
                    : "stat-state"
                }
              >
                {color === "blue"
                  ? "Detected"
                  : value > 0
                    ? "Needs review"
                    : "No alerts"}
              </span>
            )}
          </div>
          <div className="stat-note">
            {!summary ? "Ready for your first analysis" : note}
            <ArrowUpRight size={13} />
          </div>
        </article>
      ))}
    </div>
  );
}
