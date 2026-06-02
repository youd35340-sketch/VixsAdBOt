FROM node:20-slim

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace root config (build context is repo root)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy shared packages
COPY packages ./packages

# Copy the api-server artifact
COPY artifacts/api-server ./artifacts/api-server

# Install all dependencies from workspace root
RUN pnpm install --frozen-lockfile

# Build the api-server
RUN pnpm --filter @workspace/api-server run build

WORKDIR /app/artifacts/api-server

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.js"]
