import {
  SlidersHorizontal,
  ScanLine,
  SquareDashedMousePointer,
  Trash2,
  HardHat,
  Shirt,
  Info,
  Play,
  LoaderCircle,
  Sparkles,
  Check,
  Shield,
} from "lucide-react";
import type { Job, ModelInfo, Zone } from "../types";

type Props = {
  job: Job | null;
  confidence: number;
  setConfidence: (v: number) => void;
  proximity: number;
  setProximity: (v: number) => void;
  zone: Zone | null;
  drawing: boolean;
  onDraw: () => void;
  onClear: () => void;
  onRun: () => void;
  onDemo: () => void;
  busy: boolean;
  model: ModelInfo | null;
};
export default function Controls(p: Props) {
  const guided = p.job?.source === "guided_demo";
  const info = p.job?.model || p.model;
  const unavailableLabel =
    info?.custom && !info.classes.length
      ? "Check after analysis"
      : "Needs PPE model";
  return (
    <section className="panel controls">
      <div className="panel-heading">
        <div>
          <SlidersHorizontal size={18} />
          <h2>Analysis settings</h2>
        </div>
        <span className="tag">Local</span>
      </div>
      <div className="controls-body">
        <div className="control-heading">
          <ScanLine size={17} />
          <h3>Detection</h3>
          <span className="model-chip">
            {guided ? "Example" : info?.name || "YOLO11n"}
          </span>
        </div>
        <label className="range-label" htmlFor="confidence">
          Confidence threshold{" "}
          <strong>{Math.round(p.confidence * 100)}%</strong>
        </label>
        <input
          disabled={p.busy || guided}
          id="confidence"
          type="range"
          min="10"
          max="90"
          value={Math.round(p.confidence * 100)}
          onChange={(e) => p.setConfidence(+e.target.value / 100)}
          style={
            {
              "--range-progress": `${((p.confidence * 100 - 10) / 80) * 100}%`,
            } as React.CSSProperties
          }
        />
        <p className="control-hint">
          Only show detections above this confidence.
        </p>
        <div className="ppe-checks">
          <div>
            <HardHat size={16} />
            Helmet check
            <span
              className={
                guided || info?.helmet ? "capability enabled" : "capability"
              }
            >
              {guided || info?.helmet ? (
                <>
                  <Check size={11} />
                  Enabled
                </>
              ) : (
                unavailableLabel
              )}
            </span>
          </div>
          <div>
            <Shirt size={16} />
            Safety vest check
            <span
              className={
                guided || info?.vest ? "capability enabled" : "capability"
              }
            >
              {guided || info?.vest ? (
                <>
                  <Check size={11} />
                  Enabled
                </>
              ) : (
                unavailableLabel
              )}
            </span>
          </div>
        </div>
        <div className="control-divider" />
        <div className="control-heading">
          <SquareDashedMousePointer size={17} />
          <h3>Restricted zone</h3>
          <span className={`zone-state ${p.zone ? "defined" : ""}`}>
            <i />
            {p.zone ? "Defined" : "Not set"}
          </span>
        </div>
        <p className="control-hint zone-hint">
          Mark an area workers should not enter.
        </p>
        <div className="zone-actions">
          <button
            className={`secondary ${p.drawing ? "selected" : ""}`}
            disabled={p.busy}
            onClick={p.onDraw}
          >
            <SquareDashedMousePointer size={15} />
            {p.drawing
              ? "Cancel drawing"
              : p.zone
                ? "Redraw zone"
                : "Draw restricted zone"}
          </button>
          {p.zone && (
            <button
              className="icon-button"
              disabled={p.busy}
              aria-label="Clear restricted zone"
              onClick={p.onClear}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <div className="control-divider" />
        <div className="control-heading">
          <Shield size={17} />
          <h3>Machinery proximity</h3>
        </div>
        <label className="range-label" htmlFor="proximity">
          Warning distance <strong>{p.proximity} px</strong>
        </label>
        <input
          disabled={p.busy}
          id="proximity"
          type="range"
          min="20"
          max="500"
          step="10"
          value={p.proximity}
          onChange={(e) => p.setProximity(+e.target.value)}
          style={
            {
              "--range-progress": `${((p.proximity - 20) / 480) * 100}%`,
            } as React.CSSProperties
          }
        />
        <p className="control-hint">
          Image-space distance between bounding boxes.
        </p>
        <button
          className="primary run-button"
          disabled={p.busy || p.drawing}
          onClick={p.onRun}
        >
          {p.busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
          {p.busy
            ? "Analyzing…"
            : p.job?.status === "completed"
              ? "Run analysis again"
              : "Run analysis"}
        </button>
        <div className="settings-note">
          <Info size={13} />
          <span>
            {guided
              ? "Guided mode uses fixed example annotations."
              : "Settings apply when you run an analysis."}
          </span>
        </div>
      </div>
      <button className="guided-demo" disabled={p.busy} onClick={p.onDemo}>
        <span className="guided-icon">
          <Sparkles size={17} />
        </span>
        <span>
          <strong>Try the guided demo</strong>
          <small>See all safety checks in action</small>
        </span>
        <span className="guided-arrow">↗</span>
      </button>
    </section>
  );
}
