#!/usr/bin/env bash
set -e

# Start Ollama in the background
/bin/ollama serve &
pid=$!

# Wait for Ollama server to be ready
echo "Waiting for Ollama server to start..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama server is ready"

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
curl -s http://localhost:11434/api/generate -d "{\"model\":\"$MODEL\",\"prompt\":\"Hello\",\"stream\":false,\"keep_alive\":-1}" > /dev/null
echo "Model preloaded and will stay in memory"

# Keep the server running
echo "Ollama is ready with model $MODEL"
wait $pid