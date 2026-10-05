"""A single background worker processes short clips without blocking FastAPI."""

import shutil
import subprocess
import traceback
from dataclasses import asdict
import cv2
from . import database
from .detector import Detector, model_info, normalize, WORKER_CLASSES, MACHINERY_CLASSES
from .models import Detection, ProcessOptions
from .safety_engine import SafetyEngine
from .tracker import WorkerTracker
from .utils import OUTPUTS, resize_frame, annotate

# Fixed example annotations, deliberately separate from YOLO inference.
DEMO_NAMES = ["Person", "Hardhat", "Safety Vest", "NO-Hardhat", "machinery"]


def demo_detections(width, height):
    def d(label, confidence, box, track_id=None):
        return Detection(
            label,
            confidence,
            tuple(v * (width if i % 2 == 0 else height) for i, v in enumerate(box)),
            track_id,
        )

    return [
        d("Person", 0.96, (0.47, 0.10, 0.61, 0.44)),
        d("Hardhat", 0.94, (0.53, 0.115, 0.585, 0.185)),
        d("Safety Vest", 0.91, (0.485, 0.19, 0.59, 0.335)),
        d("Person", 0.93, (0.445, 0.405, 0.565, 0.865)),
        d("NO-Hardhat", 0.89, (0.50, 0.41, 0.55, 0.485)),
        d("Safety Vest", 0.94, (0.465, 0.47, 0.56, 0.64)),
        d("machinery", 0.92, (0.60, 0.28, 0.715, 0.46)),
    ]


def run_job(job_id, options: ProcessOptions):
    job = database.get_job(job_id)
    events, worker_ids = [], set()
    capture, writer = None, None
    try:
        job.update(
            status="processing", progress=0, error=None, options=options.model_dump()
        )
        database.save_job(job)
        guided = job["source"] == "guided_demo"
        detector = None if guided else Detector(options.confidence)
        names = DEMO_NAMES if guided else detector.names
        engine = SafetyEngine(names, options)
        job["model"] = (
            {
                "name": "Guided example",
                "custom": False,
                "helmet": True,
                "vest": True,
                "classes": names,
                "note": "Fixed illustrative annotations, not YOLO predictions.",
            }
            if guided
            else model_info(names)
        )
        tracker = WorkerTracker(detector) if job["media_type"] == "video" else None
        frame = cv2.imread(job["input_path"]) if job["media_type"] == "image" else None
        if job["media_type"] == "video":
            if not shutil.which("ffmpeg"):
                raise ValueError(
                    "Video output needs FFmpeg. Install it, then run analysis again."
                )
            capture = cv2.VideoCapture(job["input_path"])
            temp = OUTPUTS / f"{job_id}-raw.mp4"
            writer = cv2.VideoWriter(
                str(temp),
                cv2.VideoWriter_fourcc(*"mp4v"),
                job["fps"],
                (job["width"], job["height"]),
            )
            if not writer.isOpened():
                raise ValueError("Could not create the output video.")
        index, peak_workers, peak_machines = 0, 0, 0
        while True:
            if capture:
                success, frame = capture.read()
                if not success:
                    break
            elif index:
                break
            frame = resize_frame(frame)
            detections = (
                demo_detections(job["width"], job["height"])
                if guided
                else (tracker.update(frame) if tracker else detector.detect(frame))
            )
            timestamp = index / job["fps"] if job["fps"] else 0
            active, new_events = engine.check(
                detections, job["width"], job["height"], timestamp, index
            )
            events.extend(new_events)
            workers = [d for d in detections if normalize(d.label) in WORKER_CLASSES]
            worker_ids.update(w.track_id for w in workers if w.track_id is not None)
            peak_workers = max(peak_workers, len(workers))
            peak_machines = max(
                peak_machines,
                sum(normalize(d.label) in MACHINERY_CLASSES for d in detections),
            )
            result = annotate(frame, detections, active, options)
            if guided:
                cv2.putText(
                    result,
                    "GUIDED EXAMPLE - FIXED ANNOTATIONS",
                    (16, result.shape[0] - 18),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )
            if writer:
                writer.write(result)
            else:
                path = OUTPUTS / f"{job_id}-result.jpg"
                if not cv2.imwrite(str(path), result):
                    raise ValueError("Could not write the annotated image.")
                job["output_url"] = f"/outputs/{path.name}"
            if index == 0:
                job["detections"] = [asdict(d) for d in detections]
            if index % 10 == 0:
                cv2.imwrite(str(OUTPUTS / f"{job_id}-progress.jpg"), result)
                job.update(
                    progress=min(95, round((index + 1) / job["total_frames"] * 95)),
                    processed_frames=index + 1,
                    preview_result_url=f"/outputs/{job_id}-progress.jpg",
                )
                database.save_job(job)
            index += 1
        if not index:
            raise ValueError("The video did not contain readable frames.")
        if writer:
            writer.release()
            writer = None
            job.update(progress=97, phase="Preparing video playback")
            database.save_job(job)
            output = OUTPUTS / f"{job_id}-result.mp4"
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    str(temp),
                    "-an",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "ultrafast",
                    "-crf",
                    "23",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    str(output),
                ],
                check=True,
                timeout=180,
                capture_output=True,
            )
            temp.unlink(missing_ok=True)
            job["output_url"] = f"/outputs/{output.name}"
        database.replace_violations(job_id, events, job["created_at"])
        job.update(
            status="completed",
            progress=100,
            processed_frames=index,
            summary=dict(
                workers=len(worker_ids) if tracker else peak_workers,
                machinery=peak_machines,
                violations=len(events),
                ppe=sum(
                    e["type"] in {"missing_helmet", "missing_vest"} for e in events
                ),
                zone=sum(e["type"] == "restricted_zone" for e in events),
                proximity=sum(e["type"] == "proximity" for e in events),
            ),
        )
    except Exception as exc:
        traceback.print_exc()
        job.update(status="failed", error=f"Analysis failed: {exc}")
    finally:
        if capture:
            capture.release()
        if writer:
            writer.release()
        database.save_job(job)
