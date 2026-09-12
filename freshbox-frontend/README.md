# FreshBox frontend

Next.js interface for the FreshBox FastAPI backend.

From the parent `freshbox` directory, the easiest way to run the complete app is:

```powershell
.\start-dev.ps1
```

or on macOS/Linux:

```bash
./start-dev.sh
```

For frontend-only commands:

```bash
npm ci
npm run dev
```

The frontend expects `FRESHBOX_API_URL=http://127.0.0.1:8000` in `.env.local`.
Its `/api/*` Route Handlers are a server-side adapter; FastAPI/SQLite owns the actual data.

See the parent [README](../README.md) for complete setup, BLE firmware, Grok, and verification instructions.
