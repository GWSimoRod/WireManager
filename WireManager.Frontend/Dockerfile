# ── Stage 1: Install dependencies ─────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci 


# ── Stage 2: Build the application ───────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env defaults (overridable via --build-arg)
ARG API_BASE_URL=http://localhost:7254
ARG BACKEND_URL=http://localhost:7254

ENV API_BASE_URL=${API_BASE_URL}
ENV BACKEND_URL=${BACKEND_URL}

RUN npm run build

# ── Stage 3: Production runner ───────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime env vars — override these when running the container
# e.g.  docker run -e API_BASE_URL=https://api.example.com ...
ENV API_BASE_URL=http://localhost:7254
ENV BACKEND_URL=http://localhost:7254

CMD ["node", "server.js"]
