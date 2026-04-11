import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import unquote

from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request, send_from_directory, session
from itsdangerous import URLSafeTimedSerializer
from pymongo import ASCENDING, DESCENDING
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from ai_helper import generate_category_and_description
from db import (
    DatabaseUnavailableError,
    database_status,
    item_issues,
    menu_items,
    password_resets,
    restaurants,
    submissions,
    users,
)

api = Blueprint("api", __name__)

ITEM_PROJECTION = {"_id": 0}
USER_PUBLIC_PROJECTION = {"_id": 0, "password_hash": 0}
MANAGEABLE_ROLES = {"restaurant_owner", "admin"}
ASSET_EXTENSION_ALLOWLIST = {
    "nutrition_pdf": {".pdf"},
    "restaurant_image": {".png", ".jpg", ".jpeg", ".webp"},
    "item_image": {".png", ".jpg", ".jpeg", ".webp"},
    "menu_sheet": {".csv", ".tsv", ".xlsx", ".xls"},
    "issue_attachment": {".pdf", ".png", ".jpg", ".jpeg", ".webp"},
}
ISSUE_TYPE_ALLOWLIST = {
    "wrong_nutrition_info",
    "wrong_price",
    "item_discontinued",
    "wrong_category_or_diet_tag",
    "wrong_image",
    "broken_source_link",
    "duplicate_listing",
    "other",
}
ISSUE_STATUS_ALLOWLIST = {"open", "in_review", "resolved", "dismissed"}


@api.app_errorhandler(DatabaseUnavailableError)
def handle_database_unavailable(error):
    payload = database_status()
    return (
        jsonify(
            {
                "error": "database unavailable",
                "details": str(error),
                "database": payload,
            }
        ),
        503,
    )


def normalize_email(value):
    return str(value or "").strip().lower()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def parse_bool_arg(name):
    value = request.args.get(name)
    if value is None:
        return None
    return value.strip().lower() in {"1", "true", "yes", "on"}


def clean_limit(default=50, max_value=5000):
    raw = request.args.get("limit")
    if not raw:
        return default
    try:
        return max(1, min(int(raw), max_value))
    except ValueError:
        return default


def clean_offset():
    raw = request.args.get("offset")
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


def serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def current_user_document():
    email = session.get("user_email")
    if not email:
        return None
    return users.find_one({"email": email})


def auth_payload(user):
    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role", "user"),
        "owned_restaurant_ids": user.get("owned_restaurant_ids", []),
        "notifications": user.get("notifications", []),
        "saved_keys": user.get("saved_keys", []),
        "compare_keys": user.get("compare_keys", []),
    }


def login_user(user):
    session["user_email"] = user.get("email")
    session["user_name"] = user.get("name")
    session.permanent = True


def require_auth(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        user = current_user_document()
        if not user:
            return jsonify({"error": "authentication required"}), 401
        return handler(user, *args, **kwargs)

    return wrapped


def require_role(*allowed_roles):
    def decorator(handler):
        @wraps(handler)
        def wrapped(user, *args, **kwargs):
            role = user.get("role", "user")
            if role not in allowed_roles:
                return jsonify({"error": "forbidden"}), 403
            return handler(user, *args, **kwargs)

        return require_auth(wrapped)

    return decorator


def can_manage_restaurant(user, restaurant_id):
    role = user.get("role", "user")
    if role == "admin":
        return True
    return role == "restaurant_owner" and restaurant_id in user.get(
        "owned_restaurant_ids", []
    )


def is_dev_mode():
    return current_app.debug or current_app.config.get("ENV") != "production"


def push_notification(email, title, message):
    users.update_one(
        {"email": normalize_email(email)},
        {
            "$push": {
                "notifications": {
                    "$each": [
                        {
                            "title": title,
                            "message": message,
                            "created_at": now_iso(),
                        }
                    ],
                    "$position": 0,
                    "$slice": 25,
                }
            }
        },
    )


def push_notification_to_admins(title, message):
    admin_emails = [
        document.get("email")
        for document in users.find({"role": "admin"}, {"email": 1, "_id": 0})
        if document.get("email")
    ]
    for email in admin_emails:
        push_notification(email, title, message)


def push_notification_to_restaurant_managers(restaurant_id, title, message):
    manager_emails = [
        document.get("email")
        for document in users.find(
            {"owned_restaurant_ids": restaurant_id},
            {"email": 1, "_id": 0},
        )
        if document.get("email")
    ]
    for email in manager_emails:
        push_notification(email, title, message)


def clean_non_negative_number(raw, field_name):
    if raw in (None, ""):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be numeric")
    if value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


def clean_optional_text(raw):
    value = str(raw or "").strip()
    return value or None


def clean_required_text(raw, field_name):
    value = str(raw or "").strip()
    if not value:
        raise ValueError(f"{field_name} is required")
    return value


def clean_optional_url(raw, field_name):
    value = str(raw or "").strip()
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        raise ValueError(f"{field_name} must start with http:// or https://")
    return value


def build_upload_url(relative_path):
    upload_path = f"/uploads/{relative_path.replace(os.sep, '/')}"
    script_root = (request.script_root or "").rstrip("/")
    path_with_prefix = f"{script_root}{upload_path}" if script_root else upload_path
    return f"{request.url_root.rstrip('/')}{path_with_prefix}"


def save_uploaded_asset(file_storage, kind):
    if kind not in ASSET_EXTENSION_ALLOWLIST:
        raise ValueError("invalid upload kind")

    original_name = secure_filename(file_storage.filename or "")
    extension = os.path.splitext(original_name)[1].lower()
    if not extension:
        raise ValueError("uploaded file must include an extension")
    if extension not in ASSET_EXTENSION_ALLOWLIST[kind]:
        raise ValueError(f"unsupported file type for {kind}")

    upload_root = current_app.config.get("UPLOAD_ROOT") or os.path.join(
        os.path.dirname(__file__), "uploads"
    )
    target_dir = os.path.join(upload_root, kind)
    os.makedirs(target_dir, exist_ok=True)

    random_suffix = uuid.uuid4().hex[:12]
    safe_stem = os.path.splitext(original_name)[0][:72] or "file"
    stored_name = f"{safe_stem}-{random_suffix}{extension}"
    absolute_path = os.path.join(target_dir, stored_name)
    file_storage.save(absolute_path)

    relative_path = os.path.join(kind, stored_name)
    return {
        "kind": kind,
        "file_name": original_name,
        "stored_name": stored_name,
        "relative_path": relative_path.replace(os.sep, "/"),
        "file_url": build_upload_url(relative_path),
        "uploaded_at": now_iso(),
    }


def slugify_restaurant_id(value):
    cleaned = re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())
    cleaned = cleaned.strip("_")
    return cleaned or "restaurant"


