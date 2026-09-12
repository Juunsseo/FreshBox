import asyncio
import struct


class SCD41:
    ADDRESS = 0x62

    def __init__(self, i2c):
        self.i2c = i2c

    def command(self, command):
        self.i2c.writeto(self.ADDRESS, struct.pack(">H", command))

    async def read_words(self, command, count):
        self.command(command)
        await asyncio.sleep_ms(1)
        data = self.i2c.readfrom(self.ADDRESS, count * 3)
        words = []
        for offset in range(0, len(data), 3):
            crc = 0xFF
            for byte in data[offset:offset + 2]:
                crc ^= byte
                for _ in range(8):
                    crc = ((crc << 1) ^ (0x31 if crc & 0x80 else 0)) & 0xFF
            if crc != data[offset + 2]:
                raise ValueError("SCD41 checksum mismatch")
            words.append((data[offset] << 8) | data[offset + 1])
        return words

    async def start(self):
        # Allow power-up, then stop any measurement left running by a soft reset.
        await asyncio.sleep_ms(1000)
        self.command(0x3F86)
        await asyncio.sleep_ms(500)
        self.command(0x21B1)
        await asyncio.sleep(5)

    async def read(self):
        status = await self.read_words(0xE4B8, 1)
        if not status[0] & 0x07FF:
            return None
        co2, raw_temperature, raw_humidity = await self.read_words(0xEC05, 3)
        if co2 == 0:
            return None
        temperature = -45 + 175 * raw_temperature / 65535
        humidity = 100 * raw_humidity / 65535
        return co2, temperature, humidity


