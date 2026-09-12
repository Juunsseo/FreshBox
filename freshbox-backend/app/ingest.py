from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from .models import SensorReading
from .schemas import ReadingCreate


def store_reading(
    session_factory: sessionmaker[Session],
    *,
    pod_id: str,
    payload: ReadingCreate,
    source: str,
) -> SensorReading:
    reading = SensorReading(
        pod_id=pod_id,
        device_session=payload.device_session,
        sequence=payload.sequence,
        recorded_at=payload.recorded_at or datetime.now(timezone.utc),
        temperature_c=payload.temperature_c,
        humidity_percent=payload.humidity_percent,
        co2_ppm=payload.co2_ppm,
        source=source,
    )
    with session_factory() as session:
        session.add(reading)
        try:
            session.commit()
            session.refresh(reading)
            return reading
        except IntegrityError:
            session.rollback()
            existing = session.scalar(
                select(SensorReading).where(
                    SensorReading.pod_id == pod_id,
                    SensorReading.device_session == payload.device_session,
                    SensorReading.sequence == payload.sequence,
                )
            )
            if existing is None:
                raise
            return existing