def clean_representative_item(raw_item):
    item_name = str(raw_item.get("item_name") or "").strip()
    if not item_name:
        raise ValueError("representative_items[].item_name is required")

    portion = clean_optional_text(raw_item.get("portion"))
    macros = raw_item.get("macros") or {}
    normalized_macros = {
        "calories": clean_non_negative_number(macros.get("calories"), "calories"),
        "protein_g": clean_non_negative_number(macros.get("protein_g"), "protein_g"),
        "carbs_g": clean_non_negative_number(macros.get("carbs_g"), "carbs_g"),
        "fat_g": clean_non_negative_number(macros.get("fat_g"), "fat_g"),
        "sodium_mg": clean_non_negative_number(macros.get("sodium_mg"), "sodium_mg"),
        "sugar_g": clean_non_negative_number(macros.get("sugar_g"), "sugar_g"),
    }

    return {
        "item_name": item_name,
        "category": clean_optional_text(raw_item.get("category")),
        "portion": portion,
        "description": clean_optional_text(raw_item.get("description")),
        "price_cad": clean_non_negative_number(raw_item.get("price_cad"), "price_cad"),
        "image_url": clean_optional_url(raw_item.get("image_url"), "image_url"),
        "macros": {key: value for key, value in normalized_macros.items() if value is not None},
    }


def validate_restaurant_listing_payload(data, user):
    restaurant_name = clean_required_text(data.get("restaurant_name"), "restaurant_name")
    restaurant_id = slugify_restaurant_id(data.get("restaurant_id") or restaurant_name)
    owner_full_name = clean_required_text(
        data.get("owner_full_name") or user.get("name"), "owner_full_name"
    )
    owner_role = clean_required_text(data.get("owner_role") or "Owner", "owner_role")
    restaurant_email = normalize_email(data.get("restaurant_email") or user.get("email"))
    if "@" not in restaurant_email:
        raise ValueError("restaurant_email must be a valid email")

    representative_items = data.get("representative_items") or []
    if not isinstance(representative_items, list):
        raise ValueError("representative_items must be an array")

    cleaned_items = []
    for raw_item in representative_items[:5]:
        if not isinstance(raw_item, dict):
            raise ValueError("representative_items must contain objects")
        cleaned_items.append(clean_representative_item(raw_item))

    return {
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "owner_full_name": owner_full_name,
        "owner_role": owner_role,
        "restaurant_email": restaurant_email,
        "phone": clean_required_text(data.get("phone"), "phone"),
        "official_website": clean_optional_url(data.get("official_website"), "official_website"),
        "menu_note": clean_optional_text(data.get("menu_note")),
        "nutrition_pdf_url": clean_optional_url(
            data.get("nutrition_pdf_url"), "nutrition_pdf_url"
        ),
        "menu_url": clean_optional_url(data.get("menu_url"), "menu_url"),
        "restaurant_image_url": clean_optional_url(
            data.get("restaurant_image_url"), "restaurant_image_url"
        ),
        "menu_sheet_url": clean_optional_url(data.get("menu_sheet_url"), "menu_sheet_url"),
        "representative_items": cleaned_items,
    }


