"""
Clean vectorstore by removing short/useless documents
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from config.settings import settings
from models.embedding_model import embedding_manager
from langchain_community.vectorstores import Chroma
from models.vectorstore import QueryOnlyEmbeddings


def main():
    MIN_LENGTH = 50  # Minimum document length to keep

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
    results = collection.get(include=["documents"])

    documents = results["documents"]
    ids = results["ids"]
    total_docs = len(documents)

    print(f"\nTotal documents: {total_docs}")

    # Find documents to delete
    ids_to_delete = []
    for doc_id, doc in zip(ids, documents):
        if doc is None or len(doc.strip()) < MIN_LENGTH:
            ids_to_delete.append(doc_id)

    print(f"Documents under {MIN_LENGTH} chars: {len(ids_to_delete)}")

    if not ids_to_delete:
        print("No documents to delete!")
        return

    # Show what will be deleted
    print(f"\nDocuments to delete:")
    for i, doc_id in enumerate(ids_to_delete[:10]):
        idx = ids.index(doc_id)
        doc = documents[idx]
        print(f"  [{doc_id}] ({len(doc)} chars): {repr(doc[:50])}")

    if len(ids_to_delete) > 10:
        print(f"  ... and {len(ids_to_delete) - 10} more")

    # Confirm deletion
    response = input(f"\nDelete {len(ids_to_delete)} documents? (yes/no): ")

    if response.lower() == "yes":
        print("Deleting documents...")
        collection.delete(ids=ids_to_delete)
        print(f"✓ Deleted {len(ids_to_delete)} documents")
        print(f"Remaining documents: {total_docs - len(ids_to_delete)}")
    else:
        print("Aborted.")


if __name__ == "__main__":
    main()
