import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  ChevronRight,
  CircleHelp,
  X,
  CheckCircle2,
  AlertCircle,
  Video,
  Image,
  ShieldCheck,
  HardHat,
  SquareDashedMousePointer,
  Forklift,
  Cpu,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { api } from "./api/client";
import type { Job, ModelInfo, Page, Violation, Zone } from "./types";
import Sidebar from "./components/Sidebar";
import Stats from "./components/Stats";
import MediaViewer from "./components/MediaViewer";
import Controls from "./components/Controls";
import ViolationTable from "./components/ViolationTable";

const titles: Record<Page, { title: string; subtitle: string }> = {
  overview: {
    title: "Site overview",
    subtitle: "A clearer view of your site. A safer day for your team.",
  },
  history: {
    title: "Violation history",
    subtitle: "Every flagged event, saved locally and ready to review.",
  },
  setup: {
    title: "Detection setup",
    subtitle: "Understand your model and the checks available for your demo.",
  },
  guide: {
    title: "Your demo, step by step",
    subtitle: "From site footage to safety insights in a few simple steps.",
  },
};

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [job, setJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<Job[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confidence, setConfidence] = useState(0.35);
  const [proximity, setProximity] = useState(120);
  const [zone, setZone] = useState<Zone | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const processing = job?.status === "processing" || job?.status === "queued";
  const busy = loading || processing;

  const refreshHistory = useCallback(async () => {
    const [events, jobs] = await Promise.all([api.violations(), api.jobs()]);
    setViolations(events);
    setHistory(jobs);
  }, []);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const health = await api.health();
        if (active) {
          setOnline(true);
          setModel(health.model);
        }
      } catch {
        if (active) setOnline(false);
      }
    }
    void check();
    void refreshHistory().catch(() => {});
    const timer = window.setInterval(check, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshHistory]);

  useEffect(() => {
    if (!processing || !job) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const next = await api.job(job.id);
        if (!active) return;
        setJob(next);
        if (next.status === "completed") {
          setNotice("Analysis complete. Your safety events have been saved.");
          await refreshHistory();
        }
        if (next.status === "failed")
          setError(next.error || "Analysis failed. Try a different file.");
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [processing, job?.id, refreshHistory]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function upload(file?: File) {
    if (!file || busy) return;
    setLoading(true);
    setError("");
    setDrawing(false);
    try {
      const next = await api.upload(file);
      setJob(next);
      setZone(null);
      setPage("overview");
      setNotice("Media ready. Define a zone if needed, then run analysis.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function run(guided = false) {
    if (busy) return;
    setLoading(true);
    setError("");
    setDrawing(false);
    setPage("overview");
    try {
      let next = job;
      let selectedZone = zone;
      if (guided || !next) {
        next = await api.demo(guided);
        if (guided) {
          selectedZone = next.suggested_zone || null;
          setZone(selectedZone);
        }
        setJob(next);
      }
      next = await api.process(next.id, {
        confidence,
        proximity,
        zone: selectedZone,
      });
      setJob(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function openAnalysis(id: string, timestamp = 0) {
    if (busy) return;
    setLoading(true);
    setError("");
    try {
      const next = await api.job(id);
      setJob(next);
      setZone(next.options?.zone || null);
      setConfidence(next.options?.confidence || 0.35);
      setProximity(next.options?.proximity || 120);
      setPage("overview");
      setDrawing(false);
      if (next.media_type === "video") {
        window.setTimeout(() => {
          const player = document.querySelector("video");
          if (player) {
            player.currentTime = timestamp;
          }
        }, 300);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const controlProps = {
    job,
    confidence,
    setConfidence,
    proximity,
    setProximity,
    zone,
    drawing,
    onDraw: () => setDrawing(!drawing),
    onClear: () => {
      setZone(null);
      setDrawing(false);
    },
    onRun: () => void run(),
    onDemo: () => void run(true),
    busy: !!busy,
    model,
  };
  const currentEvents = job
    ? violations.filter((v) => v.job_id === job.id)
    : [];

  return (
    <div
      className="app-shell"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragCount.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragCount.current--;
        if (dragCount.current <= 0) {
          dragCount.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCount.current = 0;
        setDragging(false);
        void upload(e.dataTransfer.files[0]);
      }}
    >
      <Sidebar page={page} onNavigate={setPage} online={online} />
      <main className="main-content">
        <div className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <span>
              {page === "overview"
                ? "Overview"
                : page === "history"
                  ? "Violation history"
                  : page === "setup"
                    ? "Detection setup"
                    : "Demo guide"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span />
              Local demo
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Open demo guide"
              onClick={() => setPage("guide")}
            >
              <CircleHelp size={19} />
            </button>
            <span className="top-avatar">SG</span>
          </div>
        </div>
        <div className="page-content">
          <header className="page-heading">
            <div>
              <h1>{titles[page].title}</h1>
              <p>{titles[page].subtitle}</p>
            </div>
            <div className="header-actions">
              <a className="secondary" href="/api/violations/export" download>
                <Download size={16} />
                Export CSV
              </a>
              <button
                className="primary"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                {loading ? "Preparing…" : "Upload media"}
              </button>
            </div>
          </header>
          <input
            ref={input}
            type="file"
            className="file-input"
            accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.avi,.mkv,.webm"
            aria-label="Upload site image or video"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!online && (
            <div className="alert backend-alert">
              <Cpu size={17} />
              <span>
                Waiting for the local backend. Start it with{" "}
                <code>uvicorn backend.main:app --port 8000</code>.
              </span>
            </div>
          )}
          {page === "overview" && (
            <>
              <Stats job={job} />
              <div className="analysis-layout">
                <MediaViewer
                  job={job}
                  zone={zone}
                  onZone={setZone}
                  drawing={drawing}
                  setDrawing={setDrawing}
                  onUpload={() => input.current?.click()}
                  busy={!!busy}
                />
                <Controls {...controlProps} />
              </div>
              <ViolationTable
                violations={currentEvents}
                onViewAll={() => setPage("history")}
                onOpen={(id, time) => void openAnalysis(id, time)}
              />
              <div className="demo-footnote">
                <ShieldCheck size={15} />
                <span>
                  Construction Site Safety Compliance & Activity Monitoring
                  System
                </span>
                <span>Local processing. Clearer insights.</span>
              </div>
            </>
          )}
          {page === "history" && (
            <>
              <div className="history-summary">
                <span className="history-icon">
                  <FolderOpen size={24} />
                </span>
                <div>
                  <strong>
                    {history.filter((j) => j.status === "completed").length}{" "}
                    completed analyses
                  </strong>
                  <p>
                    {violations.length} safety events across your local
                    workspace
                  </p>
                </div>
                <span className="tag">SQLite history</span>
              </div>
              <ViolationTable
                key="history"
                violations={violations}
                all
                onOpen={(id, time) => void openAnalysis(id, time)}
              />
              <section className="panel analysis-history">
                <div className="panel-heading">
                  <div>
                    <Image size={18} />
                    <h2>Media analyses</h2>
                  </div>
                </div>
                {history.length ? (
                  history.map((j) => (
                    <button
                      className="history-row"
                      disabled={!!busy}
                      key={j.id}
                      onClick={() => void openAnalysis(j.id)}
                    >
                      <img src={j.preview_url} alt="" />
                      <div>
                        <strong>{j.filename}</strong>
                        <small>
                          {j.source === "guided_demo"
                            ? "Guided example"
                            : j.media_type === "video"
                              ? "Video analysis"
                              : "Image analysis"}{" "}
                          · {new Date(j.created_at).toLocaleString()}
                        </small>
                      </div>
                      <span className={`job-status ${j.status}`}>
                        {j.status}
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))
                ) : (
                  <div className="empty-history">
                    Your uploaded media analyses will appear here.
                  </div>
                )}
              </section>
            </>
          )}
          {page === "setup" && (
            <div className="setup-layout">
              <section className="panel model-panel">
                <div className="panel-heading">
                  <div>
                    <Cpu size={19} />
                    <h2>Your detection model</h2>
                  </div>
                  <span className="tag">
                    {model?.custom ? "Custom" : "Standard"}
                  </span>
                </div>
                <div className="model-content">
                  <span className="model-large-icon">
                    <ScanIcon />
                  </span>
                  <h2>{model?.name || "YOLO11n"}</h2>
                  <p>
                    {model?.note ||
                      "Standard YOLO detects people and vehicles. Add a custom construction model to enable PPE detection."}
                  </p>
                  <div className="model-instruction">
                    <strong>Enable construction-specific detection</strong>
                    <p>
                      Place your trained Ultralytics model at{" "}
                      <code>models/best.pt</code>. The next analysis will
                      automatically use it.
                    </p>
                  </div>
                  <h3>Supported class names</h3>
                  <div className="class-groups">
                    <div>
                      <strong>Workers</strong>
                      <span>Person, worker</span>
                    </div>
                    <div>
                      <strong>Helmet</strong>
                      <span>Hardhat, helmet, NO-Hardhat</span>
                    </div>
                    <div>
                      <strong>Safety vest</strong>
                      <span>Safety Vest, vest, NO-Safety Vest</span>
                    </div>
                    <div>
                      <strong>Machinery</strong>
                      <span>
                        machinery, excavator, crane, forklift, truck, vehicle
                      </span>
                    </div>
                  </div>
                  <a
                    className="docs-link"
                    href="https://docs.ultralytics.com/modes/track/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ultralytics tracking documentation
                    <ExternalLink size={14} />
                  </a>
                </div>
              </section>
              <Controls {...controlProps} />
            </div>
          )}
          {page === "guide" && (
            <>
              <div className="guide-intro">
                <span className="guide-shield">
                  <ShieldCheck size={32} />
                </span>
                <div>
                  <h2>A small system. A complete safety workflow.</h2>
                  <p>
                    This local MVP turns images and short videos into annotated
                    media and a reviewable safety log.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void run(true)}
                >
                  Try guided demo
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="guide-grid">
                {[
                  {
                    icon: Upload,
                    title: "Upload site media",
                    body: "Choose an image or a video up to 100 MB. Keep video clips under two minutes for a smooth local demo.",
                  },
                  {
                    icon: SquareDashedMousePointer,
                    title: "Mark one restricted zone",
                    body: "Click Draw restricted zone, then drag a rectangle on the image. The bottom center of each worker box is checked against this area.",
                  },
                  {
                    icon: HardHat,
                    title: "Run the safety checks",
                    body: "YOLO detects objects. A custom PPE model enables helmet and vest checks. ByteTrack adds worker IDs to videos.",
                  },
                  {
                    icon: Forklift,
                    title: "Review proximity warnings",
                    body: "Workers near a machinery bounding box are flagged. The distance is measured in image pixels, rather than real-world meters.",
                  },
                  {
                    icon: Video,
                    title: "Review annotated results",
                    body: "See detections on images or play the processed video. Events for each tracked worker and violation type are logged at five-second intervals.",
                  },
                  {
                    icon: Download,
                    title: "Export your violation history",
                    body: "Open Violation history to review events across analyses. Export CSV creates a file ready to open in a spreadsheet.",
                  },
                ].map(({ icon: Icon, title, body }, index) => (
                  <article key={title} className="guide-card">
                    <div>
                      <span>
                        <Icon size={23} />
                      </span>
                      <small>Step {index + 1}</small>
                    </div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
              <div className="guide-caveat">
                <AlertCircle size={20} />
                <div>
                  <strong>Know what the demo shows</strong>
                  <p>
                    The guided example uses fixed illustrative annotations, not
                    YOLO predictions. Real uploads use your selected model.
                    Missing PPE inferred from absent detections is a review
                    prompt; zones and proximity use simple image-space rules.
                    Output videos have no audio.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        <footer className="page-footer">
          <span>
            SiteGuard <span>·</span> Construction safety monitoring
          </span>
          <span>Made for a safer worksite.</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Upload size={38} />
          <h2>Drop your site media here</h2>
          <p>Images or videos · up to 100 MB</p>
        </div>
      )}
    </div>
  );
}

function ScanIcon() {
  return <ShieldCheck size={36} />;
}
