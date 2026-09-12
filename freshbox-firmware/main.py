"""FreshBox application: SCD41 polling, BLE, and a core-1 e-paper worker."""
print("FreshBox: main.py starting")

import _thread
import asyncio
import sys
from machine import I2C, Pin

from ble import ble_update, peripheral_task, food_state_task
from display import display_worker, initialize_display, update_readings
from scd41 import SCD41


async def sensor_task():
    sensor = SCD41(I2C(0, scl=Pin(21), sda=Pin(20), freq=100_000))
    started = False
    while True:
        try:
            if not started:
                await sensor.start()
                started = True
                print("SCD41 ready on GP21 (SCL), GP20 (SDA)")
            reading = await sensor.read()
        except (OSError, ValueError) as error:
            print("SCD41 error:", error, "- retrying in 5 seconds")
            update_readings(None, None, None, "Sensor error")
            started = False
            await asyncio.sleep(5)
            continue

        if reading is None:
            await asyncio.sleep_ms(500)
            continue

        co2, temperature, humidity = reading
        update_readings(co2, temperature, humidity)
        ble_update(co2, temperature, humidity)
        print("CO2={} ppm Temp={:.1f} C RH={:.1f}%".format(
            co2, temperature, humidity))
        await asyncio.sleep(5)


async def main():
    try:
        epd = initialize_display()
        _thread.start_new_thread(display_worker, (epd,))
    except Exception as error:
        print("E-paper startup failed:", error)
        sys.print_exception(error)
    await asyncio.gather(sensor_task(), peripheral_task(), food_state_task())


asyncio.run(main())
