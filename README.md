# FreshBox integrated app

This folder contains the complete application:

- `freshbox-backend`: FastAPI, SQLite, BLE receiver, freshness records, and Grok integration.
- `freshbox-frontend`: Next.js UI and thin server-side proxy routes.
- `freshbox-frontend/firmware/pico_scd41.py`: matching Pico 2 W BLE firmware.

The Python backend is the single source of truth. Sensor notifications and UI actions are stored in SQLite; the frontend no longer writes a separate JSON database.

## Fastest start on Windows

Install Python 3.11+, Node.js 20+, and npm. Then open PowerShell in this folder and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-dev.ps1
```

The first run installs dependencies. Open http://localhost:43123 when Next.js says it is ready. Stop both servers with `Ctrl+C`.

The default configuration uses seeded demo boxes and a simulated baseline sensor reading, so the UI works before the Pico is connected.

## Fastest start on macOS/Linux

```bash
chmod +x start-dev.sh
./start-dev.sh
```

Then open http://localhost:43123.

## Manual start

Terminal 1 — backend:

```bash
cd freshbox-backend
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Or on macOS/Linux:

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --port 8000 --env-file .env
```

Terminal 2 — frontend:

```bash
cd freshbox-frontend
npm ci
npm run dev
```

Useful URLs:

- App: http://localhost:43123
- Backend health: http://localhost:8000/health
- Interactive backend API: http://localhost:8000/docs

## Connect the Pico 2 W over BLE

1. Flash a current MicroPython build for Raspberry Pi Pico 2 W.
2. Install `aioble` on the Pico (`mpremote mip install aioble`, or use Thonny's package manager).
3. Wire SCD41 `VIN -> 3V3`, `GND -> GND`, `SDA -> GP4`, and `SCL -> GP5`.
4. Copy `freshbox-frontend/firmware/pico_scd41.py` to the Pico as `main.py`.
5. In `freshbox-backend/.env`, change `ENABLE_BLE=false` to `ENABLE_BLE=true`.
6. Make sure Bluetooth is enabled on the computer running the backend, restart `start-dev`, and keep the Pico within BLE range.

The Pico advertises as `FreshBox` and sends an 11-byte notification every five seconds. The backend stores each reading in `freshbox-backend/freshbox.db`. The dashboard refreshes from that database every two seconds. When a real reading arrives, the device line on the dashboard changes from source `demo` to `ble`.

## Grok

Add your key only to `freshbox-backend/.env`:

```text
XAI_API_KEY=your-key-here
```

Restart the servers. The frontend sends Grok requests through FastAPI, so the key is never exposed to browser JavaScript. Without a key, the Grok screen uses its built-in local fallback.

## Configuration

Backend (`freshbox-backend/.env`):

- `ENABLE_BLE`: subscribe to the Pico (`false` for UI-only development).
- `DEMO_MODE`: seed demo boxes/readings when the database is empty.
- `BLE_DEVICE_NAME`: must match the firmware (`FreshBox`).
- `BLE_POD_ID`: database ID for the sensor container.
- `XAI_API_KEY`: optional Grok key.

Frontend (`freshbox-frontend/.env.local`):

- `FRESHBOX_API_URL`: backend URL, normally `http://127.0.0.1:8000`.

Do not commit `.env`, `.env.local`, or `freshbox.db`.

## Verify changes

```bash
cd freshbox-backend
python -m pytest -q

cd ../freshbox-frontend
npm run lint
npm run build
```

FreshBox is a prototype freshness indicator, not a certified food-safety device.