def validate_item_payload(data):
    restaurant_id = str(data.get("restaurant_id") or "").strip()
    item_name = str(data.get("item_name") or "").strip()
    portion = str(data.get("portion") or "").strip()
    restaurant_name = str(data.get("restaurant_name") or "").strip()
    category = clean_optional_text(data.get("category"))
    description = clean_optional_text(data.get("description"))
    macros = data.get("macros") or {}
    if not restaurant_id or not item_name:
        raise ValueError("restaurant_id and item_name are required")

    normalized_macros = {
        "calories": clean_non_negative_number(macros.get("calories"), "calories"),
        "protein_g": clean_non_negative_number(macros.get("protein_g"), "protein_g"),
        "carbs_g": clean_non_negative_number(macros.get("carbs_g"), "carbs_g"),
        "fat_g": clean_non_negative_number(macros.get("fat_g"), "fat_g"),
        "sodium_mg": clean_non_negative_number(macros.get("sodium_mg"), "sodium_mg"),
        "sugar_g": clean_non_negative_number(macros.get("sugar_g"), "sugar_g"),
    }

    payload = {
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "item_name": item_name,
        "category": category,
        "portion": portion,
        "description": description,
        "price_cad": clean_non_negative_number(data.get("price_cad"), "price_cad"),
        "macros": {key: value for key, value in normalized_macros.items() if value is not None},
        "image_url": clean_optional_url(data.get("image_url"), "image_url"),
        "source_url": clean_optional_url(data.get("source_url"), "source_url"),
    }
    return {key: value for key, value in payload.items() if value is not None}


def serialize_submission(document):
    return {
        "id": str(document.get("_id")),
        "type": document.get("type"),
        "status": document.get("status"),
        "restaurant_id": document.get("restaurant_id"),
        "restaurant_name": document.get("restaurant_name"),
        "user_email": document.get("user_email"),
        "user_name": document.get("user_name"),
        "note": document.get("note"),
        "payload": document.get("payload"),
        "admin_note": document.get("admin_note"),
        "created_at": document.get("created_at"),
        "reviewed_at": document.get("reviewed_at"),
    }


def find_restaurant_record(restaurant_id):
    restaurant_id = str(restaurant_id or "").strip()
    if not restaurant_id:
        return None

    restaurant_document = restaurants.find_one({"restaurant_id": restaurant_id}, {"_id": 0})
    if restaurant_document:
        return restaurant_document

    menu_record = menu_items.find_one(
        {"restaurant_id": restaurant_id},
        {"_id": 0, "restaurant_id": 1, "restaurant_name": 1},
    )
    if not menu_record:
        return None

    fallback_record = {
        "restaurant_id": restaurant_id,
        "restaurant_name": menu_record.get("restaurant_name") or restaurant_id,
        "description": "",
    }
    restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {
            "$setOnInsert": {
                **fallback_record,
                "created_at": now_iso(),
            },
            "$set": {"updated_at": now_iso()},
        },
        upsert=True,
    )
    return fallback_record


@api.get("/health")
def health():
    payload = database_status()
    status_code = 200 if payload["status"] == "connected" else 503
    return {"status": "ok", "database": payload}, status_code


@api.post("/uploads")
@require_auth
def upload_asset(user):
    kind = str(request.form.get("kind") or "").strip()
    file_storage = request.files.get("file")
    if not file_storage:
        return jsonify({"error": "file is required"}), 400
    if not kind:
        return jsonify({"error": "kind is required"}), 400

    try:
        payload = save_uploaded_asset(file_storage, kind)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"message": "upload successful", "asset": payload}), 201


@api.get("/uploads/<path:asset_path>")
def get_uploaded_asset(asset_path):
    upload_root = current_app.config.get("UPLOAD_ROOT") or os.path.join(
        os.path.dirname(__file__), "uploads"
    )
    safe_root = os.path.abspath(upload_root)
    target_path = os.path.abspath(os.path.join(safe_root, asset_path))
    if not target_path.startswith(f"{safe_root}{os.sep}") and target_path != safe_root:
        return jsonify({"error": "file not found"}), 404

    directory = os.path.dirname(target_path)
    filename = os.path.basename(target_path)
    if not os.path.exists(target_path):
        return jsonify({"error": "file not found"}), 404
    return send_from_directory(directory, filename)


