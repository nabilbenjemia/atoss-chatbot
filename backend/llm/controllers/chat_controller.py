"""
Chat Controller
Handles chat-related API requests
"""
import logging
from typing import Optional, List
from pydantic import BaseModel, Field

from services.rag_chain_service import rag_chain_service
from services.startup_service import startup_service

logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    """Schema for a chat message"""
    role: str = Field(..., description="Role of the message sender (user/assistant)")
    content: str = Field(..., description="Content of the message")


class ChatRequest(BaseModel):
    """Schema for chat request"""
    message: str = Field(..., description="User's message/question")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=[], description="Previous messages in the conversation"
    )


class ChatResponse(BaseModel):
    """Schema for chat response"""
    response: str = Field(..., description="AI's response")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    sources: Optional[List[dict]] = Field(default=[], description="Source documents used")


class StatusResponse(BaseModel):
    """Schema for status response"""
    status: str
    is_loaded: bool
    components: dict
    message: str


class ChatController:
    """Controller for chat operations"""

    def get_status(self) -> StatusResponse:
        """Get the current status of the LLM service"""
        status = startup_service.get_status()

        if status["is_loaded"]:
            message = "LLM service is ready"
            status_str = "ready"
        else:
            message = "LLM service is loading or not initialized"
            status_str = "loading"

        return StatusResponse(
            status=status_str,
            is_loaded=status["is_loaded"],
            components=status["components"],
            message=message
        )

    async def generate_response(self, request: ChatRequest) -> ChatResponse:
        """Generate a complete response for a chat request"""
        if not startup_service.is_loaded:
            raise RuntimeError("LLM service is not ready. Please wait for initialization.")

        try:
            # Convert conversation history to format expected by service
            history = []
            if request.conversation_history:
                history = [
                    {"role": msg.role, "content": msg.content}
                    for msg in request.conversation_history
                ]

            # Generate response
            response = await rag_chain_service.generate_response(
                question=request.message
            )

            # Get source documents for reference
            docs = await rag_chain_service.get_relevant_documents(request.message)
            sources = [
                {"source": doc.metadata.get("source", "Unknown"), "content": doc.page_content[:200]}
                for doc in docs
            ]

            return ChatResponse(
                response=response,
                conversation_id=request.conversation_id,
                sources=sources
            )

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Error generating response: %s", e)
            raise

    async def stream_response(self, request: ChatRequest):
        """Stream a response for a chat request"""
        if not startup_service.is_loaded:
            raise RuntimeError("LLM service is not ready. Please wait for initialization.")

        try:
            # Convert conversation history
            history = []
            if request.conversation_history:
                history = [
                    {"role": msg.role, "content": msg.content}
                    for msg in request.conversation_history
                ]

            # Stream response
            async for chunk in rag_chain_service.stream_response(
                question=request.message
            ):
                yield chunk

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Error streaming response: %s", e)
            raise


# Singleton instance
chat_controller = ChatController()
