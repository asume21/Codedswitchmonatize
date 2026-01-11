#!/bin/bash
# docker-entrypoint.sh
# Startup script for CodedSwitch with Ollama

set -e

echo "🚀 Starting CodedSwitch with Local AI..."

# Start Ollama in background
echo "🖥️ Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
sleep 5

# Verify model is available
echo "📦 Verifying Llama 3.1 model..."
if ollama list | grep -q "llama3.1:8b"; then
    echo "✅ Llama 3.1 model is ready"
else
    echo "⚠️ Model not found, downloading..."
    ollama pull llama3.1:8b
fi

# Start CodedSwitch
echo "🎵 Starting CodedSwitch server..."
exec node dist/index.cjs
