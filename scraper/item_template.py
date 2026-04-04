from datetime import datetime


def create_empty_item():
    return {
        "restaurant_id": None,
        "restaurant_name": None,
        "item_name": None,
        "unique_key": None,
        "category": None,
        "portion": None,
        "price_cad": None,
        "macros": {
            "calories": None,
            "protein_g": None,
            "carbs_g": None,
            "fat_g": None,
            "sodium_mg": None,
            "sugar_g": None
        },
        "description": None,
        "source_url": None,
        "scraped_at": datetime.utcnow().isoformat()
    }
