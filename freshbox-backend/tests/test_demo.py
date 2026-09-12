from fastapi.testclient import TestClient

from app.demo import initialize_demo_foods
from app.main import create_app
from test_api import make_settings


def test_varied_demo_scores_remain_shared_and_respond_to_changes(tmp_path):
    app = create_app(make_settings(tmp_path / "demo.db"))
    with TestClient(app) as client:
        client.post("/api/v1/pods/freshbox-01/readings", json={
            "sequence": 1, "temperature_c": 28, "humidity_percent": 60, "co2_ppm": 600,
        })
        with app.state.session_factory() as session:
            initialize_demo_foods(session, "freshbox-01")
        boxes = client.get("/api/v1/fridge").json()["boxes"]
        assert {box["foodType"]: box["freshness"]["score"] for box in boxes} == {
            "strawberry": 30, "tomato": 90, "salad": 60,
        }
        state = client.get("/api/v1/pods/freshbox-01/display").json()
        assert state["food_name"] == "Salad greens"
        assert state["score"] == 60
        salad = next(box for box in boxes if box["foodType"] == "salad")
        client.patch('/api/v1/boxes/' + salad["id"], json={"skip_hours": 12})
        assert client.get("/api/v1/pods/freshbox-01/display").json()["score"] == 50
        with app.state.session_factory() as session:
            initialize_demo_foods(session, "freshbox-01")
        assert client.get("/api/v1/pods/freshbox-01/display").json()["score"] == 50
        client.post("/api/v1/pods/freshbox-01/readings", json={
            "sequence": 2, "temperature_c": 30, "humidity_percent": 60, "co2_ppm": 800,
        })
        assert client.get("/api/v1/pods/freshbox-01/display").json()["score"] < 50
