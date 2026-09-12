import struct

import pytest

from app.protocol import PACKET_FORMAT, decode_sensor_packet


def test_decodes_sensor_packet() -> None:
    packet = struct.pack(PACKET_FORMAT, 1, 483, 847, 471, 8132)
    reading = decode_sensor_packet(packet)
    assert reading.sequence == 483
    assert reading.co2_ppm == 847
    assert reading.temperature_c == 4.71
    assert reading.humidity_percent == 81.32


def test_rejects_wrong_protocol_version() -> None:
    packet = struct.pack(PACKET_FORMAT, 2, 1, 800, 400, 8000)
    with pytest.raises(ValueError, match="unsupported protocol version"):
        decode_sensor_packet(packet)

