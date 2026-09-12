"""Run `python -m app.demo` to initialize three varied demo foods once."""
from uuid import uuid4

from sqlalchemy import select

from .freshness import assess_freshness
from .models import Base, DemoFreshnessProfile, FoodBatch, Pod

DEMO_FOODS = (
    ("strawberry", "Strawberries", 96, 30),
    ("tomato", "Tomato", 120, 90),
    ("salad", "Salad greens", 72, 60),
)


def initialize_demo_foods(session, pod_id):
    for food_type, name, shelf_life, target in DEMO_FOODS:
        food = session.scalar(select(FoodBatch).where(
            FoodBatch.pod_id == pod_id, FoodBatch.food_type == food_type,
            FoodBatch.removed_at.is_(None),
        ).order_by(FoodBatch.id.desc()))
        if food is None:
            food = FoodBatch(public_id=f"fb-{uuid4().hex[:12]}", pod_id=pod_id,
                             food_type=food_type, food_name=name,
                             expected_shelf_life_hours=shelf_life)
            session.add(food)
            session.flush()
        # Rerunning must not reset ongoing demo aging or sensor changes.
        if session.get(DemoFreshnessProfile, food.id) is None:
            result = assess_freshness(session, food, persist=False)
            session.add(DemoFreshnessProfile(food_batch_id=food.id,
                        initial_score=target, score_offset=target - result.raw_score))
    session.commit()


if __name__ == "__main__":
    from .config import load_settings
    from .database import create_database

    settings = load_settings()
    engine, factory = create_database(settings.database_url)
    Base.metadata.create_all(engine)
    with factory() as session:
        if session.get(Pod, settings.ble_pod_id) is None:
            session.add(Pod(id=settings.ble_pod_id, name="FreshBox 01"))
            session.flush()
        initialize_demo_foods(session, settings.ble_pod_id)
    engine.dispose()
    print("Demo foods initialized: Strawberries 30%, Tomato 90%, Salad greens 60%.")
