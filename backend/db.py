import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(override=True)

mongo_uri = os.getenv("MONGO_URI") or "mongodb://127.0.0.1:27017/"
db_name = os.getenv("DB_NAME") or "macro_finder"
auth_mongo_uri = os.getenv("AUTH_MONGO_URI") or mongo_uri
auth_db_name = os.getenv("AUTH_DB_NAME") or f"{db_name}_auth"

menu_client = MongoClient(mongo_uri)
auth_client = MongoClient(auth_mongo_uri)

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
