import asyncio
import struct
from types import SimpleNamespace
from unittest.mock import AsyncMock

from sqlalchemy import select

from app import ble_receiver
from app.database import create_database
from app.models import Base, Pod, SensorReading
from test_api import make_settings


def test_firmware_notifications_persist_across_reboots(tmp_path, monkeypatch):
    settings = make_settings(tmp_path / "ble.db")
    engine, factory = create_database(settings.database_url)
    Base.metadata.create_all(engine)
    with factory() as session:
        session.add(Pod(id=settings.ble_pod_id, name="Test Pico"))
        session.commit()
    app = SimpleNamespace(state=SimpleNamespace(
        settings=settings, session_factory=factory,
        live=SimpleNamespace(publish=AsyncMock()),
    ))
    connections = []

    class Client:
        def __init__(self, device, disconnected_callback):
            self.disconnect = disconnected_callback

        async def __aenter__(self):
            connections.append(self)
            if len(connections) > 2:
                raise asyncio.CancelledError
            return self

        async def __aexit__(self, *args):
            pass

        async def start_notify(self, uuid, callback):
            assert uuid == "e6f59d11-8230-4a5c-b22f-c062b1d329e3"
            # Exactly the firmware's encoding, including a sub-zero temperature.
            packet = struct.pack("<BIHhH", 1, 1, 800 + len(connections), -125, 8132)
            await callback(None, bytearray(b"invalid"))
            await callback(None, bytearray(packet))
            await callback(None, bytearray(packet))
            self.disconnect(self)

    scanner = AsyncMock(return_value=object())
    monkeypatch.setattr(ble_receiver.BleakScanner, "find_device_by_name", scanner)
    monkeypatch.setattr(ble_receiver, "BleakClient", Client)
    monkeypatch.setattr(ble_receiver.asyncio, "sleep", AsyncMock())

    async def run():
        try:
            await ble_receiver.run_ble_receiver(app)
        except asyncio.CancelledError:
            pass

    try:
        asyncio.run(run())
        with factory() as session:
            readings = list(session.scalars(select(SensorReading).order_by(SensorReading.id)))
            assert len(readings) == 2
            assert [reading.co2_ppm for reading in readings] == [801, 802]
            assert readings[0].device_session != readings[1].device_session
            assert all(reading.temperature_c == -1.25 for reading in readings)
            assert all(reading.humidity_percent == 81.32 for reading in readings)
            assert all(reading.source == "ble" for reading in readings)
        assert app.state.live.publish.await_count == 4
    finally:
        engine.dispose()


def test_default_name_matches_firmware(monkeypatch):
    from app.config import load_settings

    monkeypatch.delenv("BLE_DEVICE_NAME", raising=False)
    assert load_settings().ble_device_name == "FreshPod"
