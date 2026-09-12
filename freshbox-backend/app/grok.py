from __future__ import annotations

import json

from openai import OpenAI

from .freshness import AssessmentResult
from .models import FoodBatch


def generate_recipe(
    *,
    api_key: str,
    model: str,
    food: FoodBatch,
    assessment: AssessmentResult,
    preferences: str | None,
) -> str:
    client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
    prompt = f"""
You are the recipe component of a food-storage prototype. Suggest one concise recipe.

Food: {food.food_name}
Prototype freshness status: {assessment.status}
Prototype freshness score: {assessment.score}/100
User preferences: {preferences or 'none supplied'}

Do not claim the sensors prove the food is safe. Start with a one-sentence reminder
that the user must independently check food safety. Then give ingredients and short steps.
""".strip()
    response = client.responses.create(model=model, input=prompt)
    return response.output_text


def generate_chat_reply(
    *, api_key: str, model: str, messages: list[dict], fridge: list[dict]
) -> str:
    client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
    instructions = (
        "You are Grok inside FreshBox, a fridge-sensor prototype. Help the user "
        "use the least-fresh food first. Never claim sensor data proves food is safe. "
        "Never recommend eating an item the supplied snapshot marks unsafe.\n\n"
        f"Current fridge snapshot:\n{json.dumps(fridge, ensure_ascii=False)}"
    )
    response = client.responses.create(
        model=model,
        instructions=instructions,
        input=messages[-8:],
    )
    return response.output_text
