FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci --omit=dev

COPY src/ ./src/
COPY scripts/ ./scripts/
COPY frontend/server.js ./frontend/server.js
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p outputs frontend/uploads

EXPOSE 8080

CMD ["node", "frontend/server.js"]
