"""Backend-to-Pico display state; one active food on the single pod display."""
import asyncio
import logging
import struct

from sqlalchemy import select

from .freshness import freshness_payload
from .models import FoodBatch

FOOD_STATE_UUID = "e6f59d12-8230-4a5c-b22f-c062b1d329e3"
STATUS_CODES = {"empty": 0, "waiting": 1, "fresh": 2, "use_soon": 3, "declining": 4}
logger = logging.getLogger(__name__)


def food_state(session, pod_id):
    food = session.scalar(select(FoodBatch).where(
        FoodBatch.pod_id == pod_id, FoodBatch.removed_at.is_(None),
    ).order_by(FoodBatch.id.desc()))
    if food is None:
        return {"food_name": "", "score": None, "status": "empty"}
    result = freshness_payload(session, food)
    return {"food_name": food.food_name, "score": result["score"], "status": result["status"]}


def encode_food_state(state):
    # Keep the entire write within the default BLE 20-byte payload.
    name = state["food_name"].encode("utf-8")[:16].decode("utf-8", errors="ignore").encode("utf-8")
    score = 65535 if state["score"] is None else round(state["score"] * 10)
    return struct.pack("<BBH16s", 1, STATUS_CODES[state["status"]], score, name)


async def send_food_state(app, client):
    if client.services.get_characteristic(FOOD_STATE_UUID) is None:
        logger.warning("Pico firmware has no food-state characteristic; sensor reception remains active")
        return
    previous = None
    while True:
        try:
            with app.state.session_factory() as session:
                packet = encode_food_state(food_state(session, app.state.settings.ble_pod_id))
            if packet != previous:
                await client.write_gatt_char(FOOD_STATE_UUID, packet, response=True)
                previous = packet
        except Exception:
            logger.exception("Could not send food state to Pico; retrying")
        await asyncio.sleep(2)
