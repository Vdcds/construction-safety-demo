"""Rule tests use known boxes, not unreliable model predictions."""

import math
from backend.models import Detection, ProcessOptions, Zone
from backend.safety_engine import SafetyEngine, box_gap


def person(box=(10, 10, 50, 100), track_id=7):
    return Detection("Person", 0.95, box, track_id)


def test_zone_uses_feet_and_includes_boundary():
    engine = SafetyEngine(
        ["Person"], ProcessOptions(zone=Zone(x1=0.1, y1=0.8, x2=0.5, y2=1))
    )
    _, events = engine.check([person()], 100, 100)
    assert [e["type"] for e in events] == ["restricted_zone"]
    _, events = SafetyEngine(
        ["Person"], ProcessOptions(zone=Zone(x1=0.1, y1=0.1, x2=0.5, y2=0.3))
    ).check([person()], 100, 100)
    assert events == []  # Head inside the zone is not a ground-position entry.


def test_fallback_never_invents_ppe_violations():
    _, events = SafetyEngine(["person", "truck"], ProcessOptions()).check(
        [person()], 100, 100
    )
    assert events == []


def test_explicit_negative_ppe_is_associated_with_one_worker():
    a, b = person((0, 0, 40, 100), 1), person((60, 0, 100, 100), 2)
    negative = Detection("NO-Hardhat", 0.9, (65, 5, 85, 20))
    _, events = SafetyEngine(
        ["Person", "Hardhat", "NO-Hardhat"], ProcessOptions()
    ).check([a, b, negative], 100, 100)
    assert len(events) == 1
    assert events[0]["worker_id"] == 2
    assert events[0]["type"] == "missing_helmet"


def test_positive_ppe_model_uses_body_regions():
    hat, vest = (
        Detection("Hardhat", 0.9, (20, 10, 40, 20)),
        Detection("Safety Vest", 0.9, (15, 35, 45, 70)),
    )
    engine = SafetyEngine(["Person", "Hardhat", "Safety Vest"], ProcessOptions())
    assert engine.check([person(), hat, vest], 100, 100)[1] == []
    _, events = engine.check([person(), hat], 100, 100)
    assert events[0]["type"] == "missing_vest"
    assert "review image" in events[0]["detail"]


def test_proximity_is_box_gap_not_center_distance():
    assert box_gap((0, 0, 10, 10), (10, 0, 20, 10)) == 0
    assert box_gap((0, 0, 10, 10), (13, 14, 20, 20)) == 5
    assert math.isclose(box_gap((0, 0, 100, 100), (110, 10, 200, 100)), 10)
    engine = SafetyEngine(["Person", "machinery"], ProcessOptions(proximity=20))
    _, events = engine.check(
        [person(), Detection("machinery", 0.9, (60, 10, 100, 100))], 100, 100
    )
    assert events[0]["type"] == "proximity"


def test_logs_deduplicate_per_track_and_rule_with_cooldown():
    engine = SafetyEngine(["Person", "NO-Hardhat"], ProcessOptions())
    detections = [person(), Detection("NO-Hardhat", 0.9, (20, 10, 40, 20))]
    assert len(engine.check(detections, 100, 100, 0, 0)[1]) == 1
    assert engine.check(detections, 100, 100, 1, 30)[1] == []
    assert len(engine.check(detections, 100, 100, 5, 150)[1]) == 1


def test_new_track_does_not_inherit_old_tracks_cooldown():
    engine = SafetyEngine(["Person", "NO-Hardhat"], ProcessOptions())
    negative = Detection("NO-Hardhat", 0.9, (20, 10, 40, 20))
    engine.check([person(track_id=1), negative], 100, 100, 0)
    assert len(engine.check([person(track_id=2), negative], 100, 100, 1)[1]) == 1
