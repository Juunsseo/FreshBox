from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def make_settings(db_path: Path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{db_path}",
        cors_origins=("http://localhost:5173",),
        enable_ble=False,
        ble_device_name="FreshBox",
        ble_pod_id="freshbox-01",
        ble_characteristic_uuid="e6f59d11-8230-4a5c-b22f-c062b1d329e3",
        xai_api_key=None,
        xai_model="grok-4.6",
        demo_mode=False,
    )


def test_end_to_end_api(tmp_path: Path) -> None:
    app = create_app(make_settings(tmp_path / "test.db"))
    with TestClient(app) as client:
        food = client.post(
            "/api/v1/pods/freshbox-01/food",
            json={"food_name": "salmon", "expected_shelf_life_hours": 72},
        )
        assert food.status_code == 201

        payload = {
            "sequence": 1,
            "device_session": "test-session",
            "temperature_c": 4.2,
            "humidity_percent": 78.4,
            "co2_ppm": 731,
        }
        first = client.post("/api/v1/pods/freshbox-01/readings", json=payload)
        duplicate = client.post("/api/v1/pods/freshbox-01/readings", json=payload)
        assert first.status_code == 201
        assert duplicate.status_code == 201
        assert first.json()["id"] == duplicate.json()["id"]

        latest = client.get("/api/v1/pods/freshbox-01/latest")
        assert latest.status_code == 200
        assert latest.json()["co2_ppm"] == 731

        assessment = client.post("/api/v1/pods/freshbox-01/check-freshness")
        assert assessment.status_code == 200
        assert assessment.json()["food_name"] == "salmon"
        assert 0 <= assessment.json()["score"] <= 100


def test_rejects_invalid_reading(tmp_path: Path) -> None:
    app = create_app(make_settings(tmp_path / "invalid.db"))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/pods/freshbox-01/readings",
            json={
                "sequence": 1,
                "temperature_c": 4.2,
                "humidity_percent": 140,
                "co2_ppm": 731,
            },
        )
        assert response.status_code == 422


def test_frontend_compatibility_api(tmp_path: Path) -> None:
    settings = make_settings(tmp_path / "frontend.db")
    settings = Settings(**{**settings.__dict__, "demo_mode": True})
    app = create_app(settings)
    with TestClient(app) as client:
        fridge = client.get("/api/v1/fridge")
        assert fridge.status_code == 200
        assert fridge.json()["boxes"] == []
        assert fridge.json()["device"]["co2Ppm"] == 540

        created = client.post(
            "/api/v1/boxes",
            json={
                "food_type": "apple",
                "food_name": "Apple",
                "shelf_life_hours": 240,
                "amount": "4 pieces",
            },
        )
        assert created.status_code == 201
        box_id = created.json()["box"]["id"]

        patched = client.patch(
            f"/api/v1/boxes/{box_id}",
            json={"lid_open": True, "skip_hours": 12},
        )
        assert patched.status_code == 200
        assert patched.json()["box"]["lidOpen"] is True
        assert patched.json()["box"]["elapsedHours"] >= 12

        deleted = client.delete(f"/api/v1/boxes/{box_id}")
        assert deleted.status_code == 200
