"""Run manually in Thonny after stopping main.py; no BLE or sensor required."""
from display import initialize_display, render_dashboard
import time


epd = initialize_display()
print("E-paper test: drawing fixed test values (not sensor measurements)")
render_dashboard(epd.image1Gray, {
    "temperature": 23.5,
    "humidity": 45.0,
    "co2": 800,
    "status": "DISPLAY TEST",
})
epd.EPD_3IN7_1Gray_Display_Part(epd.buffer_1Gray)
time.sleep(5)
print("E-paper test complete: expect 23.5 C, 45.0 % RH, 800 ppm")
