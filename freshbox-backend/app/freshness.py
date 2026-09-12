from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import DemoFreshnessProfile, FoodBatch, FreshnessAssessment, SensorReading


DISCLAIMER = (
    "Prototype quality estimate only. CO2, temperature, and humidity cannot prove "
    "that food is safe to eat; follow food-safety guidance and use judgment."
)


@dataclass(frozen=True)
class AssessmentResult:
    score: float
    status: str
    reasons: list[str]
    assessed_at: datetime
    latest_reading: SensorReading
    raw_score: float


def freshness_payload(session: Session, food: FoodBatch) -> dict:
    try:
        result = assess_freshness(session, food, persist=False)
    except ValueError:
        return {"score": None, "status": "waiting", "reasons": ["Waiting for sensor readings."]}
    return {"score": result.score, "status": result.status, "reasons": result.reasons}


def assess_freshness(session: Session, food: FoodBatch, *, persist: bool = True) -> AssessmentResult:
    readings = list(
        session.scalars(
            select(SensorReading)
            .where(SensorReading.pod_id == food.pod_id)
            .order_by(SensorReading.recorded_at.desc())
            .limit(24)
        )
    )
    if not readings:
        raise ValueError("no sensor readings are available for this pod")

    now = datetime.now(timezone.utc)
    placed_at = food.placed_at
    if placed_at.tzinfo is None:
        placed_at = placed_at.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (now - placed_at).total_seconds() / 3600 + food.time_offset_hours)
    age_penalty = 60 * min(age_hours / food.expected_shelf_life_hours, 1.5)

    average_temp = sum(item.temperature_c for item in readings) / len(readings)
    warm_penalty = max(0.0, average_temp - 5.0) * 4.0

    latest = readings[0]
    oldest = readings[-1]
    co2_delta = latest.co2_ppm - oldest.co2_ppm
    co2_penalty = min(20.0, max(0.0, co2_delta) / 100.0 * 2.0)

    raw_score = 100 - age_penalty - warm_penalty - co2_penalty
    demo = session.get(DemoFreshnessProfile, food.id)
    adjusted_score = raw_score + (demo.score_offset if demo else 0)
    score = round(max(0.0, min(100.0, adjusted_score)), 1)
    status = "fresh" if score >= 70 else "use_soon" if score >= 40 else "declining"

    reasons = [f"Stored for approximately {age_hours:.1f} hours."]
    if demo:
        reasons.append(f"Demo starting freshness: {demo.initial_score:.1f}%; subsequent time and sensor changes still apply.")
    if average_temp > 5:
        reasons.append(f"Recent average temperature was elevated at {average_temp:.1f} °C.")
    else:
        reasons.append(f"Recent average temperature was {average_temp:.1f} °C.")
    if co2_delta > 100:
        reasons.append(f"CO2 rose by {co2_delta} ppm across the available readings.")
    else:
        reasons.append("No large CO2 rise was detected across the available readings.")

    assessment = FreshnessAssessment(
        food_batch_id=food.id,
        created_at=now,
        score=score,
        status=status,
        reasons_json=json.dumps(reasons),
    )
    if persist:
        session.add(assessment)
        session.commit()

    return AssessmentResult(score, status, reasons, now, latest, raw_score)
