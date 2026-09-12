from __future__ import annotations

import os
from dataclasses import dataclass


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: tuple[str, ...]
    enable_ble: bool
    ble_device_name: str
    ble_pod_id: str
    ble_characteristic_uuid: str
    xai_api_key: str | None
    xai_model: str
    demo_mode: bool


def load_settings() -> Settings:
    origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    )
    return Settings(
        database_url=os.getenv("DATABASE_URL", "sqlite:///./freshbox.db"),
        cors_origins=tuple(item.strip() for item in origins.split(",") if item.strip()),
        enable_ble=_as_bool(os.getenv("ENABLE_BLE", "false")),
        ble_device_name=os.getenv("BLE_DEVICE_NAME", "FreshPod"),
        ble_pod_id=os.getenv("BLE_POD_ID", "freshbox-01"),
        ble_characteristic_uuid=os.getenv(
            "BLE_SENSOR_CHARACTERISTIC_UUID",
            "e6f59d11-8230-4a5c-b22f-c062b1d329e3",
        ),
        xai_api_key=os.getenv("XAI_API_KEY") or None,
        xai_model=os.getenv("XAI_MODEL", "grok-4.6"),
        demo_mode=_as_bool(os.getenv("DEMO_MODE", "true")),
    )
