"""
Benchmark Script for LLM RAG System
Generates a CSV with test queries, responses, and all configuration settings
"""
import asyncio
import csv
import sys
import os
from datetime import datetime
from typing import List, Dict, Any

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from config.settings import settings
from services.startup_service import startup_service
from services.rag_chain_service import rag_chain_service


# Test queries in German
TEST_QUERIES = [
    "Wie beantrage ich Urlaub / Freizeitausgleich?",
    "Wie erstelle oder ändere ich einen Dienstplan?",
    "Was ist bei Schichtzuschlägen / Pausenregelungen zu beachten?",
    "Wofür stehen die Abkürzungen PLAN und MPDATA?",
    "Welchem Funktionsbereich ist der Dialog 'Korrektur von Kontierungen' (CRCOST) zugeordnet und welche Hauptaufgabe erfüllt er?",
    "Welche Exportformate sind standardmäßig für das Drucken von Reports freigegeben und wie verhält es sich mit den übrigen Formaten?",
    "Wie heißt Spongebobs bester Freund?",  # Out-of-domain test
]


def get_settings_dict() -> Dict[str, Any]:
    """Extract all settings as a dictionary"""
    return {
        # Ollama Configuration
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "ollama_temperature": settings.OLLAMA_TEMPERATURE,
        "ollama_top_p": settings.OLLAMA_TOP_P,
        "ollama_num_ctx": settings.OLLAMA_NUM_CTX,
        # Embedding Configuration
        "embedding_model": settings.EMBEDDING_MODEL,
        "embedding_device": settings.EMBEDDING_DEVICE,
        # ChromaDB Configuration
        "chroma_persist_directory": settings.CHROMA_PERSIST_DIRECTORY,
        "chroma_collection_name": settings.CHROMA_COLLECTION_NAME,
        # Reranker Configuration
        "reranker_model": settings.RERANKER_MODEL,
        "reranker_top_k": settings.RERANKER_TOP_K,
        "reranker_max_chars_per_doc": settings.RERANKER_MAX_CHARS_PER_DOC,
        # Retrieval Configuration
        "retriever_k": settings.RETRIEVER_K,
        # RAG Configuration
        "max_context_length": settings.MAX_CONTEXT_LENGTH,
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP,
    }


async def run_benchmark() -> List[Dict[str, Any]]:
    """Run benchmark on all test queries"""
    results = []
    settings_dict = get_settings_dict()

    print("=" * 60)
    print("LLM RAG BENCHMARK")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Model: {settings.OLLAMA_MODEL}")
    print(f"Queries to test: {len(TEST_QUERIES)}")
    print("=" * 60)

    # Initialize services
    print("\nInitializing services...")
    await startup_service.initialize_all()
    print("✓ Services initialized\n")

    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"\n[{i}/{len(TEST_QUERIES)}] Testing: {query[:50]}...")

        start_time = datetime.now()

        try:
            # Generate response
            response = await rag_chain_service.generate_response(
                question=query,
                chat_history=""
            )

            end_time = datetime.now()
            duration_ms = (end_time - start_time).total_seconds() * 1000

            print(f"    ✓ Response generated in {duration_ms:.0f}ms")
            print(f"    Preview: {response[:100]}...")

            # Build result row
            result = {
                "timestamp": start_time.isoformat(),
                "query": query,
                "response": response,
                "duration_ms": round(duration_ms, 2),
                "status": "success",
                "error": "",
                **settings_dict
            }

        except Exception as e:
            end_time = datetime.now()
            duration_ms = (end_time - start_time).total_seconds() * 1000

            print(f"    ✗ Error: {e}")

            result = {
                "timestamp": start_time.isoformat(),
                "query": query,
                "response": "",
                "duration_ms": round(duration_ms, 2),
                "status": "error",
                "error": str(e),
                **settings_dict
            }

        results.append(result)

    return results


def save_to_csv(results: List[Dict[str, Any]], filename: str):
    """Save results to CSV file"""
    if not results:
        print("No results to save!")
        return

    # Get all column names from first result
    fieldnames = list(results[0].keys())

    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✓ Results saved to: {filename}")


async def main():
    """Main entry point"""
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(os.path.dirname(__file__), f"results_{timestamp}.csv")

    try:
        results = await run_benchmark()
        save_to_csv(results, output_file)

        # Print summary
        print("\n" + "=" * 60)
        print("BENCHMARK SUMMARY")
        print("=" * 60)

        success_count = sum(1 for r in results if r["status"] == "success")
        total_count = len(results)
        avg_duration = sum(r["duration_ms"] for r in results) / total_count if total_count > 0 else 0

        print(f"Total queries: {total_count}")
        print(f"Successful: {success_count}")
        print(f"Failed: {total_count - success_count}")
        print(f"Average duration: {avg_duration:.0f}ms")
        print(f"Output file: {output_file}")

    except Exception as e:
        print(f"\n✗ Benchmark failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
