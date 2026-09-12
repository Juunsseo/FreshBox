from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PodCreate(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    name: str = Field(min_length=1, max_length=120)
    ble_device_name: str | None = Field(default=None, max_length=120)
    ble_address: str | None = Field(default=None, max_length=120)


class PodOut(PodCreate):
    model_config = ConfigDict(from_attributes=True)
    created_at: datetime


class FoodCreate(BaseModel):
    food_name: str = Field(min_length=1, max_length=120)
    food_type: str = Field(default="custom-meal", min_length=1, max_length=120)
    placed_at: datetime | None = None
    expected_shelf_life_hours: float = Field(default=72.0, gt=0, le=24 * 30)


class FoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    public_id: str
    pod_id: str
    food_type: str
    food_name: str
    location: str
    amount: str
    lid_open: bool
    time_offset_hours: float
    placed_at: datetime
    expected_shelf_life_hours: float
    removed_at: datetime | None


class ReadingCreate(BaseModel):
    sequence: int = Field(ge=0, le=4_294_967_295)
    recorded_at: datetime | None = None
    temperature_c: float = Field(ge=-10, le=60)
    humidity_percent: float = Field(ge=0, le=100)
    co2_ppm: int = Field(ge=0, le=40_000)
    device_session: str = Field(default="http", min_length=1, max_length=64)


class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pod_id: str
    device_session: str
    sequence: int
    recorded_at: datetime
    temperature_c: float
    humidity_percent: float
    co2_ppm: int
    source: str


class FreshnessOut(BaseModel):
    food_batch_id: int
    pod_id: str
    food_name: str
    score: float = Field(ge=0, le=100)
    status: str
    reasons: list[str]
    assessed_at: datetime
    latest_reading: ReadingOut
    disclaimer: str


class RecipeRequest(BaseModel):
    preferences: str | None = Field(default=None, max_length=500)


class RecipeOut(BaseModel):
    food_batch_id: int
    recipe: str
    model: str


class BoxCreate(BaseModel):
    food_type: str = Field(min_length=1, max_length=120)
    food_name: str = Field(min_length=1, max_length=120)
    device_time: datetime | None = None
    shelf_life_hours: float = Field(default=72, gt=0, le=24 * 365)
    amount: str = Field(default="1 container", min_length=1, max_length=120)


class BoxPatch(BaseModel):
    lid_open: bool | None = None
    skip_hours: float | None = Field(default=None, ge=0, le=24 * 365)


class GrokMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class GrokChatRequest(BaseModel):
    messages: list[GrokMessage] = Field(min_length=1, max_length=20)
    fridge: list[dict] = Field(default_factory=list)
