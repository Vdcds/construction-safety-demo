"""Load a custom construction model first, otherwise standard YOLO11n."""

from pathlib import Path
from .models import Detection

ROOT = Path(__file__).resolve().parents[1]
CUSTOM_MODEL = ROOT / "models" / "best.pt"
FALLBACK_MODEL = ROOT / "models" / "yolo11n.pt"


def normalize(label):
    return label.lower().replace("_", " ").replace("-", " ").strip()


WORKER_CLASSES = {"person", "worker", "workers"}
MACHINERY_CLASSES = {
    "machinery",
    "machine",
    "excavator",
    "bulldozer",
    "crane",
    "forklift",
    "loader",
    "truck",
    "bus",
    "car",
    "vehicle",
    "dump truck",
    "construction vehicle",
}
HELMET_CLASSES = {"helmet", "hardhat", "hard hat", "safety helmet"}
VEST_CLASSES = {"vest", "safety vest", "reflective vest"}
NO_HELMET_CLASSES = {
    "no hardhat",
    "no hard hat",
    "no helmet",
    "without helmet",
    "missing helmet",
}
NO_VEST_CLASSES = {"no safety vest", "no vest", "without vest", "missing vest"}


def model_info(names=None):
    labels = {normalize(n) for n in (names or [])}
    custom = CUSTOM_MODEL.exists()
    return {
        "name": "best.pt" if custom else "YOLO11n",
        "custom": custom,
        "classes": list(names or []),
        "helmet": bool(labels & (HELMET_CLASSES | NO_HELMET_CLASSES)),
        "vest": bool(labels & (VEST_CLASSES | NO_VEST_CLASSES)),
        "note": "Custom model: supported checks depend on its classes."
        if custom
        else "Standard YOLO detects people and vehicles. PPE detection requires a custom models/best.pt.",
    }


class Detector:
    def __init__(self, confidence=0.35):
        from ultralytics import YOLO

        self.model = YOLO(
            str(CUSTOM_MODEL if CUSTOM_MODEL.exists() else FALLBACK_MODEL)
        )
        self.confidence = confidence
        self.names = list(self.model.names.values())

    def detect(self, frame, tracking=False):
        options = dict(conf=self.confidence, imgsz=640, verbose=False, device="cpu")
        if tracking:
            result = self.model.track(
                frame, persist=True, tracker="bytetrack.yaml", **options
            )[0]
        else:
            result = self.model.predict(frame, **options)[0]
        if result.boxes is None:
            return []
        boxes = result.boxes
        ids = boxes.id.cpu().tolist() if boxes.id is not None else [None] * len(boxes)
        return [
            Detection(
                result.names[int(cls)],
                float(conf),
                tuple(box),
                int(tid) if tid is not None else None,
            )
            for box, cls, conf, tid in zip(
                boxes.xyxy.cpu().tolist(),
                boxes.cls.cpu().tolist(),
                boxes.conf.cpu().tolist(),
                ids,
            )
        ]
