# FreshBox

MicroPython firmware for Raspberry Pi Pico 2 W, an SCD41, and the same
Waveshare 3.7-inch 280 x 480 e-paper used in the previous e-bike project.

Copy the five application files from `firmware/` to the Pico's filesystem root, keep
`aioble` installed, and restart the board:

- `main.py`: starts sensor polling, BLE, and the display worker on core 1.
- `scd41.py`: I2C measurements, data-ready checks, and CRC validation.
- `ble.py`: FreshPod advertising and the existing sensor notification packet.
- `display.py`: temperature (C), humidity (% RH), and CO2 (ppm) dashboard.
- `epaper_driver.py`: reused Waveshare driver with explicit SPI pins and a
  30-second BUSY timeout. Original license retained.

## Wiring

| Device signal | Pico GPIO |
| --- | --- |
| SCD41 SCL | GP21 |
| SCD41 SDA | GP20 |
| E-paper CLK | GP10 |
| E-paper DIN / MOSI | GP11 |
| E-paper CS | GP9 |
| E-paper DC | GP8 |
| E-paper RST | GP12 |
| E-paper BUSY | GP13 |

Use the same display power and ground connections as the previous project.
SPI1 reserves GP28 as its unused MISO input; the display does not need a
MISO wire. The SCD41 uses I2C0 at 100 kHz, address 0x62.

Measurements arrive approximately every five seconds. The display checks
for changed readings every five seconds after each refresh, so it may lag
by a refresh cycle. Every twelfth changed frame uses a full refresh to
reduce ghosting; adjust `FULL_REFRESH_EVERY` in `display.py` if needed.
Startup and sensor failures show `--` instead of fabricated measurements.
Readings older than 20 seconds are hidden. Display errors are printed to
the serial console while sensor polling and BLE continue.

BLE retains the existing service/characteristic UUIDs and 11-byte `<BIHhH`
packet: version, sequence, CO2 ppm, temperature x100, humidity x100.

## On-device check

After copying all files and restarting, check the serial console for
`SCD41 ready` and measured values. Confirm the screen shows those values
with the correct units and the BLE client still receives readings.
Disconnecting the sensor should produce `Sensor error` with blank values;
reconnecting it should allow readings to recover automatically.

Display initialization and the startup dashboard run on the main core before
the display worker starts. The console prints each initialization stage and
full tracebacks on display errors.

For a blank display, confirm the console prints `FreshBox: main.py starting`.
If it does not, verify that the updated files are saved on the Pico, not only
on the computer, and run `main.py` using the Pico MicroPython interpreter in
Thonny. To isolate the display, stop the running program with Thonny's Stop
button, then run the optional `firmware/display_test.py` on the Pico. It uses
no BLE or sensor and should display fixed test values: 23.5 C, 45.0 % RH,
800 ppm. Report the last console message if the screen stays white.
