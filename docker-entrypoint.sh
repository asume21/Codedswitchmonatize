#!/bin/bash
# docker-entrypoint.sh
# Startup script for CodedSwitch with Ollama

set -e

echo "🚀 Starting CodedSwitch with Local AI..."

# Start Ollama in background
echo "🖥️ Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready with health check loop
echo "⏳ Waiting for Ollama to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Waiting for Ollama... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "⚠️ Ollama did not start in time, continuing anyway (will use cloud fallback)"
fi

# Verify/pull configured model (default llama3.1:8b)
echo "📦 OLLAMA_MODEL env: ${OLLAMA_MODEL}"
MODEL_NAME=${OLLAMA_MODEL:-llama3.1:8b}
echo "📦 Verifying model: $MODEL_NAME"
if ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    echo "✅ Model '$MODEL_NAME' is ready"
else
    echo "⚠️ Model '$MODEL_NAME' not found. Starting download in background..."
    (
      set +e
      ollama pull "$MODEL_NAME"
      if [ $? -eq 0 ]; then
        echo "✅ Model '$MODEL_NAME' downloaded"
      else
        echo "⚠️ Model '$MODEL_NAME' download failed; please check connectivity or model name"
      fi
    ) &
fi

# Start CodedSwitch
echo "🎵 Starting CodedSwitch server..."
exec node dist/index.cjs
