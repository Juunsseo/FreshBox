"""Three-reading dashboard for the previous project's 3.7-inch e-paper."""
import _thread
import framebuf
import utime
import sys
from epaper_driver import EPD_3in7

DISPLAY_WIDTH = 280
DISPLAY_HEIGHT = 480
REFRESH_INTERVAL_MS = 5000
FULL_REFRESH_EVERY = 12
STALE_AFTER_MS = 20000
_lock = _thread.allocate_lock()
_state = {
    "co2": None, "temperature": None, "humidity": None,
    "status": "Starting sensor", "updated_at": None,
}


def update_readings(co2, temperature, humidity, status="Live readings"):
    with _lock:
        _state.update(co2=co2, temperature=temperature, humidity=humidity,
                      status=status, updated_at=utime.ticks_ms())


def snapshot():
    with _lock:
        data = dict(_state)
    if (data["updated_at"] is not None
            and utime.ticks_diff(utime.ticks_ms(), data["updated_at"]) > STALE_AFTER_MS
            and data["status"] == "Live readings"):
        data.update(co2=None, temperature=None, humidity=None,
                    status="Waiting for sensor")
    return data


def draw_big_text(fb, text, x, y, scale=3):
    glyph = framebuf.FrameBuffer(bytearray(8), 8, 8, framebuf.MONO_HLSB)
    for index, char in enumerate(text):
        glyph.fill(1)
        glyph.text(char, 0, 0, 0)
        for yy in range(8):
            for xx in range(8):
                if glyph.pixel(xx, yy) == 0:
                    fb.fill_rect(x + index * 8 * scale + xx * scale,
                                 y + yy * scale, scale, scale, 0)


def centered(fb, text, y, scale):
    draw_big_text(fb, text, (DISPLAY_WIDTH - len(text) * 8 * scale) // 2,
                  y, scale)


def render_dashboard(fb, data):
    fb.fill(1)
    centered(fb, "FreshBox", 10, 3)
    centered(fb, data["status"], 42, 1)
    rows = (
        ("Temperature", "temperature", "C", 60),
        ("Humidity", "humidity", "% RH", 200),
        ("CO2", "co2", "ppm", 340),
    )
    for label, key, unit, top in rows:
        fb.hline(8, top, DISPLAY_WIDTH - 16, 0)
        centered(fb, label, top + 12, 2)
        value = data[key]
        text = "--" if value is None else (
            str(int(value)) if key == "co2" else "{:.1f}".format(value))
        centered(fb, text, top + 47, 5)
        centered(fb, unit, top + 106, 2)


def initialize_display():
    # Match the previous project's main-core initialization before starting core 1.
    print("E-paper: initializing SPI and panel")
    epd = EPD_3in7()
    print("E-paper: selecting monochrome mode")
    epd.EPD_3IN7_1Gray_init()
    print("E-paper: clearing panel")
    epd.EPD_3IN7_1Gray_Clear()
    print("E-paper: drawing startup dashboard")
    render_dashboard(epd.image1Gray, snapshot())
    epd.EPD_3IN7_1Gray_Display_Part(epd.buffer_1Gray)
    print("E-paper: startup dashboard sent")
    return epd


def display_worker(epd):
    # After initialization, only this worker accesses SPI and the framebuffer.
    try:
        print("E-paper: display worker started")
        refresh_count = 1
        previous = None
        while True:
            data = snapshot()
            visible = (data["temperature"], data["humidity"],
                       data["co2"], data["status"])
            if visible != previous:
                render_dashboard(epd.image1Gray, data)
                if refresh_count % FULL_REFRESH_EVERY == 0:
                    epd.EPD_3IN7_1Gray_Display(epd.buffer_1Gray)
                else:
                    epd.EPD_3IN7_1Gray_Display_Part(epd.buffer_1Gray)
                refresh_count += 1
                previous = visible
                print("E-paper: dashboard refreshed")
            utime.sleep_ms(REFRESH_INTERVAL_MS)
    except Exception as error:
        print("E-paper stopped:", error)
        sys.print_exception(error)
