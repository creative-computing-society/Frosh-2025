# --- Stage 1: Builder ---
FROM node:18-buster-slim AS builder

COPY package.json .
RUN npm install
COPY . .

# --- Stage 2: Runtime ---
FROM node:18-buster-slim
COPY --from=builder . .

# Install PM2 globally for process management
RUN npm install -g pm2

# Start both server.js and bookingqueue.js using PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
