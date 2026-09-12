from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from datetime import datetime, timezone
from uuid import uuid4

from bleak import BleakClient, BleakScanner

from .ingest import store_reading
from .protocol import decode_sensor_packet
from .pico import send_food_state
from .schemas import ReadingCreate, ReadingOut


logger = logging.getLogger(__name__)


async def run_ble_receiver(app) -> None:
    settings = app.state.settings

    while True:
        try:
            logger.info("Scanning for BLE device %s", settings.ble_device_name)
            device = await BleakScanner.find_device_by_name(
                settings.ble_device_name, timeout=10.0
            )
            if device is None:
                await asyncio.sleep(3)
                continue

            disconnected = asyncio.Event()

            def on_disconnect(_client: BleakClient) -> None:
                disconnected.set()

            async with BleakClient(device, disconnected_callback=on_disconnect) as client:
                # Firmware resets its sequence on reboot and has no boot identifier.
                # Scope deduplication to this connection so rebooted readings survive.
                device_session = uuid4().hex
                logger.info("Connected to %s", settings.ble_device_name)

                async def on_notification(_characteristic, data: bytearray) -> None:
                    try:
                        decoded = decode_sensor_packet(bytes(data))
                        reading = store_reading(
                            app.state.session_factory,
                            pod_id=settings.ble_pod_id,
                            payload=ReadingCreate(
                                sequence=decoded.sequence,
                                recorded_at=datetime.now(timezone.utc),
                                temperature_c=decoded.temperature_c,
                                humidity_percent=decoded.humidity_percent,
                                co2_ppm=decoded.co2_ppm,
                                device_session=device_session,
                            ),
                            source="ble",
                        )
                        await app.state.live.publish(
                            settings.ble_pod_id,
                            ReadingOut.model_validate(reading).model_dump(mode="json"),
                        )
                    except Exception:
                        logger.exception("Rejected BLE notification")

                await client.start_notify(
                    settings.ble_characteristic_uuid, on_notification
                )
                writer = asyncio.create_task(send_food_state(app, client))
                try:
                    await disconnected.wait()
                finally:
                    writer.cancel()
                    with suppress(asyncio.CancelledError):
                        await writer
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("BLE receiver failed; retrying")
        await asyncio.sleep(2)
