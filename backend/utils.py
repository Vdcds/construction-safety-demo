"""Media validation and OpenCV drawing."""

from pathlib import Path
import cv2
from .detector import normalize, WORKER_CLASSES, MACHINERY_CLASSES

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "backend" / "uploads"
OUTPUTS = ROOT / "backend" / "outputs"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_BYTES = 100 * 1024 * 1024


def resize_frame(frame):
    height, width = frame.shape[:2]
    if max(height, width) > 1280:
        scale = 1280 / max(height, width)
        frame = cv2.resize(
            frame, (int(width * scale) // 2 * 2, int(height * scale) // 2 * 2)
        )
    # Video codecs require even dimensions.
    return frame[: frame.shape[0] // 2 * 2, : frame.shape[1] // 2 * 2]


def inspect_media(path, media_type, job_id):
    if media_type == "image":
        frame = cv2.imread(str(path))
        fps, frames = 0, 1
    else:
        capture = cv2.VideoCapture(str(path))
        try:
            fps = capture.get(cv2.CAP_PROP_FPS)
            frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
            success, frame = capture.read()
            if not success:
                frame = None
        finally:
            capture.release()
        if fps <= 0 or frames <= 0 or fps > 60:
            raise ValueError("Use a video with a valid frame rate of 60 fps or less.")
        if frames / fps > 120:
            raise ValueError("For this demo, upload a clip of 2 minutes or less.")
    if frame is None or min(frame.shape[:2]) < 32:
        raise ValueError("Could not read this media. Try a JPEG image or an MP4 video.")
    frame = resize_frame(frame)
    preview = OUTPUTS / f"{job_id}-preview.jpg"
    if not cv2.imwrite(str(preview), frame):
        raise ValueError("Could not save the media preview.")
    return dict(
        width=frame.shape[1],
        height=frame.shape[0],
        fps=round(fps, 3),
        total_frames=frames,
        duration=round(frames / fps, 2) if fps else 0,
        preview_url=f"/outputs/{preview.name}",
    )


def draw_label(frame, text, x, y, color):
    x, y = max(0, int(x)), max(24, int(y))
    width = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0][0]
    cv2.rectangle(
        frame, (x, y - 23), (min(x + width + 14, frame.shape[1]), y), color, -1
    )
    cv2.putText(
        frame,
        text,
        (x + 7, y - 7),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )


def annotate(frame, detections, active, options):
    frame = frame.copy()
    height, width = frame.shape[:2]
    if options.zone:
        z = options.zone
        p1, p2 = (
            (int(z.x1 * width), int(z.y1 * height)),
            (int(z.x2 * width), int(z.y2 * height)),
        )
        overlay = frame.copy()
        cv2.rectangle(overlay, p1, p2, (60, 65, 220), -1)
        frame = cv2.addWeighted(overlay, 0.15, frame, 0.85, 0)
        cv2.rectangle(frame, p1, p2, (60, 65, 220), 2)
        draw_label(frame, "Restricted zone", *p1, (60, 65, 220))
    flagged = {id(a["worker"]): a["types"] for a in active}
    for item in detections:
        label = normalize(item.label)
        color = (85, 165, 30)
        if label in MACHINERY_CLASSES:
            color = (175, 135, 20)
        if id(item) in flagged:
            color = (60, 65, 220)
        x1, y1, x2, y2 = map(int, item.box)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        name = "Worker" if label in WORKER_CLASSES else item.label
        if item.track_id is not None and label in WORKER_CLASSES:
            name += f" #{item.track_id:02d}"
        draw_label(frame, f"{name}  {item.confidence:.0%}", x1, y1, color)
        if id(item) in flagged:
            short = {
                "missing_helmet": "No helmet",
                "missing_vest": "No vest",
                "restricted_zone": "Zone entry",
                "proximity": "Proximity",
            }
            draw_label(
                frame,
                " / ".join(short[t] for t in flagged[id(item)]),
                x1,
                min(y2 + 24, height - 2),
                color,
            )
    return frame
