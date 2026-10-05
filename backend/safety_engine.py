"""Image-space demo rules, with no claims of real-world distance."""

import math
from .detector import (
    normalize,
    WORKER_CLASSES,
    MACHINERY_CLASSES,
    HELMET_CLASSES,
    VEST_CLASSES,
    NO_HELMET_CLASSES,
    NO_VEST_CLASSES,
)


def contains(box, point):
    x1, y1, x2, y2 = box
    return x1 <= point[0] <= x2 and y1 <= point[1] <= y2


def center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def box_gap(a, b):
    dx = max(a[0] - b[2], b[0] - a[2], 0)
    dy = max(a[1] - b[3], b[1] - a[3], 0)
    return math.hypot(dx, dy)


class SafetyEngine:
    def __init__(self, names, options):
        self.labels = {normalize(n) for n in names}
        self.options = options
        self.last_logged = {}

    def check(self, detections, width, height, timestamp=0, frame_number=0):
        workers = [d for d in detections if normalize(d.label) in WORKER_CLASSES]
        machines = [d for d in detections if normalize(d.label) in MACHINERY_CLASSES]
        active, events = [], []
        for index, worker in enumerate(workers):
            identity = (
                worker.track_id if worker.track_id is not None else f"untracked-{index}"
            )
            flags = []
            x1, y1, x2, y2 = worker.box
            for positive, negative, kind, label, region in [
                (
                    HELMET_CLASSES,
                    NO_HELMET_CLASSES,
                    "missing_helmet",
                    "helmet",
                    (x1, y1, x2, y1 + (y2 - y1) * 0.45),
                ),
                (
                    VEST_CLASSES,
                    NO_VEST_CLASSES,
                    "missing_vest",
                    "safety vest",
                    (x1, y1 + (y2 - y1) * 0.2, x2, y1 + (y2 - y1) * 0.8),
                ),
            ]:
                # Assign an explicit negative to the nearest containing worker,
                # rather than flagging every overlapping worker.
                explicit = False
                for item in detections:
                    if normalize(item.label) not in negative or not contains(
                        worker.box, center(item.box)
                    ):
                        continue
                    candidates = [
                        w for w in workers if contains(w.box, center(item.box))
                    ]
                    owner = min(
                        candidates,
                        key=lambda w: math.dist(center(w.box), center(item.box)),
                    )
                    explicit = explicit or owner is worker
                present = any(
                    normalize(d.label) in positive and contains(region, center(d.box))
                    for d in detections
                )
                # If a model provides explicit negatives, use those. Absence is
                # only a heuristic for models with positive PPE classes alone.
                inferred = (
                    bool(self.labels & positive)
                    and not bool(self.labels & negative)
                    and not present
                )
                if explicit or inferred:
                    flags.append(
                        (
                            kind,
                            "warning",
                            f"Missing {label}"
                            + (" (PPE not detected; review image)" if inferred else ""),
                        )
                    )
            if self.options.zone:
                z = self.options.zone
                zone_box = (z.x1 * width, z.y1 * height, z.x2 * width, z.y2 * height)
                # Feet are the worker's approximate ground position.
                if contains(zone_box, ((x1 + x2) / 2, y2)):
                    flags.append(
                        (
                            "restricted_zone",
                            "critical",
                            "Worker entered the restricted zone",
                        )
                    )
            for machine in machines:
                gap = box_gap(worker.box, machine.box)
                if gap <= self.options.proximity:
                    flags.append(
                        (
                            "proximity",
                            "warning",
                            f"Within {round(gap)} px of {machine.label.lower()} (limit {self.options.proximity} px)",
                        )
                    )
                    break
            if flags:
                active.append({"worker": worker, "types": [f[0] for f in flags]})
            for kind, severity, detail in flags:
                # IDs can be briefly unavailable during tracker warmup: annotate,
                # but don't log a new anonymous identity on every video frame.
                if timestamp > 0 and worker.track_id is None:
                    continue
                key = (identity, kind)
                if timestamp - self.last_logged.get(key, -999) >= 5:
                    events.append(
                        dict(
                            worker_id=worker.track_id,
                            type=kind,
                            severity=severity,
                            timestamp=round(timestamp, 2),
                            frame=frame_number,
                            detail=detail,
                        )
                    )
                    self.last_logged[key] = timestamp
        return active, events
