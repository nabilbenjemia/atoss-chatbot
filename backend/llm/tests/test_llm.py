"""
Simple test script for LLM service
Tests both generate and stream responses
"""
import asyncio
import sys
import os
import logging

# Add the llm directory to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# Configure logging to both console and file
log_file = os.path.join(os.path.dirname(__file__), "test_llm.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, mode='w')
    ]
)
logger = logging.getLogger(__name__)
logger.info(f"Logging to file: {log_file}")

from config.settings import settings
from services.startup_service import startup_service
from services.rag_chain_service import rag_chain_service


async def test_generate_response():
    """Test non-streaming response generation"""
    print("\n" + "=" * 50)
    print("TEST: Generate Response (non-streaming)")
    print("=" * 50)

    question = "What is ASES?"
    print(f"\nQuestion: {question}")
    print("\nGenerating response...")

    try:
        response = await rag_chain_service.generate_response(
            question=question,
            chat_history=""
        )
        print(f"\nResponse:\n{response}")
        print("\n✓ Generate response test PASSED")
        return True
    except Exception as e:
        print(f"\n✗ Generate response test FAILED: {e}")
        return False


async def test_stream_response():
    """Test streaming response generation"""
    print("\n" + "=" * 50)
    print("TEST: Stream Response")
    print("=" * 50)

    question = "How do I configure time management?"
    print(f"\nQuestion: {question}")
    print("\nStreaming response:")
    print("-" * 30)

    try:
        full_response = ""
        async for chunk in rag_chain_service.stream_response(
            question=question,
            chat_history=""
        ):
            print(chunk, end="", flush=True)
            full_response += chunk

        print("\n" + "-" * 30)
        print(f"\nTotal characters received: {len(full_response)}")
        print("\n✓ Stream response test PASSED")
        return True
    except Exception as e:
        print(f"\n✗ Stream response test FAILED: {e}")
        return False


async def test_with_chat_history():
    """Test response with chat history context"""
    print("\n" + "=" * 50)
    print("TEST: Response with Chat History")
    print("=" * 50)

    chat_history = "user: What is ASES?\nassistant: ASES is the ATOSS Staff Efficiency Suite."
    question = "Can you tell me more about its features?"

    print(f"\nChat History:\n{chat_history}")
    print(f"\nFollow-up Question: {question}")
    print("\nStreaming response:")
    print("-" * 30)

    try:
        full_response = ""
        async for chunk in rag_chain_service.stream_response(
            question=question,
            chat_history=chat_history
        ):
            print(chunk, end="", flush=True)
            full_response += chunk

        print("\n" + "-" * 30)
        print("\n✓ Chat history test PASSED")
        return True
    except Exception as e:
        print(f"\n✗ Chat history test FAILED: {e}")
        return False


async def main():
    """Run all tests"""
    print("=" * 50)
    print("LLM SERVICE TEST")
    print("=" * 50)
    print(f"\nConfiguration:")
    print(f"  - Ollama URL: {settings.OLLAMA_BASE_URL}")
    print(f"  - Model: {settings.OLLAMA_MODEL}")
    print(f"  - Embedding: {settings.EMBEDDING_MODEL}")
    print(f"  - ChromaDB: {settings.CHROMA_PERSIST_DIRECTORY}")

    # Initialize services
    print("\n" + "=" * 50)
    print("Initializing services...")
    print("=" * 50)

    try:
        await startup_service.initialize_all()
        print("✓ All services initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize services: {e}")
        return    # Run tests
    results = []

    results.append(("Generate Response", await test_generate_response()))
    results.append(("Stream Response", await test_stream_response()))
    results.append(("Chat History", await test_with_chat_history()))

    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"  {name}: {status}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️ Some tests failed")


if __name__ == "__main__":
    asyncio.run(main())
