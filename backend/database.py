"""SQLite persistence; each operation owns its connection."""

import csv
import io
import json
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("SAFETY_DB", Path(__file__).parent / "safety.db"))


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, filename TEXT NOT NULL,
                media_type TEXT NOT NULL, source TEXT NOT NULL,
                status TEXT NOT NULL, created_at TEXT NOT NULL,
                data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL REFERENCES jobs(id),
                worker_id INTEGER, type TEXT NOT NULL,
                severity TEXT NOT NULL, timestamp REAL NOT NULL,
                frame INTEGER NOT NULL, detail TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS violations_job ON violations(job_id);
        """)
        # A local restart cannot resume an in-memory processing task.
        for row in conn.execute(
            "SELECT * FROM jobs WHERE status IN ('queued','processing')"
        ).fetchall():
            job = json.loads(row["data"])
            job.update(
                status="failed", error="Processing was interrupted. Run analysis again."
            )
            conn.execute(
                "UPDATE jobs SET status='failed', data=? WHERE id=?",
                (json.dumps(job), row["id"]),
            )


def save_job(job):
    with connect() as conn:
        conn.execute(
            """INSERT INTO jobs VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data""",
            (
                job["id"],
                job["filename"],
                job["media_type"],
                job["source"],
                job["status"],
                job["created_at"],
                json.dumps(job),
            ),
        )


def get_job(job_id):
    with connect() as conn:
        row = conn.execute("SELECT data FROM jobs WHERE id=?", (job_id,)).fetchone()
        return json.loads(row["data"]) if row else None


def list_jobs():
    with connect() as conn:
        return [
            json.loads(row["data"])
            for row in conn.execute("SELECT data FROM jobs ORDER BY created_at DESC")
        ]


def replace_violations(job_id, events, created_at):
    with connect() as conn:
        conn.execute("DELETE FROM violations WHERE job_id=?", (job_id,))
        conn.executemany(
            """INSERT INTO violations
            (job_id,worker_id,type,severity,timestamp,frame,detail,created_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            [
                (
                    job_id,
                    e["worker_id"],
                    e["type"],
                    e["severity"],
                    e["timestamp"],
                    e["frame"],
                    e["detail"],
                    created_at,
                )
                for e in events
            ],
        )


def list_violations(job_id=None):
    with connect() as conn:
        query = """SELECT v.*, j.filename, j.source FROM violations v
            JOIN jobs j ON j.id=v.job_id"""
        params = ()
        if job_id:
            query += " WHERE job_id=?"
            params = (job_id,)
        query += " ORDER BY v.created_at DESC, v.timestamp DESC, v.id DESC"
        return [dict(row) for row in conn.execute(query, params)]


def export_csv(job_id=None):
    stream = io.StringIO()
    fields = [
        "id",
        "filename",
        "source",
        "worker_id",
        "type",
        "severity",
        "timestamp",
        "frame",
        "detail",
        "created_at",
        "job_id",
    ]
    writer = csv.DictWriter(stream, fields)
    writer.writeheader()
    for row in list_violations(job_id):
        # Uploaded filenames are user input; don't turn them into spreadsheet formulas.
        writer.writerow(
            {
                k: (
                    "'" + str(v)
                    if isinstance(v, str) and v.startswith(("=", "+", "-", "@"))
                    else v
                )
                for k, v in row.items()
            }
        )
    return stream.getvalue()
