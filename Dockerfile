# Multi-stage Dockerfile for Shop Billing System
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev && cd backend && npm ci --omit=dev

# Copy backend source, database schemas, and frontend build
COPY backend/ ./backend/
COPY database/ ./database/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 5000

CMD ["npm", "start"]
