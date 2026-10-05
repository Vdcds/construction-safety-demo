import { useEffect, useRef, useState } from "react";
import {
  ScanLine,
  Maximize2,
  Minimize2,
  Upload,
  Film,
  Image as ImageIcon,
  MousePointer2,
  Download,
  X,
} from "lucide-react";
import type { Job, Zone } from "../types";

type Props = {
  job: Job | null;
  zone: Zone | null;
  onZone: (z: Zone | null) => void;
  drawing: boolean;
  setDrawing: (value: boolean) => void;
  onUpload: () => void;
  busy: boolean;
};
export default function MediaViewer({
  job,
  zone,
  onZone,
  drawing,
  setDrawing,
  onUpload,
  busy,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Zone | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const processing = job?.status === "queued" || job?.status === "processing";
  const completed = job?.status === "completed";
  const showVideo = completed && job?.media_type === "video" && !drawing;
  const displayZone = draft || zone;
  const src = drawing
    ? job?.preview_url || "/construction-site.jpg"
    : job?.output_url ||
      (processing && job?.preview_result_url
        ? `${job.preview_result_url}?frame=${job.processed_frames}`
        : job?.preview_url) ||
      "/construction-site.jpg";
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
        setDrawing(false);
        start.current = null;
        setDraft(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [setDrawing]);
  useEffect(() => {
    if (drawing) video.current?.pause();
  }, [drawing]);
  function point(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }
  function stopDraw(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const end = point(e),
      first = start.current;
    const next = {
      x1: Math.min(first.x, end.x),
      y1: Math.min(first.y, end.y),
      x2: Math.max(first.x, end.x),
      y2: Math.max(first.y, end.y),
    };
    start.current = null;
    setDraft(null);
    if (next.x2 - next.x1 > 0.015 && next.y2 - next.y1 > 0.015) {
      onZone(next);
      setDrawing(false);
    }
  }
  return (
    <section className={`panel monitor ${expanded ? "expanded" : ""}`}>
      <div className="panel-heading">
        <div>
          <ScanLine size={19} />
          <h2>Site monitor</h2>
          <span className="tag">
            {job?.media_type === "video" ? "Video" : "Image"}
          </span>
        </div>
        <button
          className="icon-button"
          title={expanded ? "Close expanded view" : "Expand view"}
          aria-label={expanded ? "Close expanded view" : "Expand view"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
      <div className="media-stage">
        <div
          className={`media-content ${drawing ? "drawing" : ""}`}
          style={{
            aspectRatio: `${job?.width || 1600} / ${job?.height || 1060}`,
          }}
          onPointerDown={(e) => {
            if (!drawing) return;
            e.preventDefault();
            start.current = point(e);
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraft(null);
          }}
          onPointerMove={(e) => {
            if (!drawing || !start.current) return;
            const p = point(e),
              s = start.current;
            setDraft({
              x1: Math.min(s.x, p.x),
              y1: Math.min(s.y, p.y),
              x2: Math.max(s.x, p.x),
              y2: Math.max(s.y, p.y),
            });
          }}
          onPointerUp={stopDraw}
          onPointerCancel={() => {
            start.current = null;
            setDraft(null);
          }}
        >
          {showVideo ? (
            <video
              key={src}
              ref={video}
              src={src}
              controls
              playsInline
              aria-label="Analyzed video with worker tracking and safety annotations"
            />
          ) : (
            <img
              src={src}
              alt={
                completed && !drawing
                  ? "Construction site with object detections and safety annotations"
                  : "Construction site media preview"
              }
              draggable={false}
            />
          )}
          {!showVideo && (
            <>
              <div className="media-badges">
                <span
                  className={`media-badge ${completed && !drawing ? "analyzed" : ""}`}
                >
                  <span />
                  {drawing
                    ? "Zone editor"
                    : processing
                      ? "Analyzing media"
                      : completed
                        ? job?.source === "guided_demo"
                          ? "Guided example"
                          : "Analysis complete"
                        : "Preview · Not analyzed"}
                </span>
                <span className="media-badge dark">
                  {job?.filename || "Construction site example"}
                </span>
              </div>
              {displayZone && (drawing || !completed) && (
                <div
                  className="zone-rectangle"
                  style={{
                    left: `${displayZone.x1 * 100}%`,
                    top: `${displayZone.y1 * 100}%`,
                    width: `${(displayZone.x2 - displayZone.x1) * 100}%`,
                    height: `${(displayZone.y2 - displayZone.y1) * 100}%`,
                  }}
                >
                  <span>Restricted zone</span>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              )}
              {!job && !drawing && (
                <button className="media-upload" onClick={onUpload}>
                  <Upload size={16} /> Upload your site media
                </button>
              )}
              {drawing && (
                <div className="drawing-instruction">
                  <MousePointer2 size={15} /> Drag to define one restricted zone{" "}
                  <button
                    aria-label="Cancel drawing"
                    onClick={() => setDrawing(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {processing && (
        <div
          className="processing-bar"
          role="progressbar"
          aria-valuenow={job.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ width: `${Math.max(3, job.progress)}%` }} />
        </div>
      )}
      <div className="monitor-footer">
        <div className="legend">
          <span>
            <i className="worker" />
            Worker
          </span>
          <span>
            <i className="machine" />
            Machinery
          </span>
          <span>
            <i className="violation" />
            Violation
          </span>
        </div>
        <span className="media-meta">
          {job?.media_type === "video" ? (
            <Film size={14} />
          ) : (
            <ImageIcon size={14} />
          )}
          {job
            ? `${job.width} × ${job.height}${job.media_type === "video" ? ` · ${job.duration}s` : ""}`
            : "Sample image"}
        </span>
      </div>
      <div className="monitor-bottom">
        <span>
          <span className="tiny-dot" />
          {processing
            ? `Processing ${job.processed_frames || 0} of ${job.total_frames} frames · ${job.progress}%`
            : completed
              ? job?.source === "guided_demo"
                ? "Fixed example annotations · Not YOLO predictions"
                : `${job?.model?.name} detection${job?.media_type === "video" ? " + ByteTrack tracking" : ""}`
              : "Upload an image or video to start monitoring"}
        </span>
        {completed && job?.output_url && (
          <a href={job.output_url} download>
            <Download size={14} />
            Download result
          </a>
        )}
        {busy && !processing && <span>Preparing…</span>}
      </div>
    </section>
  );
}
