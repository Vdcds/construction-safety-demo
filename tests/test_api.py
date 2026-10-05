import csv
import io
import time
import pytest
from fastapi.testclient import TestClient
from backend import database
from backend.main import app


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    old = database.DB_PATH
    database.DB_PATH = tmp_path_factory.mktemp("db") / "test.db"
    with TestClient(app) as client:
        yield client
    database.DB_PATH = old


def test_upload_rejects_bad_extension_and_unreadable_media(client):
    assert (
        client.post("/api/upload", files={"file": ("payload.txt", b"bad")}).status_code
        == 400
    )
    assert (
        client.post(
            "/api/upload", files={"file": ("image.jpg", b"not an image")}
        ).status_code
        == 400
    )


def test_invalid_zone_and_unknown_job(client):
    assert client.get("/api/jobs/not-found").status_code == 404
    response = client.post(
        "/api/jobs/not-found/process",
        json={"zone": {"x1": 0.8, "y1": 0.1, "x2": 0.1, "y2": 0.9}},
    )
    assert response.status_code == 422


def wait_for_job(client, job_id):
    for _ in range(100):
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in {"completed", "failed"}:
            return job
        time.sleep(0.05)
    pytest.fail("Guided analysis did not finish in time")


def test_demo_processing_logging_export_and_immutable_history(client):
    response = client.post("/api/demo")
    assert response.status_code == 201
    ready = response.json()
    assert client.get(ready["preview_url"]).status_code == 200
    options = {"confidence": 0.35, "proximity": 120, "zone": ready["suggested_zone"]}
    assert (
        client.post(f"/api/jobs/{ready['id']}/process", json=options).status_code == 202
    )
    job = wait_for_job(client, ready["id"])
    assert job["status"] == "completed", job.get("error")
    assert job["summary"]["workers"] == 2
    assert job["summary"]["ppe"] == 1
    assert job["summary"]["zone"] == 1
    assert job["summary"]["proximity"] >= 1
    assert client.get(job["output_url"]).status_code == 200
    events = client.get(f"/api/violations?job_id={job['id']}").json()
    assert len(events) == job["summary"]["violations"]
    assert all(v["source"] == "guided_demo" for v in events)
    csv_response = client.get("/api/violations/export")
    assert "text/csv" in csv_response.headers["content-type"]
    assert len(list(csv.DictReader(io.StringIO(csv_response.text)))) == len(events)
    rerun = client.post(f"/api/jobs/{job['id']}/process", json=options).json()
    assert rerun["id"] != job["id"]
    assert wait_for_job(client, rerun["id"])["status"] == "completed"
    assert client.get(f"/api/jobs/{job['id']}").json()["options"] == options
