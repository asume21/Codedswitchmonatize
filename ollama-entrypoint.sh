#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-llama3.1:8b}"

echo "=== Ollama Sidecar starting ==="
echo "Model: $MODEL"
echo "Storage: $OLLAMA_MODELS"

# Start Ollama server in the background
ollama serve &
SERVER_PID=$!

# Wait until the API is responding
echo "Waiting for Ollama server to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done
echo "Ollama server ready."

# Pull the model only if it is not already on the volume
if ollama list 2>/dev/null | grep -q "^${MODEL}"; then
  echo "Model '$MODEL' already present — skipping pull."
else
  echo "Pulling '$MODEL' (first run — this takes a few minutes)..."
  ollama pull "$MODEL"
  echo "Pull complete."
fi

echo "=== Ollama ready to serve requests ==="

# Hand off to the server process so Railway tracks the right PID
wait $SERVER_PID
