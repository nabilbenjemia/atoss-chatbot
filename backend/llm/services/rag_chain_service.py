"""
RAG Chain Service
Implements the Retrieval-Augmented Generation chain for question answering
"""

import logging
from typing import Optional, AsyncIterator, List, Any

from models.vectorstore import vectorstore_manager
from models.llm_model import llm_manager
from models.reranker_model import reranker_manager

from config.settings import settings
from models.llm_model import llm_manager

logger = logging.getLogger(__name__)

ERROR_RAG_NOT_INITIALIZED = "RAG chain not initialized"


CONTEXT_CHATBOT = """This is the context from the provided documents:\n{context}\n
                     This is the chat history so far:\n{chat_history}\n"""


class RAGChainService:
    """Service for RAG-based question answering with streaming support"""

    _instance: Optional["RAGChainService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _format_docs(self, docs: List[Any]) -> str:
        """Format retrieved documents into a context string"""
        if not docs:
            return "No relevant context found."

        context_str = ""
        for doc in docs:
            source = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "?")
            source_info = f"{source} (Page {page})"

            content = doc.page_content.replace("\n", " ").strip()

            context_str += f"--- Zitat aus: {source_info} ---\n{content}\n\n"

        return context_str

    def _rerank_documents(self, question: str, docs: List[Any]) -> List[Any]:
        """Rerank documents based on relevance to the question"""
        if not docs:
            return docs

        # Extract document texts
        doc_texts = [doc.page_content for doc in docs]

        # Get reranked indices and scores
        ranked_indices = reranker_manager.rerank(question, doc_texts)

        # Reorder documents based on reranked indices
        reranked_docs = [docs[idx] for idx, _ in ranked_indices]

        return reranked_docs

    async def generate_response(self, question: str, chat_history: str = "") -> str:
        """Generate a complete response for a question"""
        if not self.is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        try:
            # Retrieve relevant documents
            docs = await vectorstore_manager.search(question, k=8)

            # Rerank documents if enabled
            if settings.ENABLE_RERANKING:
                docs = self._rerank_documents(question, docs)

            context = self._format_docs(docs)

            # Format the context
            full_context = CONTEXT_CHATBOT.format(
                context=context, chat_history=chat_history
            )

            # Generate response
            raw_response = await llm_manager.generate(
                context=full_context, question=question
            )
            cleaned_response = raw_response.strip()

            fallback_trigger = "Auf diese Frage habe ich leider keine Antwort"

            # Check if it starts with the trigger OR contains it in the first 100 chars
            if (
                cleaned_response.startswith(fallback_trigger)
                or fallback_trigger in cleaned_response[:100]
            ):

                logger.info("Fallback trigger detected. Overwriting response.")
                return "Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de."

            return cleaned_response

        except Exception as e:
            logger.error("Error in RAG generation: %s", e)
            return "Entschuldigung, es ist ein Fehler aufgetreten."

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Error generating response: %s", e)
            raise

    async def stream_response(
        self, question: str, chat_history: str = ""
    ) -> AsyncIterator[str]:
        """Stream the response token by token"""
        if not self.is_ready:
            raise RuntimeError("RAG Service not ready.")

        try:
            # 1. Retrieve & Format (Same as above)
            docs = await vectorstore_manager.search(question, k=8)

            # Rerank documents if enabled
            if settings.ENABLE_RERANKING:
                docs = self._rerank_documents(question, docs)

            context_str = self._format_docs(docs)

            # 2. Build Prompt
            full_context = CONTEXT_CHATBOT.format(
                context=context_str, chat_history=chat_history
            )

            fallback_trigger = "Auf diese Frage habe ich leider keine Antwort"
            fallback_msg = "Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de."

            buffer = ""
            check_complete = False

            # 3. Stream (Native LLM Stream)
            async for chunk in llm_manager.stream_generate(
                context=full_context, question=question
            ):
                if check_complete:
                    yield chunk
                    continue

                buffer += chunk

                # Check for 65 characters
                if len(buffer) > 65:
                    cleaned_buffer = buffer.strip()

                    # Found Trigger?
                    if (
                        cleaned_buffer.startswith(fallback_trigger)
                        or fallback_trigger in cleaned_buffer[:100]
                    ):
                        logger.info("Fallback trigger detected in stream. Overwriting.")
                        yield fallback_msg
                        return  # break stream
                    else:
                        yield buffer
                        check_complete = True

            # 4. Edge Case: Stream shorter than 65 chars
            if not check_complete and buffer:
                cleaned_buffer = buffer.strip()
                if (
                    cleaned_buffer.startswith(fallback_trigger)
                    or fallback_trigger in cleaned_buffer
                ):
                    yield fallback_msg
                else:
                    yield buffer

        except Exception as e:
            logger.error("Error in RAG streaming: %s", e)
            yield "Error in RAG streaming."

    async def get_relevant_documents(self, question: str) -> List[Any]:
        """Get relevant documents for a question (for debugging/inspection)"""
        if not self._is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        return await vectorstore_manager.search(question, k=8)

    @property
    def is_ready(self) -> bool:
        """Check if RAG chain service is ready"""
        return vectorstore_manager.is_loaded and llm_manager.is_loaded


# Singleton instance
rag_chain_service = RAGChainService()
