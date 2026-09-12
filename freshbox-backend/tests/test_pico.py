import asyncio
import struct
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from fastapi.testclient import TestClient

from app.main import create_app
from app.pico import FOOD_STATE_UUID, encode_food_state, send_food_state
from test_api import make_settings


def test_backend_packet_decoded_by_firmware():
    path = Path(__file__).resolve().parents[2] / "firmware" / "food_protocol.py"
    spec = importlib.util.spec_from_file_location("food_protocol", path)
    firmware = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(firmware)
    for status, score, code in [("empty", None, 0), ("waiting", None, 1),
                                ("fresh", 95.3, 2), ("use_soon", 50, 3), ("declining", 10, 4)]:
        packet = encode_food_state({"food_name": "Apple", "score": score, "status": status})
        assert firmware.decode_food_state(packet) == ("Apple", score, code)
    for packet in [b"", struct.pack("<BBH16s", 2, 2, 900, b"Apple"),
                   struct.pack("<BBH16s", 1, 2, 1001, b"Apple")]:
        with pytest.raises(ValueError):
            firmware.decode_food_state(packet)


def test_empty_add_sensor_update_and_reset(tmp_path):
    app = create_app(make_settings(tmp_path / "pico.db"))
    with TestClient(app) as client:
        url = "/api/v1/pods/freshbox-01/display"
        assert client.get(url).json() == {"food_name": "", "score": None, "status": "empty"}
        client.post("/api/v1/boxes", json={"food_type": "apple", "food_name": "Apple"})
        assert client.get(url).json() == {"food_name": "Apple", "score": None, "status": "waiting"}
        client.post("/api/v1/pods/freshbox-01/readings", json={
            "sequence": 1, "temperature_c": 4, "humidity_percent": 65, "co2_ppm": 600,
        })
        state = client.get(url).json()
        assert state == {"food_name": "Apple", "score": 100, "status": "fresh"}
        box_state = client.get("/api/v1/fridge").json()["boxes"][0]["freshness"]
        assert box_state["score"] == state["score"]
        assert box_state["status"] == state["status"]
        assert struct.unpack("<BBH16s", encode_food_state(state))[:3] == (1, 2, 1000)
        box = client.post("/api/v1/boxes", json={"food_type": "salad", "food_name": "Salad"}).json()["box"]
        assert client.get(url).json()["food_name"] == "Salad"
        client.patch('/api/v1/boxes/' + box["id"], json={"skip_hours": 100})
        assert client.get(url).json()["status"] == "declining"
        state = client.get(url).json()
        box_state = next(item for item in client.get("/api/v1/fridge").json()["boxes"] if item["id"] == box["id"])["freshness"]
        assert box_state["score"] == state["score"]
        assert struct.unpack("<BBH16s", encode_food_state(state))[2] / 10 == box_state["score"]
        client.delete('/api/v1/boxes/' + box["id"])
        assert client.get(url).json()["food_name"] == "Apple"
        assert client.post("/api/v1/demo/reset").json()["boxes"] == []
        assert client.get(url).json()["status"] == "empty"
        assert client.get("/api/v1/pods/freshbox-01/latest").json()["co2_ppm"] == 600


def test_name_truncates_at_utf8_boundary():
    packet = encode_food_state({"food_name": "a" * 15 + "🥕", "score": None, "status": "waiting"})
    assert len(packet) == 20
    version, status, score, name = struct.unpack("<BBH16s", packet)
    assert (version, status, score) == (1, 1, 65535)
    assert name.rstrip(b"\0").decode("utf-8") == "a" * 15


def test_writer_sends_and_retries(tmp_path, monkeypatch):
    app = create_app(make_settings(tmp_path / "writer.db"))
    with TestClient(app):
        writes = AsyncMock(side_effect=[RuntimeError("temporary"), None])
        client = SimpleNamespace(
            services=SimpleNamespace(get_characteristic=lambda uuid: object()),
            write_gatt_char=writes,
        )
        sleeps = 0

        async def sleep(_seconds):
            nonlocal sleeps
            sleeps += 1
            if sleeps == 3:
                raise asyncio.CancelledError

        monkeypatch.setattr("app.pico.asyncio.sleep", sleep)

        async def run():
            try:
                await send_food_state(app, client)
            except asyncio.CancelledError:
                pass

        asyncio.run(run())
        assert writes.await_count == 2
        writes.assert_awaited_with(FOOD_STATE_UUID, encode_food_state({
            "food_name": "", "score": None, "status": "empty",
        }), response=True)
