"""
Sanity check on vectorstore document lengths
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from config.settings import settings
from models.embedding_model import embedding_manager
from langchain_community.vectorstores import Chroma
from models.vectorstore import QueryOnlyEmbeddings


def main():
    print("Loading embedding model...")
    embedding_manager.load()
    embeddings = embedding_manager.get_embeddings()

    print(f"Loading vectorstore from: {settings.CHROMA_PERSIST_DIRECTORY}")
    vectorstore = Chroma(
        collection_name=settings.CHROMA_COLLECTION_NAME,
        embedding_function=QueryOnlyEmbeddings(embeddings),
        persist_directory=settings.CHROMA_PERSIST_DIRECTORY
    )

    # Get all documents from the collection
    collection = vectorstore._collection
    results = collection.get(include=["documents", "metadatas"])

    documents = results["documents"]
    total_docs = len(documents)

    print(f"\n{'='*60}")
    print(f"VECTORSTORE SANITY CHECK")
    print(f"{'='*60}")
    print(f"Total documents: {total_docs}")

    # Analyze document lengths
    lengths = [len(doc) if doc else 0 for doc in documents]

    # Define thresholds
    thresholds = [1, 10, 50, 100, 200, 300, 500, 1000, 2000]

    print(f"\n{'='*60}")
    print("DOCUMENT LENGTH DISTRIBUTION")
    print(f"{'='*60}")

    # Count documents at each threshold
    prev_threshold = 0
    for threshold in thresholds:
        count = sum(1 for l in lengths if prev_threshold < l <= threshold)
        pct = (count / total_docs * 100) if total_docs > 0 else 0
        print(f"  {prev_threshold+1:>4} - {threshold:>4} chars: {count:>5} docs ({pct:>5.1f}%)")
        prev_threshold = threshold

    # Count documents larger than last threshold
    count = sum(1 for l in lengths if l > thresholds[-1])
    pct = (count / total_docs * 100) if total_docs > 0 else 0
    print(f"  {thresholds[-1]+1:>4}+       chars: {count:>5} docs ({pct:>5.1f}%)")

    # Special counts
    print(f"\n{'='*60}")
    print("SPECIAL COUNTS")
    print(f"{'='*60}")

    empty_docs = sum(1 for l in lengths if l == 0)
    one_char = sum(1 for l in lengths if l == 1)
    under_10 = sum(1 for l in lengths if l < 10)
    under_50 = sum(1 for l in lengths if l < 50)
    under_100 = sum(1 for l in lengths if l < 100)

    print(f"  Empty (0 chars):    {empty_docs:>5} docs ({empty_docs/total_docs*100:.1f}%)")
    print(f"  Exactly 1 char:     {one_char:>5} docs ({one_char/total_docs*100:.1f}%)")
    print(f"  Under 10 chars:     {under_10:>5} docs ({under_10/total_docs*100:.1f}%)")
    print(f"  Under 50 chars:     {under_50:>5} docs ({under_50/total_docs*100:.1f}%)")
    print(f"  Under 100 chars:    {under_100:>5} docs ({under_100/total_docs*100:.1f}%)")

    # Statistics
    print(f"\n{'='*60}")
    print("STATISTICS")
    print(f"{'='*60}")

    if lengths:
        print(f"  Min length:    {min(lengths):>6} chars")
        print(f"  Max length:    {max(lengths):>6} chars")
        print(f"  Avg length:    {sum(lengths)/len(lengths):>6.1f} chars")

        sorted_lengths = sorted(lengths)
        median = sorted_lengths[len(sorted_lengths)//2]
        print(f"  Median length: {median:>6} chars")

    # Show sample of problematic documents
    print(f"\n{'='*60}")
    print("SAMPLE OF SHORT DOCUMENTS (< 10 chars)")
    print(f"{'='*60}")

    short_docs = [(i, doc, len(doc)) for i, doc in enumerate(documents) if doc and len(doc) < 10]
    for i, (idx, doc, length) in enumerate(short_docs[:20]):
        # Escape and show the content
        escaped = repr(doc)
        print(f"  [{idx}] ({length} chars): {escaped}")

    if len(short_docs) > 20:
        print(f"  ... and {len(short_docs) - 20} more short documents")


if __name__ == "__main__":
    main()