@api.post("/auth/signup")
def signup():
    data = request.get_json() or {}

    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    password = str(data.get("password") or "")

    if not name or not email or not password:
        return jsonify({"error": "name, email, and password are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    admin_email = normalize_email(os.environ.get("ADMIN_EMAIL"))
    existing_users = users.count_documents({})
    role = "admin" if existing_users == 0 or email == admin_email else "user"

    document = {
        "name": name,
        "email": email,
        "role": role,
        "owned_restaurant_ids": [],
        "notifications": [],
        "password_hash": generate_password_hash(password),
        "saved_keys": [],
        "compare_keys": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    try:
        users.insert_one(document)
    except Exception as exc:
        message = str(exc)
        if "E11000" in message:
            return jsonify({"error": "email already exists"}), 409
        return jsonify({"error": message}), 400

    login_user(document)
    return jsonify({"message": "user created", "user": auth_payload(document)}), 201


@api.post("/auth/login")
def login():
    data = request.get_json() or {}

    email = normalize_email(data.get("email"))
    password = str(data.get("password") or "")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = users.find_one({"email": email})
    if not user or not check_password_hash(user.get("password_hash", ""), password):
        return jsonify({"error": "invalid email or password"}), 401

    login_user(user)
    return jsonify({"message": "login successful", "user": auth_payload(user)}), 200


@api.get("/auth/me")
@require_auth
def auth_me(user):
    return jsonify({"user": auth_payload(user)}), 200


@api.post("/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"message": "logged out"}), 200


@api.patch("/auth/profile")
@require_auth
def update_profile(user):
    data = request.get_json() or {}
    name = str(data.get("name") or "").strip()
    email = normalize_email(data.get("email"))

    updates = {}
    if name:
        updates["name"] = name
    if email and email != user.get("email"):
        updates["email"] = email

    if not updates:
        return jsonify({"error": "no valid profile fields provided"}), 400

    updates["updated_at"] = now_iso()

    try:
        users.update_one({"email": user.get("email")}, {"$set": updates})
    except Exception as exc:
        message = str(exc)
        if "E11000" in message:
            return jsonify({"error": "email already exists"}), 409
        return jsonify({"error": message}), 400

    updated_user = users.find_one({"email": updates.get("email", user.get("email"))})
    login_user(updated_user)
    return jsonify({"message": "profile updated", "user": auth_payload(updated_user)}), 200


@api.patch("/auth/password")
@require_auth
def change_password(user):
    data = request.get_json() or {}
    current_password = str(data.get("current_password") or "")
    new_password = str(data.get("new_password") or "")

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400
    if not check_password_hash(user.get("password_hash", ""), current_password):
        return jsonify({"error": "current password is incorrect"}), 401

    users.update_one(
        {"email": user.get("email")},
        {
            "$set": {
                "password_hash": generate_password_hash(new_password),
                "updated_at": now_iso(),
            }
        },
    )
    return jsonify({"message": "password updated"}), 200


@api.post("/auth/forgot-password")
def forgot_password():
    data = request.get_json() or {}
    email = normalize_email(data.get("email"))
    if not email:
        return jsonify({"error": "email is required"}), 400

    user = users.find_one({"email": email})
    if not user:
        return jsonify({"message": "if that account exists, a reset link has been created"}), 200

    token = serializer().dumps({"email": email}, salt="password-reset")
    password_resets.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "token": token,
                "created_at": now_iso(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            }
        },
        upsert=True,
    )

    payload = {"message": "password reset token created"}
    if current_app.debug or current_app.config.get("ENV") != "production":
        payload["reset_token"] = token
    return jsonify(payload), 200


@api.post("/auth/reset-password")
def reset_password():
    data = request.get_json() or {}
    token = str(data.get("token") or "")
    new_password = str(data.get("new_password") or "")

    if not token or not new_password:
        return jsonify({"error": "token and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400

    try:
        payload = serializer().loads(token, salt="password-reset", max_age=3600)
    except Exception:
        return jsonify({"error": "invalid or expired token"}), 400

    reset_record = password_resets.find_one({"token": token})
    if not reset_record:
        return jsonify({"error": "invalid or expired token"}), 400

    email = normalize_email(payload.get("email"))
    users.update_one(
        {"email": email},
        {
            "$set": {
                "password_hash": generate_password_hash(new_password),
                "updated_at": now_iso(),
            }
        },
    )
    password_resets.delete_many({"email": email})
    return jsonify({"message": "password reset successful"}), 200


@api.get("/auth/preferences")
@require_auth
def get_preferences(user):
    return (
        jsonify(
            {
                "saved_keys": user.get("saved_keys", []),
                "compare_keys": user.get("compare_keys", []),
            }
        ),
        200,
    )


@api.put("/auth/preferences")
@require_auth
def save_preferences(user):
    data = request.get_json() or {}
    saved_keys = data.get("saved_keys")
    compare_keys = data.get("compare_keys")

    if saved_keys is None or compare_keys is None:
        return jsonify({"error": "saved_keys and compare_keys are required"}), 400
    if not isinstance(saved_keys, list) or not isinstance(compare_keys, list):
        return jsonify({"error": "saved_keys and compare_keys must be arrays"}), 400
    if len(compare_keys) > 3:
        return jsonify({"error": "compare tray is limited to 3 meals"}), 400

    users.update_one(
        {"email": user.get("email")},
        {
            "$set": {
                "saved_keys": [str(entry) for entry in saved_keys],
                "compare_keys": [str(entry) for entry in compare_keys],
                "updated_at": now_iso(),
            }
        },
    )
    return jsonify({"message": "preferences saved"}), 200


@api.post("/auth/bootstrap-admin")
@require_auth
def bootstrap_admin(user):
    if not is_dev_mode():
        return jsonify({"error": "forbidden"}), 403

    users.update_one(
        {"email": user.get("email")},
        {
            "$set": {
                "role": "admin",
                "updated_at": now_iso(),
            }
        },
    )
    updated_user = users.find_one({"email": user.get("email")})
    login_user(updated_user)
    return jsonify({"message": "admin access granted", "user": auth_payload(updated_user)}), 200


@api.get("/auth/notifications")
@require_auth
def get_notifications(user):
    return jsonify({"notifications": user.get("notifications", [])}), 200


@api.get("/admin/users")
@require_role("admin")
def list_users(user):
    documents = list(users.find({}, USER_PUBLIC_PROJECTION).sort("email", ASCENDING))
    for document in documents:
        document["role"] = document.get("role", "user")
        document["owned_restaurant_ids"] = document.get("owned_restaurant_ids", [])
    return jsonify({"users": documents}), 200


@api.patch("/admin/users/<path:email>/role")
@require_role("admin")
def update_user_role(user, email):
    data = request.get_json() or {}
    role = str(data.get("role") or "").strip()
    owned_restaurant_ids = data.get("owned_restaurant_ids") or []

    if role not in {"user", "restaurant_owner", "admin"}:
        return jsonify({"error": "invalid role"}), 400
    if not isinstance(owned_restaurant_ids, list):
        return jsonify({"error": "owned_restaurant_ids must be an array"}), 400

    normalized_email = normalize_email(email)
    updates = {
        "role": role,
        "owned_restaurant_ids": [str(entry).strip() for entry in owned_restaurant_ids if str(entry).strip()],
        "updated_at": now_iso(),
    }
    result = users.update_one({"email": normalized_email}, {"$set": updates})
    if result.matched_count == 0:
        return jsonify({"error": "user not found"}), 404

    updated_user = users.find_one({"email": normalized_email}, USER_PUBLIC_PROJECTION)
    updated_user["role"] = updated_user.get("role", "user")
    updated_user["owned_restaurant_ids"] = updated_user.get("owned_restaurant_ids", [])
    push_notification(
        normalized_email,
        "Role updated",
        f"Your account role is now {role}. Assigned restaurants: {', '.join(updates['owned_restaurant_ids']) or 'none'}.",
    )
    return jsonify({"message": "user role updated", "user": updated_user}), 200


@api.post("/admin/restaurants")
@require_role("admin")
def create_restaurant(user):
    data = request.get_json() or {}
    restaurant_id = str(data.get("restaurant_id") or "").strip()
    restaurant_name = str(data.get("restaurant_name") or "").strip()
    description = str(data.get("description") or "").strip()

    if not restaurant_id or not restaurant_name:
        return jsonify({"error": "restaurant_id and restaurant_name are required"}), 400

    try:
        restaurants.update_one(
            {"restaurant_id": restaurant_id},
            {
                "$set": {
                    "restaurant_id": restaurant_id,
                    "restaurant_name": restaurant_name,
                    "description": description,
                    "updated_at": now_iso(),
                },
                "$setOnInsert": {"created_at": now_iso()},
            },
            upsert=True,
        )
        restaurant = restaurants.find_one({"restaurant_id": restaurant_id}, {"_id": 0}) or {
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant_name,
            "description": description,
        }
        return jsonify({"message": "restaurant saved", "restaurant": restaurant}), 201
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@api.get("/admin/submissions")
@require_role("admin")
def list_submissions(user):
    status = str(request.args.get("status") or "").strip()
    query = {}
    if status:
        query["status"] = status
    documents = list(submissions.find(query).sort("created_at", ASCENDING))
    return jsonify({"submissions": [serialize_submission(document) for document in documents]}), 200


@api.post("/admin/submissions/<submission_id>/review")
@require_role("admin")
def review_submission(user, submission_id):
    data = request.get_json() or {}
    decision = str(data.get("decision") or "").strip().lower()
    admin_note = str(data.get("admin_note") or "").strip()
    if decision not in {"approved", "rejected"}:
        return jsonify({"error": "decision must be approved or rejected"}), 400
    if decision == "rejected" and not admin_note:
        return jsonify({"error": "admin_note is required when rejecting a submission"}), 400

    try:
        object_id = ObjectId(submission_id)
    except Exception:
        return jsonify({"error": "invalid submission id"}), 400

    document = submissions.find_one({"_id": object_id})
    if not document:
        return jsonify({"error": "submission not found"}), 404
    if document.get("status") != "pending":
        return jsonify({"error": "submission already reviewed"}), 400

    if decision == "approved" and document.get("type") == "restaurant_access":
        users.update_one(
            {"email": document.get("user_email")},
            {
                "$set": {"role": "restaurant_owner", "updated_at": now_iso()},
                "$addToSet": {"owned_restaurant_ids": document.get("restaurant_id")},
            },
        )
        push_notification(
            document.get("user_email"),
            "Restaurant access approved",
            f"Admin approved your access request for {document.get('restaurant_name') or document.get('restaurant_id')}.",
        )
    elif decision == "approved" and document.get("type") == "menu_item":
        payload = document.get("payload") or {}
        payload["restaurant_id"] = document.get("restaurant_id")
        payload["restaurant_name"] = document.get("restaurant_name")
        payload["unique_key"] = (
            f"{payload.get('restaurant_id')}|{payload.get('item_name')}|{payload.get('portion') or ''}"
        ).lower()
        menu_items.update_one({"unique_key": payload["unique_key"]}, {"$setOnInsert": payload}, upsert=True)
        push_notification(
            document.get("user_email"),
            "Menu item approved",
            f"Your submission for {payload.get('item_name')} was approved.",
        )
    elif decision == "approved" and document.get("type") == "restaurant_listing":
        payload = document.get("payload") or {}
        restaurant_name = (
            str(payload.get("restaurant_name") or document.get("restaurant_name") or "").strip()
            or "New restaurant"
        )
        restaurant_id = slugify_restaurant_id(
            payload.get("restaurant_id") or document.get("restaurant_id") or restaurant_name
        )
        description = (
            clean_optional_text(payload.get("menu_note"))
            or clean_optional_text(document.get("note"))
            or ""
        )

        restaurants.update_one(
            {"restaurant_id": restaurant_id},
            {
                "$set": {
                    "restaurant_id": restaurant_id,
                    "restaurant_name": restaurant_name,
                    "description": description,
                    "official_website": clean_optional_text(payload.get("official_website")),
                    "restaurant_email": clean_optional_text(payload.get("restaurant_email")),
                    "phone": clean_optional_text(payload.get("phone")),
                    "updated_at": now_iso(),
                },
                "$setOnInsert": {"created_at": now_iso()},
            },
            upsert=True,
        )

        users.update_one(
            {"email": document.get("user_email")},
            {
                "$set": {"role": "restaurant_owner", "updated_at": now_iso()},
                "$addToSet": {"owned_restaurant_ids": restaurant_id},
            },
        )

        representative_items = payload.get("representative_items") or []
        for raw_item in representative_items:
            item_name = str(raw_item.get("item_name") or "").strip()
            if not item_name:
                continue
            portion = str(raw_item.get("portion") or "").strip()
            menu_payload = {
                "restaurant_id": restaurant_id,
                "restaurant_name": restaurant_name,
                "item_name": item_name,
                "category": clean_optional_text(raw_item.get("category")),
                "portion": portion,
                "description": clean_optional_text(raw_item.get("description")),
                "price_cad": clean_non_negative_number(raw_item.get("price_cad"), "price_cad"),
                "macros": {
                    key: clean_non_negative_number(value, key)
                    for key, value in (raw_item.get("macros") or {}).items()
                    if value is not None and value != ""
                },
                "source_url": clean_optional_text(payload.get("menu_url")),
                "scraped_at": now_iso(),
            }
            menu_payload["unique_key"] = (
                f"{restaurant_id}|{menu_payload.get('item_name')}|{portion}"
            ).lower()
            menu_items.update_one(
                {"unique_key": menu_payload["unique_key"]},
                {"$setOnInsert": menu_payload},
                upsert=True,
            )

        push_notification(
            document.get("user_email"),
            "Restaurant listing approved",
            f"Your restaurant listing for {restaurant_name} is approved and now available for owner management.",
        )
    else:
        push_notification(
            document.get("user_email"),
            "Submission rejected",
            admin_note or "Your pending request was not approved.",
        )

    submissions.update_one(
        {"_id": document["_id"]},
        {
            "$set": {
                "status": decision,
                "admin_note": admin_note,
                "reviewed_at": now_iso(),
            }
        },
    )
    updated = submissions.find_one({"_id": document["_id"]})
    return jsonify({"message": f"submission {decision}", "submission": serialize_submission(updated)}), 200


@api.post("/owner/restaurant-requests")
@require_auth
def request_restaurant_access(user):
    data = request.get_json() or {}
    restaurant_id = str(data.get("restaurant_id") or "").strip()
    note = str(data.get("note") or "").strip()
    if not restaurant_id:
        return jsonify({"error": "restaurant_id is required"}), 400

    restaurant_document = find_restaurant_record(restaurant_id)
    if not restaurant_document:
        return jsonify({"error": "restaurant not found"}), 404

    existing = submissions.find_one(
        {
            "type": "restaurant_access",
            "restaurant_id": restaurant_id,
            "user_email": user.get("email"),
            "status": "pending",
        }
    )
    if existing:
        return jsonify({"error": "request already pending"}), 409

    document = {
        "type": "restaurant_access",
        "status": "pending",
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_document.get("restaurant_name"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "note": note,
        "payload": None,
        "created_at": now_iso(),
    }
    result = submissions.insert_one(document)
    document["_id"] = result.inserted_id
    push_notification_to_admins(
        "New owner access request",
        f"{user.get('name')} ({user.get('email')}) requested access to {restaurant_document.get('restaurant_name') or restaurant_id}.",
    )
    return jsonify({"message": "request submitted", "submission": serialize_submission(document)}), 201


@api.post("/owner/restaurant-submissions")
@require_role("restaurant_owner", "admin")
def create_restaurant_submission(user):
    data = request.get_json() or {}
    try:
        payload = validate_restaurant_listing_payload(data, user)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    existing = submissions.find_one(
        {
            "type": "restaurant_listing",
            "restaurant_id": payload.get("restaurant_id"),
            "user_email": user.get("email"),
            "status": "pending",
        }
    )
    if existing:
        return jsonify({"error": "restaurant submission already pending"}), 409

    document = {
        "type": "restaurant_listing",
        "status": "pending",
        "restaurant_id": payload.get("restaurant_id"),
        "restaurant_name": payload.get("restaurant_name"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "note": clean_optional_text(data.get("note")) or payload.get("menu_note"),
        "payload": payload,
        "created_at": now_iso(),
    }


def serialize_item_issue(document):
    return {
        "id": str(document.get("_id")),
        "status": document.get("status"),
        "issue_type": document.get("issue_type"),
        "note": document.get("note"),
        "attachment_url": document.get("attachment_url"),
        "unique_key": document.get("unique_key"),
        "restaurant_id": document.get("restaurant_id"),
        "restaurant_name": document.get("restaurant_name"),
        "item_name": document.get("item_name"),
        "item_category": document.get("item_category"),
        "price_cad": document.get("price_cad"),
        "source_url": document.get("source_url"),
        "reported_by_name": document.get("reported_by_name"),
        "reported_by_email": document.get("reported_by_email"),
        "reported_at": document.get("reported_at"),
        "reviewed_at": document.get("reviewed_at"),
        "reviewed_by_email": document.get("reviewed_by_email"),
        "manager_note": document.get("manager_note"),
    }
    result = submissions.insert_one(document)
    document["_id"] = result.inserted_id
    push_notification_to_admins(
        "New restaurant listing request",
        f"{user.get('name')} ({user.get('email')}) submitted a new restaurant request for {payload.get('restaurant_name')}.",
    )
    return (
        jsonify(
            {
                "message": "restaurant submitted for review",
                "submission": serialize_submission(document),
            }
        ),
        201,
    )


@api.get("/owner/submissions")
@require_auth
def list_owner_submissions(user):
    documents = list(
        submissions.find(
            {
                "user_email": user.get("email"),
                "status": "pending",
            }
        ).sort("created_at", ASCENDING)
    )
    return jsonify({"submissions": [serialize_submission(document) for document in documents]}), 200


@api.post("/owner/item-submissions")
@require_role("restaurant_owner", "admin")
def create_item_submission(user):
    data = request.get_json() or {}
    try:
        payload = validate_item_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    restaurant_id = payload["restaurant_id"]
    if not can_manage_restaurant(user, restaurant_id):
        return jsonify({"error": "you do not have access to that restaurant"}), 403

    restaurant_document = find_restaurant_record(restaurant_id)
    restaurant_name = (
        payload.get("restaurant_name")
        or (restaurant_document or {}).get("restaurant_name")
        or restaurant_id
    )
    payload["restaurant_name"] = restaurant_name

    document = {
        "type": "menu_item",
        "status": "pending",
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "note": str(data.get("note") or "").strip(),
        "payload": payload,
        "created_at": now_iso(),
    }
    result = submissions.insert_one(document)
    document["_id"] = result.inserted_id
    push_notification_to_admins(
        "New menu item submission",
        f"{user.get('name')} ({user.get('email')}) submitted {payload.get('item_name')} for {restaurant_name}.",
    )
    return jsonify({"message": "item submitted for review", "submission": serialize_submission(document)}), 201


@api.post("/items")
@require_role("admin")
def add_item(user):
    data = request.get_json() or {}
    try:
        payload = validate_item_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    restaurant_id = payload["restaurant_id"]
    restaurant_document = restaurants.find_one({"restaurant_id": restaurant_id}, {"_id": 0})
    restaurant_name = payload.get("restaurant_name") or (restaurant_document or {}).get("restaurant_name")
    payload["restaurant_name"] = restaurant_name or restaurant_id
    payload["unique_key"] = f"{restaurant_id}|{payload['item_name']}|{payload.get('portion') or ''}".lower()

    try:
        menu_items.insert_one(payload)
        return jsonify({"message": "item added"}), 201
    except Exception as exc:
        message = str(exc)
        if "E11000" in message:
            return jsonify({"error": "duplicate item"}), 409
        return jsonify({"error": message}), 400


@api.get("/restaurants")
def get_restaurants():
    pipeline = [
        {
            "$group": {
                "_id": "$restaurant_id",
                "restaurant_id": {"$first": "$restaurant_id"},
                "restaurant_name": {"$first": "$restaurant_name"},
                "item_count": {"$sum": 1},
                "priced_count": {
                    "$sum": {
                        "$cond": [{"$ne": ["$price_cad", None]}, 1, 0],
                    }
                },
            }
        }
    ]
    aggregated = list(menu_items.aggregate(pipeline))
    restaurant_map = {}

    for entry in restaurants.find({}, {"_id": 0}):
        restaurant_map[entry["restaurant_id"]] = {
            "restaurant_id": entry["restaurant_id"],
            "restaurant_name": entry.get("restaurant_name") or entry["restaurant_id"],
            "item_count": 0,
            "priced_count": 0,
            "description": entry.get("description", ""),
            "restaurant_image_url": entry.get("restaurant_image_url"),
        }

    for entry in aggregated:
        restaurant_id = entry.get("restaurant_id")
        record = restaurant_map.get(
            restaurant_id,
            {
                "restaurant_id": restaurant_id,
                "restaurant_name": entry.get("restaurant_name") or restaurant_id,
                "item_count": 0,
                "priced_count": 0,
                "description": "",
            },
        )
        record["item_count"] = entry.get("item_count", 0)
        record["priced_count"] = entry.get("priced_count", 0)
        if not record.get("restaurant_name"):
            record["restaurant_name"] = entry.get("restaurant_name") or restaurant_id
        restaurant_map[restaurant_id] = record

    return jsonify(sorted(restaurant_map.values(), key=lambda entry: entry["restaurant_name"]))


@api.get("/items")
def get_items():
    query = {}

    restaurant_id = (request.args.get("restaurant_id") or "").strip()
    category = (request.args.get("category") or "").strip()
    search = (request.args.get("q") or "").strip()
    priced_only = parse_bool_arg("priced_only")

    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if category:
        query["category"] = category
    if search:
        query["item_name"] = {"$regex": search, "$options": "i"}
    if priced_only:
        query["price_cad"] = {"$ne": None}

    sort_field = request.args.get("sort", "item_name")
    sort_direction = ASCENDING

    if sort_field == "price":
        sort_key = "price_cad"
    elif sort_field == "restaurant":
        sort_key = "restaurant_name"
    else:
        sort_key = "item_name"

    limit = clean_limit()
    offset = clean_offset()

    total = menu_items.count_documents(query)
    items = list(
        menu_items.find(query, ITEM_PROJECTION)
        .sort(sort_key, sort_direction)
        .skip(offset)
        .limit(limit)
    )

    return jsonify({"items": items, "total": total, "limit": limit, "offset": offset})


@api.get("/items/by-key/<path:unique_key>")
def get_item_by_key(unique_key):
    item = menu_items.find_one({"unique_key": unquote(unique_key)}, ITEM_PROJECTION)
    if not item:
        return jsonify({"error": "item not found"}), 404
    return jsonify(item)


@api.post("/items/by-key/<path:unique_key>/issues")
@require_auth
def report_item_issue(user, unique_key):
    item = menu_items.find_one({"unique_key": unquote(unique_key)}, ITEM_PROJECTION)
    if not item:
        return jsonify({"error": "item not found"}), 404

    data = request.get_json() or {}
    issue_type = str(data.get("issue_type") or "").strip()
    note = clean_optional_text(data.get("note"))
    attachment_url = clean_optional_url(data.get("attachment_url"), "attachment_url")
    if issue_type not in ISSUE_TYPE_ALLOWLIST:
        return jsonify({"error": "invalid issue_type"}), 400

    document = {
        "status": "open",
        "issue_type": issue_type,
        "note": note,
        "attachment_url": attachment_url,
        "unique_key": item.get("unique_key"),
        "restaurant_id": item.get("restaurant_id"),
        "restaurant_name": item.get("restaurant_name"),
        "item_name": item.get("item_name"),
        "item_category": item.get("category"),
        "price_cad": item.get("price_cad"),
        "source_url": item.get("source_url"),
        "reported_by_name": user.get("name"),
        "reported_by_email": user.get("email"),
        "reported_at": now_iso(),
        "manager_note": None,
    }
    result = item_issues.insert_one(document)
    document["_id"] = result.inserted_id

    push_notification_to_admins(
        "New food listing issue reported",
        f"{user.get('name')} reported {item.get('item_name')} at {item.get('restaurant_name')}.",
    )
    push_notification_to_restaurant_managers(
        item.get("restaurant_id"),
        "Food listing issue reported",
        f"Issue reported for {item.get('item_name')} ({item.get('restaurant_name')}).",
    )
    return jsonify({"message": "issue reported", "issue": serialize_item_issue(document)}), 201


@api.get("/management/item-issues")
@require_role("restaurant_owner", "admin")
def list_item_issues(user):
    role = user.get("role", "user")
    status = str(request.args.get("status") or "").strip()
    restaurant_id = str(request.args.get("restaurant_id") or "").strip()

    query = {}
    if status:
        query["status"] = status
    if role == "admin":
        if restaurant_id:
            query["restaurant_id"] = restaurant_id
    else:
        owned_restaurant_ids = user.get("owned_restaurant_ids", [])
        if not owned_restaurant_ids:
            return jsonify({"issues": []}), 200
        query["restaurant_id"] = {"$in": owned_restaurant_ids}
        if restaurant_id and restaurant_id in owned_restaurant_ids:
            query["restaurant_id"] = restaurant_id

    documents = list(
        item_issues.find(query).sort("reported_at", DESCENDING).limit(clean_limit(default=200))
    )
    return jsonify({"issues": [serialize_item_issue(document) for document in documents]}), 200


@api.patch("/management/item-issues/<issue_id>")
@require_role("restaurant_owner", "admin")
def update_item_issue(user, issue_id):
    try:
        object_id = ObjectId(issue_id)
    except Exception:
        return jsonify({"error": "invalid issue id"}), 400

    document = item_issues.find_one({"_id": object_id})
    if not document:
        return jsonify({"error": "issue not found"}), 404
    if not can_manage_restaurant(user, document.get("restaurant_id")):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json() or {}
    next_status = str(data.get("status") or "").strip()
    manager_note = clean_optional_text(data.get("manager_note"))
    if next_status and next_status not in ISSUE_STATUS_ALLOWLIST:
        return jsonify({"error": "invalid status"}), 400
    if not next_status and manager_note is None:
        return jsonify({"error": "status or manager_note is required"}), 400

    updates = {"reviewed_at": now_iso(), "reviewed_by_email": user.get("email")}
    if next_status:
        updates["status"] = next_status
    if manager_note is not None:
        updates["manager_note"] = manager_note

    item_issues.update_one({"_id": object_id}, {"$set": updates})
    updated = item_issues.find_one({"_id": object_id})
    if updated and updated.get("reported_by_email"):
        readable_status = updated.get("status", "updated")
        push_notification(
            updated.get("reported_by_email"),
            "Issue report updated",
            f"Your report for {updated.get('item_name')} is now {readable_status}.",
        )
    return jsonify({"message": "issue updated", "issue": serialize_item_issue(updated)}), 200


@api.post("/items/fill-missing-details")
def fill_missing_details():
    items = list(
        menu_items.find(
            {
                "$or": [
                    {"category": None},
                    {"category": {"$exists": False}},
                    {"description": None},
                    {"description": {"$exists": False}},
                ]
            }
        )
    )

    updated_count = 0
    failed_count = 0

    for item in items:
        try:
            result = generate_category_and_description(item)
            menu_items.update_one(
                {"_id": item["_id"]},
                {
                    "$set": {
                        "category": result["category"],
                        "description": result["description"],
                    }
                },
            )
            updated_count += 1
        except Exception:
            failed_count += 1

    return (
        jsonify(
            {
                "message": "missing item details processed",
                "updated_count": updated_count,
                "failed_count": failed_count,
            }
        ),
        200,
    )
