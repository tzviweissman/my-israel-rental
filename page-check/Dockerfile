# The page-check service (server.mjs). Microsoft's Playwright image carries
# Chromium and every system library it needs; its version must match the
# playwright package in package.json, or the browser it expects is missing.
FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs check-core.mjs ./
USER pwuser
CMD ["node", "server.mjs"]
