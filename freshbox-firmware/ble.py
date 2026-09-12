"""FreshPod BLE service; packet format remains compatible with the app."""
import asyncio
import aioble
import bluetooth
import struct
from food_protocol import decode_food_state
from display import update_food

SERVICE_UUID = bluetooth.UUID("e6f59d10-8230-4a5c-b22f-c062b1d329e3")
SENSOR_DATA_UUID = bluetooth.UUID("e6f59d11-8230-4a5c-b22f-c062b1d329e3")
FOOD_STATE_UUID = bluetooth.UUID("e6f59d12-8230-4a5c-b22f-c062b1d329e3")
service = aioble.Service(SERVICE_UUID)
sensor_characteristic = aioble.Characteristic(
    service, SENSOR_DATA_UUID, read=True, notify=True)
food_characteristic = aioble.BufferedCharacteristic(
    service, FOOD_STATE_UUID, write=True, max_len=20)
aioble.register_services(service)
sequence = 0


async def food_state_task():
    while True:
        await food_characteristic.written()
        try:
            name, score, status = decode_food_state(food_characteristic.read())
            update_food(name, score, status)
        except (ValueError, UnicodeError) as error:
            print("Rejected food state:", error)


def ble_update(co2, temperature, humidity):
    global sequence
    sequence = (sequence + 1) & 0xFFFFFFFF
    packet = struct.pack("<BIHhH", 1, sequence, co2,
                         int(temperature * 100), int(humidity * 100))
    sensor_characteristic.write(packet, send_update=True)


async def peripheral_task():
    while True:
        async with await aioble.advertise(
            250_000, name="FreshPod", services=[SERVICE_UUID]
        ) as connection:
            print("Connected:", connection.device)
            try:
                await connection.disconnected(timeout_ms=None)
            finally:
                update_food("", None, None)
