# Construction Site Safety Compliance & Activity Monitoring System

A small local college-project MVP. The SiteGuard dashboard accepts images and short videos, draws YOLO detections, tracks workers with ByteTrack, checks safety rules, saves violations in SQLite, and exports CSV.

## Start the demo

Use **Python 3.12** and **Node.js 20.19+**. Install FFmpeg for browser-playable annotated video (`sudo apt install ffmpeg` on Ubuntu, `sudo pacman -S ffmpeg` on Arch, or `brew install ffmpeg` on macOS).

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install --prefix frontend
```

For a smaller CPU-only install, install PyTorch first:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

Start the backend in one terminal, from the project root:

```bash
source .venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in another:

```bash
npm run dev --prefix frontend
```

Open **http://localhost:5173**. API documentation: **http://localhost:8000/docs**. Once dependencies are installed, `./start.sh` starts both servers together.

## A dependable presentation flow

1. Click **Try the guided demo**. This runs the real safety engine on fixed example annotations: two workers, one missing helmet, machinery nearby, and one restricted zone. Its results and CSV rows are labeled `guided_demo`; these are **not YOLO predictions** and image examples have no tracking IDs.
2. Click **Upload media** or drag a file onto the page. Supported images: JPG/JPEG, PNG, WebP. Videos: MP4, MOV, AVI, MKV, WebM. Maximum 100 MB, two minutes, and 60 fps.
3. Click **Draw restricted zone** and drag one rectangle over the media. Click **Redraw zone** to replace it, or the trash icon to remove it. Escape cancels drawing.
4. Adjust confidence and the pixel proximity threshold, then click **Run analysis**. A progress bar appears for videos; wait for completion before reviewing the video.
5. Inspect the annotated image or play the annotated video. Workers show ByteTrack IDs on video when the tracker has assigned one. Download the result below the viewer.
6. Review events below the viewer. **Violation history** includes events and media across analyses. Use the event arrow to reopen its analysis. **Export CSV** exports all recorded events, including the source and filename.
7. Change settings and run again to create a new analysis; the original remains in history.

The initial construction image is an unprocessed preview. **Run analysis** on this preview runs actual YOLO inference. The guided example is an independent, explicitly labeled illustration.

## Add your construction model

Place your trained Ultralytics detection checkpoint at **`models/best.pt`**. The next analysis loads it automatically using `YOLO(...)`. Without this file, the app downloads **YOLO11n** to `models/yolo11n.pt` on first real analysis. The fallback detects people and common vehicles; it **cannot detect helmets, safety vests, excavators, or other classes outside its dataset**. Its PPE checks are disabled. First real inference needs internet to download the fallback weights; after that, it works offline. This workspace includes downloaded fallback weights when installed during development.

The class mapping is intentionally small and editable in `backend/detector.py`. Case, underscores, and hyphens are normalized. Supported examples:

| Category | Class names |
| --- | --- |
| Worker | `Person`, `worker`, `workers` |
| Helmet | `Hardhat`, `hard hat`, `helmet`, `safety helmet` |
| Missing helmet | `NO-Hardhat`, `NO-Helmet`, `without helmet`, `missing helmet` |
| Vest | `Safety Vest`, `vest`, `reflective vest` |
| Missing vest | `NO-Safety Vest`, `NO-Vest`, `without vest`, `missing vest` |
| Machinery | `machinery`, `machine`, `excavator`, `crane`, `forklift`, `bulldozer`, `loader`, `dump truck`, `truck`, `vehicle`, `construction vehicle`, `car`, `bus` |

Use a model that includes **Person** as well as your PPE and machinery classes for worker-level rules. Models with only helmet boxes cannot establish worker locations.

## How the rules work

- **PPE:** Match PPE boxes to workers. If the model has explicit negative classes, only those trigger violations. Otherwise a supported positive helmet/vest class absent from the worker's head/torso region triggers a review warning. Standard YOLO never invents missing PPE. These simple associations can be inaccurate with occlusion or overlapping workers.
- **Zone entry:** The bottom center of a worker's bounding box represents their feet. If it falls inside the single normalized rectangle, flag a critical zone entry.
- **Proximity:** The shortest Euclidean gap between worker and machinery bounding boxes is compared with the threshold. This is an image-space warning, **not a real-world distance measurement**. Media is resized to a maximum 1280-pixel edge before analysis; threshold pixels refer to that processed resolution.
- **Logging:** For video, repeated `(worker ID, violation type)` events have a five-second cooldown. Unassigned tracker IDs after the first frame are annotated but not logged until an ID is available. Image events have `worker_id=null` because images do not establish tracking identities. Video worker counts are unique observed track IDs; machinery counts are the maximum detected in one frame.
- **Processing:** One background thread processes one upload at a time. This keeps model/tracker state separate between videos and the API responsive. FFmpeg produces H.264 MP4 output without audio. Jobs and final events persist in SQLite; interrupted jobs are marked failed after a restart and can be rerun.

## Project layout

```text
backend/
  main.py          FastAPI routes and a single processing queue
  detector.py      YOLO loading and class mapping
  tracker.py       Ultralytics ByteTrack adapter
  safety_engine.py PPE, zone, proximity rules and event cooldown
  processor.py     Image/video processing and output generation
  database.py      SQLite jobs, events, CSV
  models.py        Request and detection types
  utils.py         Media validation, resizing, drawing
  uploads/         Uploaded media (generated)
  outputs/         Previews and annotated results (generated)
  safety.db        Local history (generated)
frontend/
  src/components/  Readable dashboard components
  src/api/         Fetch client
  src/types/       Shared frontend types
  src/App.tsx      Small application state and navigation
models/
  best.pt          Your custom model (optional)
requirements.txt
```

No authentication, accounts, Docker, cloud services, live CCTV, or separate services are needed. Uploads and history remain local. This is an educational demo, not a certified safety system. Delete `backend/safety.db`, its `-wal`/`-shm` files, and generated files in uploads/outputs **with the backend stopped** to reset the demo.

## Verify

```bash
source .venv/bin/activate
pip install pytest httpx
python -m pytest -q
npm run build --prefix frontend
```

The tests cover the rule boundaries, missing-PPE behavior, event deduplication, invalid uploads, guided analysis, SQLite logs, CSV export, and immutable analysis history. API tests use a temporary database.

The Vite dev server proxies `/api` and `/outputs` to port 8000. For the local demo, run the Vite dev server; `vite preview` alone does not proxy the backend.

## Troubleshooting

- **Backend disconnected:** Activate `.venv` and start Uvicorn from the project root. Keep both terminal processes running.
- **First YOLO analysis is slow:** Weights are downloaded on first use. Test real inference before presenting, and keep clips short on CPU.
- **No PPE detections:** Add a trained `models/best.pt` with appropriate labels; use Detection setup to review expected class names.
- **No machinery detected:** Standard YOLO supports common road vehicles, rather than general construction equipment. A construction model needs appropriate machinery labels.
- **Video fails:** Install FFmpeg and use a short MP4. Check the backend terminal for model or codec errors.
- **Tracker IDs change:** ByteTrack IDs can change after occlusion. Tracking is approximate; use clear footage with limited overlap.

References: [Ultralytics YOLO11](https://docs.ultralytics.com/models/yolo11/), [Ultralytics tracking and ByteTrack](https://docs.ultralytics.com/modes/track/). The bundled construction preview is sourced from [Unsplash](https://images.unsplash.com/photo-1504307651254-35680f356dfd). No real CCTV connection is used.
