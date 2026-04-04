MacroFinder

MacroFinder is a project that collects nutrition information from restaurant menus and stores it in a database. The data is scraped from restaurant nutrition PDFs or websites and then sent to a backend API which stores the information in MongoDB.

The goal of the project is to create a database of restaurant food items and their macros such as calories, protein, carbs, fat, sodium, and sugar.

---

Project Structure

MacroFinder/

backend/
Contains the Flask backend API.

Files include:
app.py
routes.py
db.py
requirements.txt
.env (local only)

scraper/
Contains the scraping system.

Files include:
item_template.py
api_client.py
run_all_scrapers.py

scraper/restaurants/
Contains individual scrapers for each restaurant.

docker-compose.yml
Docker configuration for running backend and database locally.

README.md
Project documentation.

---

How the System Works

Restaurant Nutrition PDF or Website
↓
Python Scraper
↓
HTTP POST request to Flask Backend
↓
MongoDB Database
↓
API endpoints return stored data

The scraper does not write directly to the database.
All data is sent through the backend API.

---

Technology Stack

Python 3.9+
Flask
MongoDB Atlas
PyMongo
requests
pdfplumber
Docker Compose
GitLab

---

Database Schema

The MongoDB collection is called:

menu_items

Each document contains:

restaurant_id
restaurant_name
item_name
category
portion
price_cad
unique_key

macros
calories
protein_g
carbs_g
fat_g
sodium_mg
sugar_g

source_url
scraped_at

---

Duplicate Protection

Each item has a deterministic key:

restaurant_id | item_name | portion

This value is stored as:

unique_key

MongoDB also has a unique index on this field.
This ensures that the same item cannot be inserted twice.

If a duplicate item is sent to the backend, the API returns HTTP 409.

---

Backend API

Health Check

GET /health

Used to verify that the backend server is running.

Example:

[http://localhost:5000/health](http://localhost:5000/health)

---

Insert Item

POST /items

Adds a normalized menu item to the database.

Responses:

201  item inserted successfully
409  duplicate item
400  validation error

---

Get All Items

GET /items

Returns all stored menu items.

Example:

[http://localhost:5000/items](http://localhost:5000/items)

---

Running the Backend Locally

1. Go to the backend folder

cd backend

2. Activate the virtual environment

.\venv\Scripts\Activate.ps1

3. Install dependencies

pip install -r requirements.txt

4. Create a .env file

Inside backend/ create a file called .env

Example:

MONGO_URI=your_mongodb_connection_string
DB_NAME=macro_finder

5. Start the backend

python app.py

The backend will run at:

[http://127.0.0.1:5000](http://127.0.0.1:5000)

---

Running the Scrapers

1. Go to the scraper folder

cd scraper

2. Activate the virtual environment

.\venv\Scripts\Activate.ps1

3. Install dependencies

pip install -r requirements.txt

4. Run one scraper

Example:

python restaurants\subway_scraper.py

---

Run All Scrapers

You can run all restaurant scrapers automatically:

python run_all_scrapers.py

This script runs each scraper one by one and sends data to the backend API.

---

Docker Setup

For demonstration and testing, the project includes a Docker Compose environment.

This runs:

Flask backend
MongoDB database

The Docker database acts as a makeshift database for the assignment.

---

Start Docker Environment

From the project root:

docker compose up --build

The backend will be available at:

[http://localhost:5000](http://localhost:5000)

---

Seed the Database

After starting Docker, open another terminal and run:

cd scraper

.\venv\Scripts\Activate.ps1

python run_all_scrapers.py

This will send all scraped items to the backend which stores them in the MongoDB container.

---

Stop Docker

docker compose down

This stops the containers but keeps the database.

---

Delete the Docker Database

docker compose down -v

This removes the MongoDB volume and clears all stored data.

---

Checking Stored Data

From a browser:

[http://localhost:5000/items](http://localhost:5000/items)

---

Checking the Database Directly

docker exec -it macrofinder-mongo mongosh

Then run:

use macro_finder
db.menu_items.countDocuments()

---

Git Workflow

The main branch is protected.

Do not push directly to main.

Use a feature branch and create a Merge Request.

Example workflow:

git checkout main
git pull origin main

git checkout mohit-scraper

git add .
git commit -m "message"
git push origin mohit-scraper

Then create a Merge Request in GitLab.

---

Notes

The scraper never inserts data directly into MongoDB.
All data goes through the backend API.

The Docker database is only for local testing and demonstration.
MongoDB Atlas can still be used in development if configured in the .env file.
