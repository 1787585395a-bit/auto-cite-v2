# ── 阶段1：构建前端静态文件 ──────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── 阶段2：生产镜像（Python + Node）─────────────────────
FROM python:3.11-slim

# 安装 Node.js 22
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 安装 Node 生产依赖
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --omit=dev

# 复制 Python 源码
COPY src/ ./src/
COPY scripts/ ./scripts/

# 复制前端构建产物（来自阶段1）
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 复制 Express 服务器
COPY frontend/electron/ ./frontend/electron/

# 创建运行时目录
RUN mkdir -p outputs frontend/uploads

EXPOSE 8080

CMD ["node", "frontend/electron/server.js"]
