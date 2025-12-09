"""
Test to identify why specific queries cause slow reranking
"""
import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from config.settings import settings
from services.startup_service import startup_service
from services.retriever_service import retriever_service


async def test_query(query: str, run_number: int):
    """Test a single query and time it"""
    print(f"\n--- Run {run_number}: '{query}' ---")
    start = time.perf_counter()
    docs = await retriever_service.retrieve(query)
    elapsed = time.perf_counter() - start
    print(f"Total time: {elapsed:.3f} seconds, got {len(docs)} docs")
    return elapsed


async def main():
    print("Initializing services...")
    await startup_service.initialize_all()
    print("Services initialized!\n")

    queries = [
        "What is ASES?",
        "How do I configure time management?",
        "Can you tell me more about its features?",
    ]

    # Run each query multiple times to see if it's first-call or query-specific
    print("=" * 60)
    print("TEST 1: Run each query once in order")
    print("=" * 60)
    for i, q in enumerate(queries, 1):
        await test_query(q, i)

    print("\n" + "=" * 60)
    print("TEST 2: Run the slow query 3 times consecutively")
    print("=" * 60)
    slow_query = "How do I configure time management?"
    for i in range(1, 4):
        await test_query(slow_query, i)

    print("\n" + "=" * 60)
    print("TEST 3: Run queries in different order")
    print("=" * 60)
    # Run slow query first this time
    await test_query("How do I configure time management?", 1)
    await test_query("What is ASES?", 2)
    await test_query("Can you tell me more about its features?", 3)


if __name__ == "__main__":
    asyncio.run(main())
