from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class LiveReadings:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, pod_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._subscribers[pod_id].add(websocket)

    async def disconnect(self, pod_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._subscribers[pod_id].discard(websocket)

    async def publish(self, pod_id: str, message: dict) -> None:
        async with self._lock:
            targets = tuple(self._subscribers[pod_id])
        dead: list[WebSocket] = []
        for websocket in targets:
            try:
                await websocket.send_json(message)
            except Exception:
                dead.append(websocket)
        if dead:
            async with self._lock:
                for websocket in dead:
                    self._subscribers[pod_id].discard(websocket)

