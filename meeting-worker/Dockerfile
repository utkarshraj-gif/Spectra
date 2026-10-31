# Official Playwright image with all browser dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.45.0-jammy AS base

WORKDIR /app

# Copy dependency manifests
COPY package.json ./

# Install dependencies (only production packages in final stage)
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Expose internal worker daemon port
EXPOSE 5001

# Environment defaults
ENV PORT=5001
ENV NODE_ENV=production

# Start worker service
CMD ["node", "dist/index.js"]

