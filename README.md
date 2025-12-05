# ATOSS.GPT


## Chatbot Strategy 

qwen2.5:7b-instruct-q4_0 (89% Accuracy, 3.8s latency). It is the most reliable model for understanding internal hospital queries

Snowflake/snowflake-arctic-embed-l-v2.0 will serve as the embedding model with the best result 

### AI Strategy

Implement a strictly on-premise Retrieval-Augmented Generation (RAG) system pairing Qwen 2.5 for German text generation with Snowflake Arctic Embed L v2.0 for high-precision document retrieval. This "dual-model" approach ensures that all hospital data remains offline while leveraging Snowflake's superior multilingual understanding to find the exact paragraph needed from handbooks before Qwen answers.


### Software Stack 

1. Engine Ollama
   * Run ollama serve
   * Pull models: ollama pull qwen2.5:7b and ollama pull snowflake-arctic-embed2

2. Vector Database 
   * ChromaDB -> stores mathematical representation created by the snowflake model

3. Frontend & Backend
   * MERN stack

### Why Ollama?

* Data sovereignity: operates entirely offline
* Unified pipeline: can run both LLM and the embedding model
* More efficient on worse hardware due to quantization 
* Ollama eliminates the complexity of raw model deployment








