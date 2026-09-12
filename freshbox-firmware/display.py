"""Food name, freshness bar, and sensor footer on the 3.7-inch e-paper."""
import _thread
import framebuf
import utime
import sys
from epaper_driver import EPD_3in7

DISPLAY_WIDTH = 480
DISPLAY_HEIGHT = 280
REFRESH_INTERVAL_MS = 5000
FULL_REFRESH_EVERY = 12
STALE_AFTER_MS = 20000
_lock = _thread.allocate_lock()
_state = {
    "co2": None, "temperature": None, "humidity": None,
    "status": "Starting sensor", "updated_at": None,
    "food_name": "", "freshness": None, "food_status": None,
}


def update_food(name, score, status):
    with _lock:
        _state.update(food_name=name, freshness=score, food_status=status)


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


class LandscapeCanvas:
    """Rotate logical 480x280 coordinates into the panel's 280x480 RAM."""
    def __init__(self, framebuffer):
        self.fb = framebuffer

    def fill(self, color):
        self.fb.fill(color)

    def fill_rect(self, x, y, width, height, color):
        self.fb.fill_rect(DISPLAY_HEIGHT - y - height, x,
                          height, width, color)

    def hline(self, x, y, width, color):
        self.fill_rect(x, y, width, 1, color)


def draw_big_text(fb, text, x, y, scale=3, color=0):
    glyph = framebuf.FrameBuffer(bytearray(8), 8, 8, framebuf.MONO_HLSB)
    for index, char in enumerate(text):
        glyph.fill(1)
        glyph.text(char, 0, 0, 0)
        for yy in range(8):
            for xx in range(8):
                if glyph.pixel(xx, yy) == 0:
                    fb.fill_rect(x + index * 8 * scale + xx * scale,
                                 y + yy * scale, scale, scale, color)


def circle(fb, cx, cy, radius, color):
    for dy in range(-radius, radius + 1):
        half_width = int((radius * radius - dy * dy) ** 0.5)
        fb.hline(cx - half_width, cy + dy, 2 * half_width + 1, color)


def draw_logo(fb):
    # Monochrome approximation of the supplied rounded Fresh BOX badge.
    x, y, width, height, radius = 12, 12, 88, 80, 18
    fb.fill_rect(x + radius, y, width - 2 * radius, height, 0)
    fb.fill_rect(x, y + radius, width, height - 2 * radius, 0)
    for cx in (x + radius, x + width - radius - 1):
        for cy in (y + radius, y + height - radius - 1):
            circle(fb, cx, cy, radius, 0)
    draw_big_text(fb, "Fresh", 16, 29, 2, 1)
    draw_big_text(fb, "BOX", 20, 51, 3, 1)


def render_dashboard(framebuffer, data):
    fb = LandscapeCanvas(framebuffer)
    fb.fill(1)
    draw_logo(fb)
    name = data.get("food_name") or "No food"
    name = "".join(char if 32 <= ord(char) <= 126 else "?" for char in name)[:16]
    # Fit every name supported by the 16-byte food packet on one line.
    name_scale = 3 if len(name) <= 14 else 2
    draw_big_text(fb, name, 120, 30, name_scale)
    draw_big_text(fb, "Freshness:", 120, 94, 2)

    food_status = data.get("food_status")
    score = data.get("freshness") if food_status in (2, 3, 4) else None
    bar_left, bar_right, bar_y = 130, 454, 140
    fb.fill_rect(bar_left, bar_y - 4, bar_right - bar_left + 1, 9, 0)
    circle(fb, bar_left, bar_y, 4, 0)
    circle(fb, bar_right, bar_y, 4, 0)
    if score is not None:
        # High freshness sits at Safe (left); low freshness at Spoil (right).
        marker = bar_left + int((100 - max(0, min(100, score)))
                               * (bar_right - bar_left) / 100)
        circle(fb, marker, bar_y, 12, 0)
        circle(fb, marker, bar_y, 8, 1)
    else:
        message = {None: "Waiting for backend", 0: "Add food in the app",
                   1: "Waiting for sensor"}.get(food_status, "No freshness data")
        draw_big_text(fb, message, 120, 186, 1)

    draw_big_text(fb, "Safe", 120, 162, 2)
    draw_big_text(fb, "Soon", 266, 162, 2)
    draw_big_text(fb, "Spoil", 384, 162, 2)
    fb.fill_rect(12, 210, 456, 2, 0)

    # Three equal columns; compact single-line readings fit the 480px panel.
    for label, key, unit, left in (
        ("Temp", "temperature", "C", 8),
        ("Humidity", "humidity", "% RH", 168),
        ("CO2", "co2", "ppm", 328),
    ):
        value = data.get(key)
        text = "--" if value is None else (
            str(int(value)) if key == "co2" else "{:.1f}".format(value))
        draw_big_text(fb, "{}: {} {}".format(label, text, unit), left, 236, 1)
    if data.get("status") != "Live readings":
        draw_big_text(fb, data.get("status", "")[:57], 12, 262, 1)


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
                       data["co2"], data["status"], data["food_name"],
                       data["freshness"], data["food_status"])
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
