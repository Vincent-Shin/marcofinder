import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(override=True)

mongo_uri = os.getenv("MONGO_URI") or "mongodb://127.0.0.1:27017/"
db_name = os.getenv("DB_NAME") or "macro_finder"
auth_mongo_uri = os.getenv("AUTH_MONGO_URI") or mongo_uri
auth_db_name = os.getenv("AUTH_DB_NAME") or f"{db_name}_auth"

DB_CONNECTION_ERROR = None
DB_CONNECTION_STATUS = "disconnected"


class DatabaseUnavailableError(RuntimeError):
    pass


class UnavailableCollection:
    def __init__(self, name):
        self.name = name

    def __getattr__(self, _name):
        raise DatabaseUnavailableError(
            f"Database is unavailable for collection '{self.name}': {DB_CONNECTION_ERROR or 'unknown error'}"
        )


def _build_client(uri):
    return MongoClient(uri, serverSelectionTimeoutMS=3000)


def _connect_collections():
    global DB_CONNECTION_ERROR, DB_CONNECTION_STATUS

    try:
        menu_client = _build_client(mongo_uri)
        auth_client = _build_client(auth_mongo_uri)

        menu_client.admin.command("ping")
        auth_client.admin.command("ping")

        menu_db = menu_client[db_name]
        auth_db = auth_client[auth_db_name]

        menu_items = menu_db["menu_items"]
        menu_items.create_index("unique_key", unique=True)
        menu_items.create_index("restaurant_id")
        menu_items.create_index("category")
        menu_items.create_index("item_name")

        restaurants = menu_db["restaurants"]
        restaurants.create_index("restaurant_id", unique=True)
        restaurants.create_index("restaurant_name")

        users = auth_db["users"]
        users.create_index("email", unique=True)

        password_resets = auth_db["password_resets"]
        password_resets.create_index("email", unique=True)
        password_resets.create_index("token", unique=True)

        submissions = auth_db["submissions"]
        submissions.create_index("status")
        submissions.create_index("type")
        submissions.create_index("user_email")

        item_issues = auth_db["item_issues"]
        item_issues.create_index("status")
        item_issues.create_index("restaurant_id")
        item_issues.create_index("unique_key")
        item_issues.create_index("reported_by_email")

        DB_CONNECTION_ERROR = None
        DB_CONNECTION_STATUS = "connected"
        return menu_items, restaurants, users, password_resets, submissions, item_issues
    except Exception as exc:
        DB_CONNECTION_ERROR = str(exc)
        DB_CONNECTION_STATUS = "disconnected"
        return (
            UnavailableCollection("menu_items"),
            UnavailableCollection("restaurants"),
            UnavailableCollection("users"),
            UnavailableCollection("password_resets"),
            UnavailableCollection("submissions"),
            UnavailableCollection("item_issues"),
        )


def database_status():
    return {"status": DB_CONNECTION_STATUS, "error": DB_CONNECTION_ERROR}


(
    menu_items,
    restaurants,
    users,
    password_resets,
    submissions,
    item_issues,
) = _connect_collections()
