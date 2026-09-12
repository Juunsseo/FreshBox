from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Pod(Base):
    __tablename__ = "pods"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    ble_device_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ble_address: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    foods: Mapped[list[FoodBatch]] = relationship(back_populates="pod")
    readings: Mapped[list[SensorReading]] = relationship(back_populates="pod")


class FoodBatch(Base):
    __tablename__ = "food_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    pod_id: Mapped[str] = mapped_column(ForeignKey("pods.id", ondelete="CASCADE"), index=True)
    food_type: Mapped[str] = mapped_column(String(120), default="custom-meal")
    food_name: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(120), default="Fridge")
    amount: Mapped[str] = mapped_column(String(120), default="1 container")
    lid_open: Mapped[bool] = mapped_column(Boolean, default=False)
    time_offset_hours: Mapped[float] = mapped_column(Float, default=0.0)
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expected_shelf_life_hours: Mapped[float] = mapped_column(Float, default=72.0)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pod: Mapped[Pod] = relationship(back_populates="foods")
    assessments: Mapped[list[FreshnessAssessment]] = relationship(back_populates="food_batch")


class DemoFreshnessProfile(Base):
    __tablename__ = "demo_freshness_profiles"

    food_batch_id: Mapped[int] = mapped_column(
        ForeignKey("food_batches.id", ondelete="CASCADE"), primary_key=True
    )
    initial_score: Mapped[float] = mapped_column(Float)
    score_offset: Mapped[float] = mapped_column(Float)


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (
        UniqueConstraint("pod_id", "device_session", "sequence", name="uq_reading_packet"),
        Index("ix_readings_pod_recorded", "pod_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pod_id: Mapped[str] = mapped_column(ForeignKey("pods.id", ondelete="CASCADE"), index=True)
    device_session: Mapped[str] = mapped_column(String(64), default="http")
    sequence: Mapped[int] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    temperature_c: Mapped[float] = mapped_column(Float)
    humidity_percent: Mapped[float] = mapped_column(Float)
    co2_ppm: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(16), default="ble")

    pod: Mapped[Pod] = relationship(back_populates="readings")


class FreshnessAssessment(Base):
    __tablename__ = "freshness_assessments"
    __table_args__ = (Index("ix_assessments_food_created", "food_batch_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    food_batch_id: Mapped[int] = mapped_column(
        ForeignKey("food_batches.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    score: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(32))
    reasons_json: Mapped[str] = mapped_column(Text, default="[]")

    food_batch: Mapped[FoodBatch] = relationship(back_populates="assessments")
