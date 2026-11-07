# OpsPilot Hardened Container Build Runner
FROM alpine:3.20

# Create dedicated unprivileged user 'builder' (UID 10001, GID 10001)
RUN addgroup -g 10001 opspilot && \
    adduser -u 10001 -G opspilot -s /bin/sh -D builder

# Install minimal build utilities
RUN apk add --no-cache git bash tar curl ca-certificates

# Copy runner entrypoint
COPY scripts/build-entrypoint.sh /usr/local/bin/build-entrypoint.sh
RUN chmod 755 /usr/local/bin/build-entrypoint.sh

# Run as non-root
USER 10001:10001
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/build-entrypoint.sh"]
