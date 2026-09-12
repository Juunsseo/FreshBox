# FreshBox backend

This project implements the backend portion of the whiteboard architecture:

- receives SCD41 CO2, temperature, and humidity readings from a Raspberry Pi Pico 2 W over BLE;
- accepts the same readings over HTTP so the backend/frontend can be developed before hardware is ready;
- stores pods, food batches, time-series sensor readings, and freshness assessments in SQLite;
- exposes REST and WebSocket APIs for the frontend;
- optionally asks Grok for a recipe after computing a deterministic prototype freshness estimate.

The freshness result is a prototype quality estimate, **not a food-safety determination**. The SCD41 readings alone cannot establish whether food is safe to eat.

## Data flow

```text
SCD41 -> Pico 2 W -> BLE notification -> decoder -> SQLite
                                                   |
Frontend <- REST / WebSocket <- FastAPI <----------+
                    |
                    +-> freshness heuristic -> optional Grok recipe
```

The BLE machine is a local gateway: it must have Bluetooth and remain in range of the pod. A cloud server cannot directly subscribe to a nearby Pico's BLE notifications.

## Run it

Python 3.11 or newer is recommended.

```bash
cd freshbox-backend
python -m venv .venv
```

Activate the environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate
```

Install and start:

```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload --env-file .env
```

Open `http://127.0.0.1:8000/docs` for the interactive API.

## First test without hardware

The app automatically creates `freshbox-01`. Assign food:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/pods/freshbox-01/food \
  -H "Content-Type: application/json" \
  -d '{"food_name":"salmon","expected_shelf_life_hours":72}'
```

Simulate a sensor packet:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/pods/freshbox-01/readings \
  -H "Content-Type: application/json" \
  -d '{"sequence":1,"device_session":"demo","temperature_c":4.2,"humidity_percent":78.4,"co2_ppm":731}'
```

Read the latest value and run the prototype assessment:

```bash
curl http://127.0.0.1:8000/api/v1/pods/freshbox-01/latest
curl -X POST http://127.0.0.1:8000/api/v1/pods/freshbox-01/check-freshness
```

## Connect the Pico over BLE

Copy `.env.example` to `.env` and set:

```text
ENABLE_BLE=true
BLE_DEVICE_NAME=FreshPod
BLE_POD_ID=freshbox-01
DEMO_MODE=false
```

The Pico characteristic must notify one 11-byte little-endian packet:

| Bytes | Type | Meaning |
|---|---|---|
| 0 | uint8 | protocol version (`1`) |
| 1-4 | uint32 | sequence number |
| 5-6 | uint16 | CO2 in ppm |
| 7-8 | int16 | temperature in C multiplied by 100 |
| 9-10 | uint16 | relative humidity multiplied by 100 |

Equivalent pack format on the Pico and backend: `struct.pack("<BIHhH", ...)`.

The backend rejects malformed packets and validates temperature, humidity, and CO2 ranges before insertion. `(pod_id, device_session, sequence)` is unique, so repeated notifications are idempotent within a BLE connection. Each reconnect starts a new session because the firmware resets its sequence on reboot and does not transmit a boot identifier. A reading repeated across reconnects may be stored again.

## Frontend contract

The demo starts with no food. `POST /api/v1/demo/reset` removes active food
from the demo without deleting sensor history. Restarting preserves food added
by the presenter. `DEMO_MODE=true` only seeds a baseline sensor reading.

### Pico food and freshness display

`GET /api/v1/pods/{pod_id}/display` returns `food_name`, `score` (0–100 or
null), and `status`. The most recently added active food is selected. Removing
it selects the previous active food; clearing all food sends an empty state.
The score uses the backend freshness estimate, including the demo time offset.
Every fridge box includes a `freshness` object with `score`, `status`, and
`reasons` from the same backend calculation used for the Pico. The app uses
that value for stored-food bars, details, filtering, and recipe planning.
The Pico shows the most recently added active food; compare its score with
that food's app card. Updates arrive on the next app poll and e-paper refresh.

Recipe ideas remain visible for matching ingredients with declining scores,
but explicitly require fresh replacements. Those foods stay out of the cook
queue; recipe visibility does not change or override their freshness scores.

For a varied presentation, run `python -m app.demo` from the backend directory
after receiving sensor data. It initializes Strawberries at 30%, Tomato at 90%,
and Salad greens at 60%, preserving other food. These explicit demo profiles
store an offset from the initial sensor-based estimate; later time and sensor
changes still change the score. Reasons identify the demo starting value.
The same adjusted score goes to the app and Pico. Rerunning preserves existing
profiles instead of resetting their progress. Resetting the demo removes active
food; run this command again to create the three varied foods.

While connected, the backend checks every two seconds and writes changed state
with a GATT response to `e6f59d12-8230-4a5c-b22f-c062b1d329e3`. Reconnects
resend state. Older firmware without this characteristic can still send sensors.
No sensor readings means an unknown score, rather than an invented assessment.

The 20-byte little-endian format is `<BBH16s>`:

| Bytes | Meaning |
|---|---|
| 0 | Version: 1 |
| 1 | State: 0 empty, 1 waiting for sensor, 2 fresh, 3 use soon, 4 declining |
| 2–3 | Score × 10; 65535 means unknown |
| 4–19 | UTF-8 food name, truncated to 16 bytes at a character boundary, zero padded |

The REST response retains the full name. The Pico's built-in font shows ASCII;
unsupported characters display as `?`. Copy `main.py`, `ble.py`, `display.py`,
and the new `food_protocol.py` from `../firmware` to the Pico, retaining the
existing driver and library files, then reboot. The e-paper refreshes within
five seconds of receiving a change.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/pods` | register another physical pod |
| `GET` | `/api/v1/pods` | list pods |
| `POST` | `/api/v1/pods/{pod_id}/food` | assign/replace the food in a pod |
| `POST` | `/api/v1/pods/{pod_id}/readings` | simulate or gateway-ingest a reading |
| `GET` | `/api/v1/pods/{pod_id}/readings?limit=100` | get history for charts |
| `GET` | `/api/v1/pods/{pod_id}/latest` | get current sensor values |
| `POST` | `/api/v1/pods/{pod_id}/check-freshness` | calculate and store an assessment |
| `POST` | `/api/v1/pods/{pod_id}/recipe` | generate a recipe with Grok |
| WebSocket | `/ws/pods/{pod_id}` | receive live reading JSON |

For Grok recipes, set `XAI_API_KEY`. Do not put the key in source control or send it to the frontend.

## Database tables

| Table | Stores |
|---|---|
| `pods` | physical device identity and BLE metadata |
| `food_batches` | which food was placed in a pod and when |
| `sensor_readings` | append-only time-series sensor data |
| `freshness_assessments` | score/status snapshots and their explanations |

SQLite is suitable for the hackathon and local demo. Before a real deployment, add Alembic migrations, authentication/device credentials, per-device signing, PostgreSQL, retention rules, and calibrated food-specific models.

## Tests

```bash
pytest -q
```
