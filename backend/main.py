"""Local API: upload, configure, process, inspect, export."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4
import shutil
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from . import database
from .detector import model_info
from .models import ProcessOptions, Zone
from .processor import run_job
from .utils import (
    ROOT,
    UPLOADS,
    OUTPUTS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    MAX_BYTES,
    inspect_media,
)

executor = ThreadPoolExecutor(max_workers=1)
job_lock = Lock()


@asynccontextmanager
async def lifespan(app):
    UPLOADS.mkdir(exist_ok=True)
    OUTPUTS.mkdir(exist_ok=True)
    database.init_db()
    yield
    executor.shutdown(wait=True)


app = FastAPI(title="Construction Site Safety Monitoring", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS)), name="outputs")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model": model_info(),
        "ffmpeg": bool(shutil.which("ffmpeg")),
    }


def require_job(job_id):
    job = database.get_job(job_id)
    if not job:
        raise HTTPException(404, "Analysis not found.")
    return job


def new_job(filename, media_type, source, path):
    job_id = uuid4().hex
    metadata = inspect_media(path, media_type, job_id)
    job = dict(
        id=job_id,
        filename=filename,
        media_type=media_type,
        source=source,
        status="ready",
        progress=0,
        created_at=datetime.now(timezone.utc).isoformat(),
        input_path=str(path),
        **metadata,
    )
    database.save_job(job)
    return job


@app.post("/api/upload", status_code=201)
async def upload(file: UploadFile = File(...)):
    filename = Path(file.filename or "upload").name
    extension = Path(filename).suffix.lower()
    if extension not in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS:
        raise HTTPException(
            400, "Upload a JPG, PNG, WebP, MP4, MOV, AVI, MKV or WebM file."
        )
    path = UPLOADS / f"{uuid4().hex}{extension}"
    try:
        size = 0
        with path.open("wb") as stream:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, "Use a file smaller than 100 MB.")
                stream.write(chunk)
        return new_job(
            filename,
            "image" if extension in IMAGE_EXTENSIONS else "video",
            "upload",
            path,
        )
    except ValueError as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@app.post("/api/demo", status_code=201)
def demo(guided: bool = True):
    path = ROOT / "frontend" / "public" / "construction-site.jpg"
    job = new_job(
        "Construction site example.jpg",
        "image",
        "guided_demo" if guided else "sample",
        path,
    )
    job["suggested_zone"] = Zone(x1=0.43, y1=0.68, x2=0.60, y2=0.91).model_dump()
    database.save_job(job)
    return job


@app.post("/api/jobs/{job_id}/process", status_code=202)
def process(job_id: str, options: ProcessOptions):
    with job_lock:
        job = require_job(job_id)
        if job["status"] in {"processing", "queued"}:
            raise HTTPException(409, "This media is already being analyzed.")
        # A completed analysis remains immutable in history; rerun as a new job.
        if job["status"] == "completed":
            previous = job
            job = new_job(
                previous["filename"],
                previous["media_type"],
                previous["source"],
                previous["input_path"],
            )
        job.update(status="queued", progress=0, options=options.model_dump())
        database.save_job(job)
        executor.submit(run_job, job["id"], options)
    return job


@app.get("/api/jobs")
def jobs():
    return database.list_jobs()


@app.get("/api/jobs/{job_id}")
def job(job_id: str):
    return require_job(job_id)


@app.get("/api/violations")
def violations(job_id: str | None = None):
    return database.list_violations(job_id)


@app.get("/api/violations/export")
def export(job_id: str | None = None):
    return Response(
        database.export_csv(job_id),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="safety-violations.csv"'},
    )
