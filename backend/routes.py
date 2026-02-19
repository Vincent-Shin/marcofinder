from flask import Blueprint, request, jsonify
from db import menu_items

api = Blueprint("api", __name__)


@api.get("/health")
def health():
    return {"status": "ok"}


@api.post("/items")
def add_item():
    data = request.get_json()

    if not data:
        return jsonify({"error": "missing JSON body"}), 400

    restaurant_id = (data.get("restaurant_id") or "").strip()
    item_name = (data.get("item_name") or "").strip()
    portion = (data.get("portion") or "").strip()

    if not restaurant_id or not item_name:
        return jsonify({"error": "restaurant_id and item_name are required"}), 400

    if not data.get("unique_key"):
        data["unique_key"] = f"{restaurant_id}|{item_name}|{portion}".lower()

    try:
        menu_items.insert_one(data)
        return jsonify({"message": "item added"}), 201
    except Exception as e:
        message = str(e)
        if "E11000" in message:
            return jsonify({"error": "duplicate item"}), 409
        return jsonify({"error": message}), 400


@api.get("/items")
def get_items():
    items = list(menu_items.find({}, {"_id": 0}))
    return jsonify(items)
