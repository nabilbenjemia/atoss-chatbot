"""
RAG Chain Service
Implements the Retrieval-Augmented Generation chain for question answering
"""
import logging
from typing import Optional, AsyncIterator, List

from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document

from config.settings import settings
from models.llm_model import llm_manager
from services.retriever_service import retriever_service

logger = logging.getLogger(__name__)

ERROR_RAG_NOT_INITIALIZED = "RAG chain not initialized"

# RAG Prompt Template
RAG_PROMPT_TEMPLATE = """You are a helpful AI assistant for ATOSS workforce management solutions.
Use the following context to answer the user's question. If you cannot find the answer in the context,
say so honestly and provide general guidance based on your knowledge.

Context:
{context}

Question: {question}

Instructions:
- Provide a clear, concise, and helpful answer
- Reference specific information from the context when applicable
- If the context doesn't contain relevant information, acknowledge this
- Be professional and friendly in your response

Answer:"""


class RAGChainService:
    """Service for RAG-based question answering with streaming support"""

    _instance: Optional["RAGChainService"] = None
    _is_ready: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._is_ready = False
            self._prompt = ChatPromptTemplate.from_template(RAG_PROMPT_TEMPLATE)

    def initialize(self) -> bool:
        """Initialize the RAG chain (verify dependencies are loaded)"""
        try:
            # Verify all dependencies are loaded
            if not llm_manager.is_loaded:
                raise RuntimeError("LLM must be loaded before RAG chain")
            if not retriever_service.is_loaded:
                msg = "Retriever service must be loaded before RAG chain"
                raise RuntimeError(msg)

            self._is_ready = True
            logger.info("RAG chain service initialized successfully")
            return True

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to initialize RAG chain: %s", e)
            self._is_ready = False
            raise

    def _format_docs(self, docs: List[Document]) -> str:
        """Format retrieved documents into a context string"""
        if not docs:
            return "No relevant context found."

        formatted = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get("source", "Unknown")
            max_len = settings.MAX_CONTEXT_LENGTH // len(docs)
            content = doc.page_content[:max_len]
            formatted.append(f"[{i}] Source: {source}\n{content}")

        return "\n\n".join(formatted)

    async def generate_response(self, question: str) -> str:
        """Generate a complete response for a question"""
        if not self._is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        try:
            # Retrieve relevant documents
            docs = await retriever_service.retrieve(question)
            context = self._format_docs(docs)

            # Format the prompt
            prompt_text = self._prompt.format(context=context, question=question)

            # Generate response
            llm = llm_manager.get_llm()
            response = await llm.ainvoke(prompt_text)

            if isinstance(response.content, str):
                return response.content
            return str(response.content)

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Error generating response: %s", e)
            raise

    async def stream_response(self, question: str) -> AsyncIterator[str]:
        """Stream a response for a question"""
        if not self._is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        try:
            # Retrieve relevant documents
            docs = await retriever_service.retrieve(question)
            context = self._format_docs(docs)

            # Format the prompt
            prompt_text = self._prompt.format(context=context, question=question)

            # Get streaming LLM
            streaming_llm = llm_manager.get_streaming_llm()

            # Stream the response
            async for chunk in streaming_llm.astream(prompt_text):
                if hasattr(chunk, 'content') and isinstance(chunk.content, str):
                    yield chunk.content
                elif isinstance(chunk, str):
                    yield chunk

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Error streaming response: %s", e)
            raise

    async def get_relevant_documents(self, question: str) -> List[Document]:
        """Get relevant documents for a question (for debugging/inspection)"""
        if not self._is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        return await retriever_service.retrieve(question)

    @property
    def is_ready(self) -> bool:
        """Check if RAG chain service is ready"""
        return self._is_ready


# Singleton instance
rag_chain_service = RAGChainService()
