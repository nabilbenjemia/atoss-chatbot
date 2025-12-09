"""
Deep dive into why specific query is slow
"""
import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from config.settings import settings
from services.startup_service import startup_service
from models.vectorstore import vectorstore_manager
from models.reranker_model import reranker_manager


async def main():
    print("Initializing services...")
    await startup_service.initialize_all()
    print("Services initialized!\n")

    queries = [
        "What is ASES?",
        "How do I configure time management?",
    ]

    for query in queries:
        print("=" * 60)
        print(f"Query: {query}")
        print("=" * 60)

        # Step 1: Vector search
        print("\n1. Vector search timing:")
        start = time.perf_counter()
        docs = vectorstore_manager.similarity_search(query, k=settings.RETRIEVER_K)
        elapsed = time.perf_counter() - start
        print(f"   Vector search took: {elapsed:.3f} seconds, got {len(docs)} docs")

        # Step 2: Analyze document lengths
        print("\n2. Document lengths:")
        total_chars = 0
        for i, doc in enumerate(docs):
            doc_len = len(doc.page_content)
            total_chars += doc_len
            print(f"   Doc {i+1}: {doc_len} chars")
        print(f"   Total: {total_chars} chars")

        # Step 3: Test reranker directly
        print("\n3. Reranker timing:")
        model = reranker_manager.get_model()
        doc_texts = [doc.page_content for doc in docs]

        start = time.perf_counter()
        results = model.rerank(query, doc_texts, top_n=5)
        elapsed = time.perf_counter() - start
        print(f"   Rerank took: {elapsed:.3f} seconds")

        print()


if __name__ == "__main__":
    asyncio.run(main())
