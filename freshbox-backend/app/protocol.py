from __future__ import annotations

import struct
from dataclasses import dataclass


# version:uint8, sequence:uint32, CO2:uint16,
# temperature*100:int16, relative-humidity*100:uint16
PACKET_FORMAT = "<BIHhH"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)


@dataclass(frozen=True)
class DecodedReading:
    sequence: int
    co2_ppm: int
    temperature_c: float
    humidity_percent: float


def decode_sensor_packet(data: bytes) -> DecodedReading:
    if len(data) != PACKET_SIZE:
        raise ValueError(f"expected {PACKET_SIZE} bytes, received {len(data)}")

    version, sequence, co2, temperature_raw, humidity_raw = struct.unpack(
        PACKET_FORMAT, data
    )
    if version != 1:
        raise ValueError(f"unsupported protocol version: {version}")

    reading = DecodedReading(
        sequence=sequence,
        co2_ppm=co2,
        temperature_c=temperature_raw / 100,
        humidity_percent=humidity_raw / 100,
    )
    if not -10 <= reading.temperature_c <= 60:
        raise ValueError(f"temperature outside SCD41 operating range: {reading.temperature_c}")
    if not 0 <= reading.humidity_percent <= 100:
        raise ValueError(f"invalid relative humidity: {reading.humidity_percent}")
    if not 0 <= reading.co2_ppm <= 40_000:
        raise ValueError(f"invalid CO2 concentration: {reading.co2_ppm}")
    return reading

