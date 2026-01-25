#!/usr/bin/env bash
set -e

# Start Ollama in the background
/bin/ollama serve &
pid=$!

# Wait for Ollama server to be ready
echo "Waiting for Ollama server to start..."
RETRY_COUNT=0
MAX_RETRIES=30
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Try using ollama list command instead of curl since curl might not be available
    if ollama list >/dev/null 2>&1; then
        echo "Ollama server is ready (attempt $RETRY_COUNT)"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for server... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Ollama server failed to start after $MAX_RETRIES seconds"
    exit 1
fi

# Pull the model
MODEL="${OLLAMA_MODEL:-qwen2.5:7b-instruct-q4_0}"
echo "Checking if model $MODEL exists..."

# Check if model already exists
if ollama list | grep -q "$MODEL"; then
    echo "Model $MODEL already exists, skipping download"
else
    echo "Pulling $MODEL... This may take several minutes."
    ollama pull "$MODEL" || {
        echo "Failed to pull model $MODEL"
        exit 1
    }
    echo "Model $MODEL downloaded successfully"
fi

# Preload the model into memory
echo "Preloading model $MODEL into memory..."
echo "Hello" | ollama run "$MODEL" --keepalive -1 > /dev/null 2>&1 &
sleep 2
echo "Model preloaded and will stay in memory"

# Keep the server running
echo "Ollama is ready with model $MODEL"
wait $pid