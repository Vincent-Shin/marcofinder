from flask import Flask
from flask_cors import CORS
from routes import api
import os
import secrets
from datetime import timedelta

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=14)
app.config["UPLOAD_ROOT"] = os.environ.get("UPLOAD_ROOT") or os.path.join(
    os.path.dirname(__file__), "uploads"
)
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_UPLOAD_MB", "12")) * 1024 * 1024
CORS(app, supports_credentials=True)

app.register_blueprint(api)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
