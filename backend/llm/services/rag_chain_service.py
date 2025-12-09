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

# RAG Prompt Template (German)
RAG_PROMPT_TEMPLATE = """Du bist ein hilfreicher KI-Assistent für ATOSS Workforce Management Lösungen.
Deine Hauptaufgabe ist es, technische oder systemnahe Informationen aus dem internen Handbuch so umzuformulieren,
dass sie für **Mitarbeiter, Teamleiter oder Planer** leicht verständlich und handlungsorientiert sind.

Nutze den folgenden Kontext, um die Frage des Benutzers zu beantworten. Der Kontext stammt aus dem offiziellen ATOSS-Handbuch.
Wenn du Informationen aus dem Kontext verwendest, **zitiere die genaue Passage wörtlich** (als direktes Zitat),
damit der Benutzer diese im PDF-Manual nachprüfen kann. Gib nach dem Zitat deine benutzerfreundliche Erklärung oder Anleitung.

Chat-Verlauf:
{chat_history}

Kontext:
{context}

Frage: {user_question}

Anweisungen:
- Gib eine **klare, praxisnahe Antwort** – idealerweise als Schritt-für-Schritt-Anleitung.
- **Zitiere wörtlich**, sobald du Inhalte aus dem Kontext nutzt. Beispiel:
  > „Nach 6 Stunden erfolgt ein Pausenabzug von 30 Minuten, nach 9 Stunden werden weitere 15 Minuten abgezogen.“
  Das bedeutet: …
- Vermeide technische Begriffe wie „Flag“, „Dialog V XXX“, „Schichtzyklus-ID“, es sei denn, die Frage zielt explizit darauf ab.
- Falls der Kontext **keine relevanten Informationen** zur Frage enthält, antworte **nicht mit Spekulation**, sondern mit:
  **„Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an Ihre Personalabteilung oder den internen ATOSS-Support.“**
- Sei professionell, freundlich und richte dich an Endanwender – nicht an Systemadministratoren.
- Wenn mehrere Abschnitte im Kontext relevant sind, zitiere jeweils den passenden Teil.

Antwort:"""


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

    async def generate_response(self, question: str, chat_history: str = "") -> str:
        """Generate a complete response for a question"""
        if not self._is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        try:
            # Retrieve relevant documents
            docs = await retriever_service.retrieve(question)
            context = self._format_docs(docs)

            # Format the prompt
            prompt_text = self._prompt.format(
                context=context,
                user_question=question,
                chat_history=chat_history
            )

            # Generate response
            llm = llm_manager.get_llm()
            response = await llm.ainvoke(prompt_text)

            if isinstance(response.content, str):
                return response.content
            return str(response.content)

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Error generating response: %s", e)
            raise

    async def stream_response(self, question: str, chat_history: str = "") -> AsyncIterator[str]:
        """Stream a response for a question"""
        if not self._is_ready:
            raise RuntimeError(ERROR_RAG_NOT_INITIALIZED)

        try:
            # Retrieve relevant documents (same as generate_response)
            docs = await retriever_service.retrieve(question)
            context = self._format_docs(docs)

            # Format the prompt
            prompt_text = self._prompt.format(
                context=context,
                user_question=question,
                chat_history=chat_history
            )

            # Stream the response directly
            llm = llm_manager.get_streaming_llm()
            async for chunk in llm.astream(prompt_text):
                if hasattr(chunk, 'content'):
                    content = chunk.content
                    if isinstance(content, str):
                        yield content
                    elif isinstance(content, list):
                        # Handle list of content blocks
                        for item in content:
                            if isinstance(item, str):
                                yield item
                            elif isinstance(item, dict) and 'text' in item:
                                yield str(item['text'])
                else:
                    yield str(chunk)

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
