#!/bin/sh
# Preview-only start script — see Dockerfile.preview for context.
echo "docker-start.sh: PORT env var is [${PORT}]"
PORT_TO_USE="${PORT:-3000}"
echo "docker-start.sh: serving on port [${PORT_TO_USE}]"
exec serve -s build -l "tcp://0.0.0.0:${PORT_TO_USE}"
