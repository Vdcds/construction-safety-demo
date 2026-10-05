import { useState } from "react";
import {
  AlertTriangle,
  Search,
  Download,
  ShieldCheck,
  ChevronRight,
  HardHat,
  SquareDashedMousePointer,
  Forklift,
} from "lucide-react";
import type { Violation } from "../types";

const names: Record<Violation["type"], string> = {
  missing_helmet: "Missing helmet",
  missing_vest: "Missing safety vest",
  restricted_zone: "Restricted-zone entry",
  proximity: "Machinery proximity",
};
export default function ViolationTable({
  violations,
  all = false,
  onViewAll,
  onOpen,
}: {
  violations: Violation[];
  all?: boolean;
  onViewAll?: () => void;
  onOpen?: (id: string, time: number) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = violations.filter(
    (v) =>
      (filter === "all" ||
        (filter === "ppe"
          ? v.type.startsWith("missing")
          : v.type === filter)) &&
      `${names[v.type]} ${v.filename} ${v.worker_id ?? ""} ${v.detail}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const visible = filtered.slice(
    all ? page * 10 : 0,
    all ? (page + 1) * 10 : 5,
  );
  return (
    <section className="panel violations-panel">
      <div className="panel-heading">
        <div>
          <AlertTriangle size={18} />
          <h2>{all ? "Violation history" : "Recent violations"}</h2>
          <span className="count-badge">{violations.length}</span>
        </div>
        {all ? (
          <a className="text-button" href="/api/violations/export" download>
            <Download size={15} />
            Export CSV
          </a>
        ) : (
          <button className="text-button" onClick={onViewAll}>
            View all history
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      <div className="table-toolbar">
        <div className="filter-tabs" aria-label="Filter violations">
          {[
            ["all", "All events"],
            ["ppe", "PPE"],
            ["restricted_zone", "Zone entry"],
            ["proximity", "Proximity"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? "chosen" : ""}
              onClick={() => {
                setFilter(id);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="table-search">
          <Search size={15} />
          <input
            aria-label="Search violations"
            placeholder="Search events…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Violation</th>
              <th>Worker</th>
              <th>{all ? "Source file" : "Media time"}</th>
              <th>Severity</th>
              <th>Detected at</th>
              <th aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => {
              const Icon = v.type.startsWith("missing")
                ? HardHat
                : v.type === "restricted_zone"
                  ? SquareDashedMousePointer
                  : Forklift;
              return (
                <tr key={v.id}>
                  <td>
                    <span className={`event-icon ${v.severity}`}>
                      <Icon size={16} />
                    </span>
                    <div className="event-name">
                      <strong>{names[v.type]}</strong>
                      <small>
                        {v.source === "guided_demo"
                          ? "Guided example"
                          : v.detail}
                      </small>
                    </div>
                  </td>
                  <td>
                    <span className="worker-id">
                      {v.worker_id === null
                        ? "Untracked"
                        : `#${String(v.worker_id).padStart(2, "0")}`}
                    </span>
                  </td>
                  <td>
                    {all ? (
                      <span className="filename-cell" title={v.filename}>
                        {v.filename}
                      </span>
                    ) : (
                      <span className="timestamp">
                        {Math.floor(v.timestamp / 60)
                          .toString()
                          .padStart(2, "0")}
                        :
                        {Math.floor(v.timestamp % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`severity ${v.severity}`}>
                      <i />
                      {v.severity === "critical" ? "Critical" : "Warning"}
                    </span>
                  </td>
                  <td className="date-cell">
                    {new Date(v.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {onOpen && (
                      <button
                        className="icon-button"
                        title="View this analysis"
                        aria-label={`View ${names[v.type]} analysis`}
                        onClick={() => onOpen(v.job_id, v.timestamp)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && (
        <div className="empty-events">
          <span>
            <ShieldCheck size={25} />
          </span>
          <div>
            <strong>
              {violations.length
                ? "No matching events"
                : "A clear view of your site safety"}
            </strong>
            <p>
              {violations.length
                ? "Try another filter or search term."
                : "Run an analysis to see detected safety violations here."}
            </p>
          </div>
        </div>
      )}
      <div className="table-footer">
        <span>
          {filtered.length
            ? `Showing ${all ? page * 10 + 1 : 1}–${Math.min(all ? (page + 1) * 10 : 5, filtered.length)} of ${filtered.length} events`
            : "No events to display"}
        </span>
        <span>
          {all ? (
            <>
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button
                disabled={(page + 1) * 10 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </>
          ) : (
            "Events are saved locally"
          )}
        </span>
      </div>
    </section>
  );
}
