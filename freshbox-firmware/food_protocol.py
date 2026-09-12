"""20-byte backend display packet, compatible with the default BLE MTU."""
import struct


def decode_food_state(packet):
    if len(packet) != 20:
        raise ValueError("food state must be 20 bytes")
    version, status, score, name = struct.unpack("<BBH16s", packet)
    if version != 1 or status > 4:
        raise ValueError("unsupported food state")
    if (status < 2 and score != 65535) or (status >= 2 and score > 1000):
        raise ValueError("invalid freshness score")
    return name.rstrip(b"\0").decode("utf-8"), None if score == 65535 else score / 10, status
