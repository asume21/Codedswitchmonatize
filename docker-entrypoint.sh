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

# Verify model is available
echo "📦 Verifying Phi3 model..."
if ollama list 2>/dev/null | grep -q "phi3:medium"; then
    echo "✅ Phi3 model is ready"
else
    echo "⚠️ Model not found. Starting download in background (server will start now; cloud fallback will be used until model is ready)..."
    (
      set +e
      ollama pull phi3:medium
      if [ $? -eq 0 ]; then
        echo "✅ Phi3 model downloaded"
      else
        echo "⚠️ Phi3 model download failed; cloud fallback will remain in use"
      fi
    ) &
fi

# Start CodedSwitch
echo "🎵 Starting CodedSwitch server..."
exec node dist/index.cjs
