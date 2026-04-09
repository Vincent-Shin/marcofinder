## MacroFinder

MacroFinder helps users compare restaurant meals by price and macros, while giving restaurant owners and admins a moderation workflow for menu updates.

## Stack

- Frontend: Remix, React, TypeScript, Vite
- Backend: Flask, Python
- Database: MongoDB Atlas for shared data, MongoDB in Docker for local stack testing
- Deployment: Docker Compose locally, Render for public hosting

## User Roles

- `user`: browse meals, save favorites, compare items, manage profile
- `restaurant_owner`: request restaurant access and submit menu changes for admin review
- `admin`: create restaurants, assign owners, and approve or reject owner requests and menu submissions

## Mobile Strategy

MacroFinder uses a mixed strategy: desktop-first for management workflows and mobile-friendly responsive behavior for high-frequency browsing tasks. The main discovery flow is the most common user path, so search, filtering, rankings, and restaurant browsing are designed to collapse cleanly onto smaller screens with stacked controls, horizontally scrollable chip rails, single-column cards, and touch-sized actions. This keeps the mobile experience fast for regular users who are likely deciding what to eat on the go.

Administrative and owner tools are more complex, so they are designed from a desktop-first information architecture and then adapted responsively for mobile. On smaller screens, dense management panels collapse into single-column layouts, form grids stack vertically, action groups expand to full width, and long queues use internal scrolling to avoid excessive page growth. This preserves access to the full moderation workflow on mobile while acknowledging that desktop remains the best environment for heavy management tasks.

The trade-off is intentional: no role loses core functionality on mobile, but the interface prioritizes speed and clarity for browsing first, and then compresses higher-complexity management tools in a usable way for smaller screens.

## Project Structure

- [backend](/c:/Users/vince/seng513-remix-integration/backend): Flask API, auth, moderation, database access
- [frontend](/c:/Users/vince/seng513-remix-integration/frontend): Remix frontend
- [scraper](/c:/Users/vince/seng513-remix-integration/scraper): restaurant scrapers and ingestion tooling
- [deploy](/c:/Users/vince/seng513-remix-integration/deploy): nginx and Render runtime config
- [docker-compose.yml](/c:/Users/vince/seng513-remix-integration/docker-compose.yml): local full-stack Docker environment

## Local Development

Backend in `cmd`:

```cmd
cd c:\Users\vince\seng513-remix-integration\backend
set MONGO_URI=mongodb+srv://MainUser:User123@cluster1.j4e1jvz.mongodb.net/?appName=Cluster1
set DB_NAME=macro_finder
set FLASK_SECRET_KEY=macrofinder-local-dev-secret-2026
set ADMIN_EMAIL=admin@macrofinder.local
set PORT=5003
python app.py
```

Frontend:

```cmd
cd c:\Users\vince\seng513-remix-integration\frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Useful routes:

- `http://127.0.0.1:5173/discover`
- `http://127.0.0.1:5173/login`
- `http://127.0.0.1:5173/signup`
- `http://127.0.0.1:5173/profile`
- `http://127.0.0.1:5173/admin`
- `http://127.0.0.1:5003/health`

## Docker

The Docker stack runs the full local app:

- `mongo`
- `backend`
- `frontend`
- `proxy`

Start it from the repo root:

```cmd
docker compose up --build
```

Main local Docker entrypoint:

- `http://127.0.0.1:8080`

Useful Docker endpoints:

- `http://127.0.0.1:8080/discover`
- `http://127.0.0.1:8080/admin`
- `http://127.0.0.1:8080/api/health`

Stop the stack:

```cmd
docker compose down
```

Remove the local Docker database volume:

```cmd
docker compose down -v
```

## Public Deployment

Current Render deployment:

- `https://macrofinder-remix.onrender.com`

## Notes

- The backend owns business logic, auth, moderation, and persistence.
- The scraper never writes directly to MongoDB; data flows through the backend API.
- Secrets such as [backend/.env](/c:/Users/vince/seng513-remix-integration/backend/.env) are local-only and should not be committed.
