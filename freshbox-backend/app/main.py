from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .ble_receiver import run_ble_receiver
from .config import Settings, load_settings
from .database import create_database, get_session
from .freshness import DISCLAIMER, assess_freshness
from .fridge import ensure_demo_data, fridge_payload, reset_demo_data
from .grok import generate_chat_reply, generate_recipe
from .ingest import store_reading
from .live import LiveReadings
from .models import Base, FoodBatch, Pod, SensorReading
from .pico import food_state
from .schemas import (
    BoxCreate,
    BoxPatch,
    FoodCreate,
    FoodOut,
    FreshnessOut,
    GrokChatRequest,
    PodCreate,
    PodOut,
    ReadingCreate,
    ReadingOut,
    RecipeOut,
    RecipeRequest,
)


def _get_pod_or_404(session: Session, pod_id: str) -> Pod:
    pod = session.get(Pod, pod_id)
    if pod is None:
        raise HTTPException(status_code=404, detail="pod not found")
    return pod


def _get_active_food_or_404(session: Session, pod_id: str) -> FoodBatch:
    food = session.scalar(
        select(FoodBatch)
        .where(FoodBatch.pod_id == pod_id, FoodBatch.removed_at.is_(None))
        .order_by(FoodBatch.placed_at.desc())
    )
    if food is None:
        raise HTTPException(status_code=404, detail="no active food is assigned to this pod")
    return food


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    engine, session_factory = create_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(engine)
        with session_factory() as session:
            if session.get(Pod, settings.ble_pod_id) is None:
                session.add(
                    Pod(
                        id=settings.ble_pod_id,
                        name="FreshBox 01",
                        ble_device_name=settings.ble_device_name,
                    )
                )
                session.commit()
            if settings.demo_mode:
                ensure_demo_data(session, settings.ble_pod_id)

        task = asyncio.create_task(run_ble_receiver(app)) if settings.enable_ble else None
        yield
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        engine.dispose()

    app = FastAPI(title="FreshBox API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.live = LiveReadings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/pods", response_model=PodOut, status_code=status.HTTP_201_CREATED)
    def create_pod(payload: PodCreate, session: Session = Depends(get_session)) -> Pod:
        if session.get(Pod, payload.id) is not None:
            raise HTTPException(status_code=409, detail="pod already exists")
        pod = Pod(**payload.model_dump())
        session.add(pod)
        session.commit()
        session.refresh(pod)
        return pod

    @app.get("/api/v1/pods", response_model=list[PodOut])
    def list_pods(session: Session = Depends(get_session)) -> list[Pod]:
        return list(session.scalars(select(Pod).order_by(Pod.created_at)))

    @app.post(
        "/api/v1/pods/{pod_id}/food",
        response_model=FoodOut,
        status_code=status.HTTP_201_CREATED,
    )
    def assign_food(
        pod_id: str, payload: FoodCreate, session: Session = Depends(get_session)
    ) -> FoodBatch:
        _get_pod_or_404(session, pod_id)
        active_foods = session.scalars(
            select(FoodBatch).where(
                FoodBatch.pod_id == pod_id, FoodBatch.removed_at.is_(None)
            )
        )
        now = datetime.now(timezone.utc)
        for old_food in active_foods:
            old_food.removed_at = now
        food = FoodBatch(
            public_id=f"fb-{uuid4().hex[:12]}",
            pod_id=pod_id,
            food_type=payload.food_type,
            food_name=payload.food_name,
            placed_at=payload.placed_at or now,
            expected_shelf_life_hours=payload.expected_shelf_life_hours,
        )
        session.add(food)
        session.commit()
        session.refresh(food)
        return food

    @app.get("/api/v1/fridge")
    def get_fridge(session: Session = Depends(get_session)) -> dict:
        pod = _get_pod_or_404(session, settings.ble_pod_id)
        return fridge_payload(session, pod)

    @app.get("/api/v1/pods/{pod_id}/display")
    def get_pico_display(pod_id: str, session: Session = Depends(get_session)) -> dict:
        _get_pod_or_404(session, pod_id)
        return food_state(session, pod_id)

    @app.post("/api/v1/boxes", status_code=status.HTTP_201_CREATED)
    def create_box(
        payload: BoxCreate, session: Session = Depends(get_session)
    ) -> dict:
        pod = _get_pod_or_404(session, settings.ble_pod_id)
        food = FoodBatch(
            public_id=f"fb-{uuid4().hex[:12]}",
            pod_id=pod.id,
            food_type=payload.food_type,
            food_name=payload.food_name,
            amount=payload.amount,
            placed_at=payload.device_time or datetime.now(timezone.utc),
            expected_shelf_life_hours=payload.shelf_life_hours,
        )
        session.add(food)
        session.commit()
        result = fridge_payload(session, pod)
        box = next(item for item in result["boxes"] if item["id"] == food.public_id)
        return {"box": box, "device": result["device"]}

    @app.patch("/api/v1/boxes/{box_id}")
    def update_box(
        box_id: str, payload: BoxPatch, session: Session = Depends(get_session)
    ) -> dict:
        pod = _get_pod_or_404(session, settings.ble_pod_id)
        food = session.scalar(
            select(FoodBatch).where(
                FoodBatch.public_id == box_id, FoodBatch.removed_at.is_(None)
            )
        )
        if food is None:
            raise HTTPException(status_code=404, detail="box not found")
        if payload.lid_open is not None:
            food.lid_open = payload.lid_open
        if payload.skip_hours is not None:
            food.time_offset_hours += payload.skip_hours
        session.commit()
        result = fridge_payload(session, pod)
        box = next(item for item in result["boxes"] if item["id"] == box_id)
        return {"box": box}

    @app.delete("/api/v1/boxes/{box_id}")
    def delete_box(box_id: str, session: Session = Depends(get_session)) -> dict:
        food = session.scalar(
            select(FoodBatch).where(
                FoodBatch.public_id == box_id, FoodBatch.removed_at.is_(None)
            )
        )
        if food is None:
            raise HTTPException(status_code=404, detail="box not found")
        food.removed_at = datetime.now(timezone.utc)
        session.commit()
        return {"ok": True}

    @app.post("/api/v1/demo/reset")
    def reset_demo(session: Session = Depends(get_session)) -> dict:
        pod = _get_pod_or_404(session, settings.ble_pod_id)
        reset_demo_data(session, pod.id)
        return fridge_payload(session, pod)

    @app.post("/api/v1/grok")
    def grok_chat(payload: GrokChatRequest) -> dict:
        if not settings.xai_api_key:
            raise HTTPException(status_code=503, detail="XAI_API_KEY is not configured")
        reply = generate_chat_reply(
            api_key=settings.xai_api_key,
            model=settings.xai_model,
            messages=[item.model_dump() for item in payload.messages],
            fridge=payload.fridge,
        )
        return {"reply": reply, "source": "grok", "model": settings.xai_model}

    @app.post(
        "/api/v1/pods/{pod_id}/readings",
        response_model=ReadingOut,
        status_code=status.HTTP_201_CREATED,
    )
    async def ingest_http_reading(
        pod_id: str, payload: ReadingCreate, request: Request
    ) -> SensorReading:
        with request.app.state.session_factory() as session:
            _get_pod_or_404(session, pod_id)
        reading = store_reading(
            request.app.state.session_factory,
            pod_id=pod_id,
            payload=payload,
            source="http",
        )
        await request.app.state.live.publish(
            pod_id, ReadingOut.model_validate(reading).model_dump(mode="json")
        )
        return reading

    @app.get("/api/v1/pods/{pod_id}/readings", response_model=list[ReadingOut])
    def list_readings(
        pod_id: str,
        limit: int = Query(default=100, ge=1, le=1000),
        session: Session = Depends(get_session),
    ) -> list[SensorReading]:
        _get_pod_or_404(session, pod_id)
        return list(
            session.scalars(
                select(SensorReading)
                .where(SensorReading.pod_id == pod_id)
                .order_by(SensorReading.recorded_at.desc())
                .limit(limit)
            )
        )

    @app.get("/api/v1/pods/{pod_id}/latest", response_model=ReadingOut)
    def latest_reading(
        pod_id: str, session: Session = Depends(get_session)
    ) -> SensorReading:
        _get_pod_or_404(session, pod_id)
        reading = session.scalar(
            select(SensorReading)
            .where(SensorReading.pod_id == pod_id)
            .order_by(SensorReading.recorded_at.desc())
        )
        if reading is None:
            raise HTTPException(status_code=404, detail="no readings available")
        return reading

    @app.post("/api/v1/pods/{pod_id}/check-freshness", response_model=FreshnessOut)
    def check_freshness(
        pod_id: str, session: Session = Depends(get_session)
    ) -> FreshnessOut:
        _get_pod_or_404(session, pod_id)
        food = _get_active_food_or_404(session, pod_id)
        try:
            result = assess_freshness(session, food)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return FreshnessOut(
            food_batch_id=food.id,
            pod_id=pod_id,
            food_name=food.food_name,
            score=result.score,
            status=result.status,
            reasons=result.reasons,
            assessed_at=result.assessed_at,
            latest_reading=ReadingOut.model_validate(result.latest_reading),
            disclaimer=DISCLAIMER,
        )

    @app.post("/api/v1/pods/{pod_id}/recipe", response_model=RecipeOut)
    def recipe(
        pod_id: str,
        payload: RecipeRequest,
        session: Session = Depends(get_session),
    ) -> RecipeOut:
        _get_pod_or_404(session, pod_id)
        food = _get_active_food_or_404(session, pod_id)
        if not settings.xai_api_key:
            raise HTTPException(status_code=503, detail="XAI_API_KEY is not configured")
        try:
            assessment = assess_freshness(session, food)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        text = generate_recipe(
            api_key=settings.xai_api_key,
            model=settings.xai_model,
            food=food,
            assessment=assessment,
            preferences=payload.preferences,
        )
        return RecipeOut(food_batch_id=food.id, recipe=text, model=settings.xai_model)

    @app.websocket("/ws/pods/{pod_id}")
    async def live_readings(websocket: WebSocket, pod_id: str) -> None:
        await app.state.live.connect(pod_id, websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            await app.state.live.disconnect(pod_id, websocket)

    return app


app = create_app()
