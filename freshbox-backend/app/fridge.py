from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import FoodBatch, Pod, SensorReading
from .freshness import freshness_payload


def ensure_demo_data(session: Session, pod_id: str) -> None:
    latest = session.scalar(
        select(SensorReading)
        .where(SensorReading.pod_id == pod_id)
        .order_by(SensorReading.recorded_at.desc())
    )
    if latest is None:
        session.add(
            SensorReading(
                pod_id=pod_id,
                device_session="demo",
                sequence=0,
                temperature_c=3.6,
                humidity_percent=64.0,
                co2_ppm=540,
                source="demo",
            )
        )

    session.commit()


def reset_demo_data(session: Session, pod_id: str) -> None:
    now = datetime.now(timezone.utc)
    active = session.scalars(
        select(FoodBatch).where(
            FoodBatch.pod_id == pod_id, FoodBatch.removed_at.is_(None)
        )
    )
    for food in active:
        food.removed_at = now
    session.commit()


def latest_readings(session: Session, pod_id: str, limit: int = 120) -> list[SensorReading]:
    return list(
        session.scalars(
            select(SensorReading)
            .where(SensorReading.pod_id == pod_id)
            .order_by(SensorReading.recorded_at.desc())
            .limit(limit)
        )
    )


def fridge_payload(session: Session, pod: Pod) -> dict:
    readings = latest_readings(session, pod.id)
    latest = readings[0] if readings else None
    now = datetime.now(timezone.utc)
    foods = list(
        session.scalars(
            select(FoodBatch)
            .where(FoodBatch.pod_id == pod.id, FoodBatch.removed_at.is_(None))
            .order_by(FoodBatch.placed_at.desc())
        )
    )

    device = {
        "id": pod.id,
        "name": f"{pod.name} · SCD41",
        "temperature": latest.temperature_c if latest else 3.6,
        "humidity": latest.humidity_percent if latest else 64.0,
        "co2Ppm": latest.co2_ppm if latest else 540,
        "gasPpm": 0,
        "updatedAt": _epoch_ms(latest.recorded_at) if latest else _epoch_ms(now),
        "source": latest.source if latest else "fallback",
    }

    boxes = []
    for food in foods:
        placed_at = _aware(food.placed_at)
        elapsed = max(
            0.0,
            (now - placed_at).total_seconds() / 3600 + food.time_offset_hours,
        )
        history = []
        for reading in reversed(readings):
            recorded_at = _aware(reading.recorded_at)
            if recorded_at < placed_at:
                continue
            history.append(
                {
                    "temperature": reading.temperature_c,
                    "humidity": reading.humidity_percent,
                    "co2Ppm": reading.co2_ppm,
                    "gasPpm": 0,
                    "atHours": max(
                        0.0,
                        (recorded_at - placed_at).total_seconds() / 3600
                        + food.time_offset_hours,
                    ),
                    "score": 100,
                }
            )
        if not history:
            history = [
                {
                    "temperature": device["temperature"],
                    "humidity": device["humidity"],
                    "co2Ppm": device["co2Ppm"],
                    "gasPpm": 0,
                    "atHours": elapsed,
                    "score": 100,
                }
            ]
        boxes.append(
            {
                "id": food.public_id,
                "name": food.food_name,
                "freshness": freshness_payload(session, food),
                "foodType": food.food_type,
                "location": food.location,
                "amount": food.amount,
                "fridgeTemp": device["temperature"],
                "lidOpen": food.lid_open,
                "elapsedHours": round(elapsed, 3),
                "createdAt": _epoch_ms(placed_at - timedelta(hours=food.time_offset_hours)),
                "sensors": {
                    "temperature": device["temperature"],
                    "humidity": device["humidity"],
                    "co2Ppm": device["co2Ppm"],
                    "gasPpm": 0,
                },
                "history": history,
            }
        )
    return {"device": device, "boxes": boxes}


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _epoch_ms(value: datetime) -> int:
    return int(_aware(value).timestamp() * 1000)
