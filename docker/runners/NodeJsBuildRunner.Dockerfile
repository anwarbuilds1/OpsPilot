# OpsPilot Hardened Node.js Build Runner (Wrangler / Esbuild / Static SSG)
FROM node:20-alpine

# Security: drop root privileges, create dedicated unprivileged builder user
RUN addgroup -g 10001 opspilot && \
    adduser -u 10001 -G opspilot -s /bin/sh -D builder

# Install build essentials and enable Corepack for pnpm/yarn/npm support
RUN apk add --no-cache git bash python3 make g++ curl ca-certificates && \
    corepack enable

# Pre-install bundlers
RUN npm install -g esbuild@0.24.0

COPY scripts/build-entrypoint.sh /usr/local/bin/build-entrypoint.sh
RUN chmod 755 /usr/local/bin/build-entrypoint.sh

USER 10001:10001
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/build-entrypoint.sh"]
