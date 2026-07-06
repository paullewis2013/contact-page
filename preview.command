#!/bin/bash
# Local preview for paullew.is — double-click me (macOS).
# Serves the site over http so the blog's post fetching works,
# then opens it in your default browser. Ctrl+C here to stop.
cd "$(dirname "$0")"
PORT=8437
( sleep 1; open "http://localhost:$PORT/" ) &
exec python3 -m http.server "$PORT"
