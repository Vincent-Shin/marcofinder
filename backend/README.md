Macro Finder Backend

Setup:
1) Create a file named .env inside backend/
2) Copy values from .env.example
3) Replace MONGO_URI with the shared Atlas URI
4) Run: python app.py

Notes:
- `DB_NAME` stores menu and restaurant data.
- `AUTH_DB_NAME` stores login/signup users in a separate database.
- If `AUTH_MONGO_URI` is not set, auth uses the same Mongo cluster as `MONGO_URI`.
- `FLASK_SECRET_KEY` signs the backend session cookie and password reset tokens.
- `ADMIN_EMAIL` can promote a specific signup email to `admin`; otherwise the first account created becomes admin.
