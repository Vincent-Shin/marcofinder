import json
from openai import OpenAI

client = OpenAI()

ALLOWED_CATEGORIES = [
    "pizza",
    "salad",
    "burger",
    "sushi",
    "sandwich",
    "wrap",
    "pasta",
    "drink",
    "dessert",
    "appetizer",
    "chicken",
    "seafood",
    "breakfast",
    "bowl",
    "fries",
    "soup",
    "coffee",
    "tea",
    "smoothie",
    "bakery",
    "mexican",
    "indian",
    "noodles",
    "rice",
    "snack",
    "other"
]


def try_basic_category_match(item):
    item_name = (item.get("item_name") or "").lower()

    if "pizza" in item_name:
        return "pizza"
    if "salad" in item_name:
        return "salad"
    if "burger" in item_name:
        return "burger"
    if "sushi" in item_name or "roll" in item_name or "sashimi" in item_name:
        return "sushi"
    if "sandwich" in item_name:
        return "sandwich"
    if "wrap" in item_name:
        return "wrap"
    if "pasta" in item_name:
        return "pasta"
    if "fries" in item_name:
        return "fries"
    if "soup" in item_name:
        return "soup"
    if "coffee" in item_name:
        return "coffee"
    if "tea" in item_name:
        return "tea"
    if "smoothie" in item_name:
        return "smoothie"
    if "bowl" in item_name:
        return "bowl"
    if "cake" in item_name or "cookie" in item_name or "donut" in item_name or "dessert" in item_name:
        return "dessert"
    if "chicken" in item_name:
        return "chicken"
    if "shrimp" in item_name or "salmon" in item_name or "tuna" in item_name:
        return "seafood"

    return None


def build_item_text(item):
    restaurant_name = item.get("restaurant_name") or ""
    item_name = item.get("item_name") or ""
    portion = item.get("portion") or ""

    macros = item.get("macros") or {}

    calories = macros.get("calories")
    protein_g = macros.get("protein_g")
    carbs_g = macros.get("carbs_g")
    fat_g = macros.get("fat_g")
    sodium_mg = macros.get("sodium_mg")
    sugar_g = macros.get("sugar_g")

    lines = [
        f"restaurant_name: {restaurant_name}",
        f"item_name: {item_name}",
        f"portion: {portion}",
        f"calories: {calories}",
        f"protein_g: {protein_g}",
        f"carbs_g: {carbs_g}",
        f"fat_g: {fat_g}",
        f"sodium_mg: {sodium_mg}",
        f"sugar_g: {sugar_g}",
    ]

    return "\n".join(lines)


def generate_category_and_description(item):
    matched_category = try_basic_category_match(item)

    item_text = build_item_text(item)

    prompt = f"""
You are labeling restaurant menu items.

Choose exactly one category from this list:
{", ".join(ALLOWED_CATEGORIES)}

Also write one human-sounding description in simple English.

Rules for the description:
- keep it to 2 sentences
- sound natural and simple
- do not sound like marketing
- do not use fancy words
- do not invent ingredients that are not clear from the item name
- make it a bit informative
- mention the macro profile in a natural way
- use the macro values only if they are present
- do not mention every macro unless it fits naturally

If the category is obvious, use it.
If unsure, use "other".

Menu item:
{item_text}

If a basic matched category already exists, use this category:
{matched_category}

Return JSON only:
{{"category": "one_category_here", "description": "your_description_here"}}
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "You classify restaurant menu items and write simple human descriptions."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    content = response.choices[0].message.content.strip()
    data = json.loads(content)

    category = data.get("category", "other")
    description = data.get("description", "").strip()

    if matched_category is not None:
        category = matched_category

    if category not in ALLOWED_CATEGORIES:
        category = "other"

    return {
        "category": category,
        "description": description
    }