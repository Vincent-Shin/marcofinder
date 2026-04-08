FROM node:20-bookworm-slim AS frontend-build

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim AS frontend-runtime
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=10000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip nginx supervisor gettext-base \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY deploy/nginx.render.conf.template /app/deploy/nginx.render.conf.template
COPY deploy/supervisord.render.conf /app/deploy/supervisord.render.conf
COPY deploy/render-entrypoint.sh /app/deploy/render-entrypoint.sh
RUN chmod +x /app/deploy/render-entrypoint.sh

COPY --from=frontend-runtime /app/frontend/node_modules /app/frontend/node_modules
COPY --from=frontend-build /app/frontend/build /app/frontend/build
COPY frontend/package.json frontend/package-lock.json /app/frontend/

EXPOSE 10000

CMD ["/app/deploy/render-entrypoint.sh"]
