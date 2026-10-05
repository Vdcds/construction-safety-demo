"""One Detector per video gives ByteTrack fresh state for every upload."""

from .detector import Detector


class WorkerTracker:
    def __init__(self, detector: Detector):
        self.detector = detector

    def update(self, frame):
        return self.detector.detect(frame, tracking=True)
