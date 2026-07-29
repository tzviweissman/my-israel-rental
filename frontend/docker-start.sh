#!/bin/sh
# Preview-only start script — see Dockerfile.preview for context.
# TEMPORARY: hold the process open for a bit so the debug echoes below
# are guaranteed to reach the log pipeline before anything can crash and
# exit the container — remove the sleep once the real issue is confirmed.
echo "docker-start.sh: started, sleeping 20s for log visibility"
sleep 20
echo "docker-start.sh: PORT env var is [${PORT}]"
PORT_TO_USE="${PORT:-3000}"
echo "docker-start.sh: serving on port [${PORT_TO_USE}]"
echo "docker-start.sh: serve version is $(serve --version 2>&1)"
exec serve -s build -l "tcp://0.0.0.0:${PORT_TO_USE}"
