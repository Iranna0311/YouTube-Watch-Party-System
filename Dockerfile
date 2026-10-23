FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace manifests
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/

# Install dependencies
RUN npm run install:all

# Copy source code
COPY server/ server/
COPY client/ client/

# Build client and server
RUN npm run build

# Production runtime stage
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server/package.json server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "server/dist/index.js"]

