"""
Benchmark Script for LLM RAG System

Tests LLM models (qwen2.5:7b-instruct-q4_0) with real HR/workforce management queries
using Snowflake embeddings and ChromaDB retrieval. Generates comprehensive benchmark
reports with response quality metrics and similarity scores.

Output: Excel file with query, expected answer, generated answer, latency, and similarity.
"""

import time
import gc
import os
import chromadb
import pandas as pd
import ollama
from sentence_transformers import SentenceTransformer, util

# ============================================================================
# CONFIGURATION SECTION
# ============================================================================

# ChromaDB Configuration
DB_PATH = "./resources/chroma_db/chroma_db_snowflake_600chunks_300overlapping"
COLLECTION_NAME = "tum_docs"

# Embedding Model (Snowflake Arctic - optimized for multilingual/German text)
EMBEDDING_MODEL = SentenceTransformer(
    "Snowflake/snowflake-arctic-embed-l-v2.0", device="cpu"
)

# LLM Models to benchmark
MODELS = [
    "qwen2.5:7b-instruct-q4_0",  # Production model
]

# LLM Response Configuration
LLM_CONFIG = {
    "num_ctx": 5000,  # Context window
    "temperature": 0.3,  # Balanced creativity
    "repeat_penalty": 1.2,  # Reduce hallucinations
    "num_predict": 500,  # Max tokens to generate
}

# ============================================================================
# TEST DATA: QUESTIONS & EXPECTED ANSWERS
# ============================================================================

"""QUESTIONS = [
    "Wie entscheidet das System, welcher Feiertag gilt, wenn im automatischen Kalender zwei definierte Sondertage auf genau das gleiche Datum fallen?",
    "Welche Platzhalter können bei der Konfiguration von Berechtigungen für Personaldienstleister verwendet werden und wofür stehen sie?",
    "Was passiert technisch im Hintergrund, wenn im Dialog 'Automatischer Kalender' ein Datum in das Feld 'Kalender ändern ab' eingetragen und gespeichert wird?",
    "Wie beantrage ich Urlaub / Freizeitausgleich?",
    "Wie erstelle oder ändere ich einen Dienstplan?",
    "Was ist bei Schichtzuschlägen / Pausenregelungen zu beachten?",
]"""
"""QUESTIONS = [
    "Wie beantrage ich Urlaub / Freizeitausgleich?",
    "Wie erstelle oder ändere ich einen Dienstplan?",
    "Was ist bei Schichtzuschlägen / Pausenregelungen zu beachten?",
    "Wofür stehen die Abkürzungen PLAN und MPDATA?",
    "Welchem Funktionsbereich ist der Dialog 'Korrektur von Kontierungen' (CRCOST) zugeordnet und welche Hauptaufgabe erfüllt er?",
    "Welche Exportformate sind standardmäßig für das Drucken von Reports freigegeben und wie verhält es sich mit den übrigen Formaten?",
    "Wie heißt Spongebobs bester Freund?",
]"""

"""EXPECTED_ANSWERS = [
    "Das System nutzt die Spalte Nr. (Zahl) zur Priorisierung. Es gewinnt der Tag mit der niedrigsten Nummer. Eine Ausnahme sind Tage, die über die Funktion 'Ausnahme' definiert wurden; diese haben immer die höchste Priorität, unabhängig von der Nummerierung",
    "Es können die Matchcodes '?' (für ein beliebiges Zeichen) und '*' (für mehrere Zeichen) verwendet werden",
    "Es werden die Sondertage für die nächsten 15 Jahre ab diesem Datum berechnet und in die einzelnen Kalendersätze eingetragen",
]"""

"""EXPECTED_ANSWERS = [
    "Melden Sie sich im Staff Center an → Menüpunkt „Abwesenheiten“ → Button „Neue Abwesenheit“ → Art der Abwesenheit auswählen (z. B. „Urlaub“) → Zeitraum eingeben → Kommentar eingeben → Absenden. Sie erhalten eine Bestätigung oder Ablehnung über das System.",
    "Im Expert Interface Web (EIW) den Menüpunkt „Dienstplan“ → gewünschten Dienstplan und Zeitraum öffnen → Mitarbeiter auswählen → Schichten per Drag & Drop einfügen oder ändern → Speichern nicht vergessen",
    "Zuschläge (z. B. Nacht, Feiertag) werden automatisch berechnet. Pausen werden automatisch berechnet und hinterlegt. Nach 6 Stunden erfolgt ein Pausenabzug von 30 Minuten, nach 9 Stunden werden weitere 15 Minuten abgezogen. Längere Pausen sollen durch den Mitarbeiter im StaffCenter hinterlegt werden.",
    "'PLAN' steht für Planungen und 'MPDATA' steht für Tageskorrekturen",
    "Der Dialog gehört zum Kostenstellenmanagement. Er dient dazu, die für einen Mitarbeiter an einem bestimmten Tag gesammelten Informationen zur Kostenstellenzuordnung anzuzeigen und zu korrigieren. Dazu zählen insbesondere die Kontierung des Tages, Kostenstellen-Buchungen sowie Lohnarten-Korrekturen.",
    "Standardmäßig ist der Export in die Formate HTML, PDF und RTF erlaubt (Wert: 'ja'), wobei HTML nur im Expert Interface (Web) genutzt werden kann. Alle anderen Formate – darunter CSV, DOCX, PowerPoint, TXT, XML sowie Excel-Formate (XLS/XLSX) – sind standardmäßig gesperrt (Wert: 'nein') und müssen explizit für den Benutzer freigegeben werden.",
    "Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an jessica.diehlmann@mri.tum.de.",
]"""

QUESTIONS = [
    "Wie erstelle oder ändere ich einen Dienstplan?",
    "Wie kann ich Schichten tauschen oder verschieben?",
    "Welche gesetzlichen Regelungen werden abgebildet?",
    "Wie prüfe ich Qualifikationsanforderungen?",
    "Wie hinterlege ich Urlaub oder Fehlzeiten?",
    "Wie gehe ich mit Warnmeldungen bei der Dienstplanung um?",
    "Wie bilde ich verschiedene Arbeitszeitmodelle ab?",
    "Wie verwalte ich Zeitkonten oder korrigiere fehlerhafte Buchungen?",
    "Was ist bei Schichtzuschlägen / Pausenregelungen zu beachten? ",
    "Wie kann ich neue Mitarbeiter anlegen oder Daten pflegen?",
    "Wie erfolgt die Datenübergabe an Lohnabrechnungssysteme?",
    "Wie beantrage ich Urlaub / Freizeitausgleich?",
    "Wo sehe ich mein aktuelles Zeitkonto / Plus- und Minusstunden?",
    "Warum wurde mein Antrag auf Urlaub abgelehnt?",
    "Wie erfasse ich eine Krankmeldung im System?",
    "Was bedeuten die verschiedenen Symbole oder Farben im Dienstplan?",
    "Wie kann ich meine persönlichen Daten ändern?",
    "Wie erfahre ich, ob mein Antrag genehmigt wurde?",
    "Was kann ich tun, wenn mein Zeitkonto nicht korrekt erscheint?",
]

EXPECTED_ANSWERS = [
    "Im Expert Interface Web (EIW) den Menüpunkt „Dienstplan“ → gewünschten Dienstplan und Zeitraum öffnen → Mitarbeiter auswählen → Schichten per Drag & Drop einfügen oder ändern → Speichern nicht vergessen.",
    "Entweder manuell per Drag & Drop oder durch manuelles Einfügen.",
    "Alle gesetzlichen und tariflichen Regelungen wie Pausenregelungen, Höchstarbeitszeiten, Ruhezeiten, Feiertagsregelungen etc. sind in den entsprechenden Grundeinstellungen im System hinterlegt.",
    "Im Planungsmodul: Fehlermeldungen oder Hinweise (z.B. „fehlende Qualifikation“) erscheinen, wenn Mitarbeitende ohne passende Qualifikation einer Schicht zugewiesen werden. Über den Menüpunkt „Qualifikationen“ können die hinterlegten Qualifikationen pro Mitarbeiter geprüft werden. Sollte hier eine gehaltsrelevante Qualifikation fehlen wenden Sie sich bitte an die Personalabteilung. Alle Soft-Qualifikationen können Sie selbstständig hinterlegen.",
    "Urlaub und Freizeitausgleich wird über den Mitarbeiter per StaffCenter beantragt. Der ausgelöste Workflow ersetzt den Papierantrag („Gelber Zettel“). Im Mitarbeiterkalender oder Dienstplan können spezifische Abwesenheit für den Mitarbeiter hinterlegt werden.",
    "Warnungen zeigen Regelverstöße oder Unstimmigkeiten (z.B. Verletzung Ruhezeit). Überprüfen → ggf. korrigieren oder kommentieren.",
    "Änderungen können nur durch den GB Personal oder das Admin-Team vorgenommen werden. Hierfür wenden Sie sich bitte an den GB Personal oder an ATOSS.pa@mri.tum.de.",
    "Fehlerhafte Buchungen können durch den Mitarbeiter im StaffCenter selbstständig angepasst werden, was den notwendigen Genehmigungsworkflow auslöst. Unter „Tageskorrekturen“ kann durch die Führungskraft im Ausnahmefall eine manuelle Anpassung erfolgen. Hierbei wird keine Information an den Mitarbeiter versendet.",
    "Zuschläge (z.B. Nacht, Feiertag) werden automatisch berechnet. Pausen werden automatisch berechnet und hinterlegt. Nach 6 Stunden erfolgt ein Pausenabzug von 30 Minuten, nach 9 Stunden werden weitere 15 Minuten abgezogen. Längere Pausen sollen durch den Mitarbeiter im StaffCenter hinterlegt werden.",
    "Neue Mitarbeiter werden im führenden Stammdatensystem SAP HCM durch den GB Personal gepflegt und über eine Schnittstelle übergeben. Sollte ein Mitarbeiter nicht in ATOSS hinterlegt sein, wenden Sie sich bitte an den GB Personal.",
    "Über eine SAP-Schnittstelle.",
    "Melden Sie sich im Staff Center an → Menüpunkt „Abwesenheiten“ → Button „Neue Abwesenheit“ → Art der Abwesenheit auswählen (z.B. „Urlaub“) → Zeitraum eingeben → Kommentar eingeben → Absenden. Sie erhalten eine Bestätigung oder Ablehnung über das System.",
    "Im Dashboard (StaffCenter) oder unter „Saldenübersicht“ finden Sie Ihren aktuellen Saldo.",
    "Gründe können zum Beispiel Personalmangel oder Überschneidung mit anderen Abwesenheiten sein. Die genaue Begründung steht im Antrag oder kann bei Ihrer zuständigen Führungskraft angefragt werden.",
    "Ein digitaler Krankmeldungsprozess wird derzeit noch nicht über das StaffCenter abgebildet. Melden Sie sich bitte telefonisch oder entsprechend des intern gängigen Prozesses krank. Sobald Ihre Führungskraft die Krankmeldung im System hinterlegt hat, können Sie selbstständig hinterlegen, ob Sie ohne Attest, mit eAU oder Kindkrank sind/waren, sowie den genauen Zeitraum Ihrer Krankheit.",
    "Farben stehen meist für verschiedene Schichtarten oder Abwesenheiten. Die Legende befindet sich oft unterhalb oder seitlich des Dienstplans. Bei Unsicherheit bitte bei Ihrer Führungskraft nachfragen.",
    "Ihre Daten können nur durch das Admin-Team oder direkt von der Personalabteilung geändert werden. Bitte wenden Sie sich diesbezüglich an Ihren entsprechenden Ansprechpartner oder an ATOSS.pa@mri.tum.de .",
    "Sie bekommen in der Regel eine Benachrichtigung im System oder per E-Mail. Alternativ können Sie unter „Abwesenheiten“ den Status Ihres Antrags prüfen (Genehmigt / Offen / Abgelehnt).",
    "Bitte überprüfen Sie zunächst Ihre Buchungen: Wurden alle Kommen-/Gehen-Zeiten erfasst? Fehlzeiten oder Sonderregelungen korrekt eingetragen? Wenn weiterhin Unklarheiten bestehen, nehmen Sie bitte Kontakt zu Ihrer Führungskraft auf. Die Personalabteilung und das Admin-Team stehen bei Rückfragen ebenfalls zur Verfügung (ATOSS.pa@mri.tum.de). ",
]


def retrieve_context(query, collection, embed_model=EMBEDDING_MODEL):
    """
    Retrieve relevant context from ChromaDB using semantic similarity.

    Args:
        query: User question to search for
        collection: ChromaDB collection instance
        embed_model: SentenceTransformer model for embeddings

    Returns:
        tuple: (context_string, list_of_sources)
    """
    # 1. Embed the query using Snowflake embedding model
    query_embed = embed_model.encode([query], prompt_name="query").tolist()[0]
    gc.collect()

    # 2. Search ChromaDB for k=8 most similar documents
    results = collection.query(query_embeddings=[query_embed], n_results=8)

    context_str = ""
    sources = []

    # 3. Format Results
    if results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            source_info = f"{meta['source']} (Page {meta['page']})"
            sources.append(source_info)
            context_str += f"--- Zitat aus: {source_info} ---\n{doc}\n"

    return context_str, list(set(sources))


def load_database():
    """Load ChromaDB and return collection."""
    try:
        client = chromadb.PersistentClient(path=DB_PATH)
        collection = client.get_collection(COLLECTION_NAME)
        print(
            f"✅ ChromaDB loaded: '{COLLECTION_NAME}' with {collection.count()} chunks."
        )
        return collection
    except Exception as e:
        print(f"❌ Error loading database: {e}")
        print("   ➜ Did you run the ingestion script first?")
        return None


def run_benchmark():
    """Execute benchmark tests across configured models and questions."""
    benchmark_data = []

    collection = load_database()
    if collection is None:
        return {}, []

    # 2. Run the Battle
    print(f"{'Model':<25} | {'Questions':<10} | {'Status'}")
    print("-" * 60)
    dict_time = {
        # "phi3.5": [],
        # "llama3.1:8b-instruct-q4_0": [],
        "qwen2.5:7b-instruct-q4_0": [],
        # "sam860/LFM2:1.2b": [],
        # "mistral-nemo": [],
    }

    for model in MODELS:
        print(f"Testing {model}...")

        for i, (q, expected) in enumerate(zip(QUESTIONS, EXPECTED_ANSWERS)):
            try:
                rag_context, sources = retrieve_context(query=q, collection=collection)
                start = time.time()
                # The Actual RAG Call
                response = ollama.chat(
                    model=model,
                    messages=[
                        {
                            "role": "system",
                            # "content": "You are a helpful assistant for the TUM University Hospital. ANSWER ONLY WITHIN THE CONTEXT PROVIDED AND IN GERMAN ONLY! Do not add information not in the context. Keep your answers simple and concise. INCLUDE THE PAGE NUMBER AND THE SOURCE AT THE END OF YOUR REPLY IN GERMAN e.g. (Seite 8 in Beispiel.pdf). If you don't know the answer or can not answer the question concise, REPLY EXACTLY AND ONLY: 'Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an jessica.diehlmann@mri.tum.de'.",
                            "content": (
                                "You are an expert support assistant for the TUM University Hospital. "
                                "Your task is to answer user questions precisely based on the provided documents.\n"
                                "RULES:\n"
                                "1. ANSWER IN GERMAN ONLY.\n"
                                "2. USE ONLY the provided context.\n"
                                "3. FOLLOW STRICTLY ONE OF THESE TWO CASES:\n"
                                "   CASE A (Answer NOT found): If the context does not contain the answer, output EXACTLY this string and NOTHING else:\n"
                                "   'Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de'\n"
                                "   (STOP writing immediately after this sentence. Do NOT add any citations or page numbers in CASE A.)\n\n"
                                "   CASE B (Answer found): If the context contains the answer, provide a concise German answer first.\n"
                                "   Structure your response EXACTLY in this order:\n"
                                "   1. The Answer text.\n"
                                "   2. Two newlines.\n"
                                "   3. The Source at the very bottom.\n\n"
                                "   DO NOT start the answer with the source. The source must be the very last line.\n"
                                "   Example format:\n"
                                "   'Example Answer'\n\n"
                                "   [Quelle: Dateiname]'\n"
                            ),
                        },
                        {
                            "role": "user",
                            "content": f"Context:\n{rag_context}\n\nQuestion: {q}",
                        },
                    ],
                    options=LLM_CONFIG,
                )

                duration = time.time() - start

                dict_time[model].append(duration)
                generated_text = response["message"]["content"].strip()

                fallback_trigger = "Auf diese Frage habe ich leider keine Antwort."

                # Check: Beginnt der Text damit?
                if (
                    generated_text.startswith(fallback_trigger)
                    or fallback_trigger in generated_text[:1000]
                ):
                    # Überschreibe
                    generated_text = "Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de."

                emb_gen = EMBEDDING_MODEL.encode(generated_text, convert_to_tensor=True)
                emb_exp = EMBEDDING_MODEL.encode(expected, convert_to_tensor=True)
                similarity_score = util.pytorch_cos_sim(emb_gen, emb_exp).item()

                benchmark_data.append(
                    {
                        "Model": model,
                        "Question": q,
                        "Generated Answer": generated_text,
                        "Expected Answer": expected,
                        "Time (s)": round(duration, 2),
                        "Similarity Score (0,1)": round(similarity_score, 4),
                    }
                )

                # Print Result Summary
                print(f"👉 Question: {q}")
                print(f"⏱️ Time: {duration:.2f}s")
                print(f"🤖 Answer ({model}):")
                print(generated_text)
                print("-" * 30)

            except Exception as e:
                print(f"{model:<25} | FAILED     | {str(e)}")

    return dict_time, benchmark_data


def generate_excel(benchmark_data):
    df = pd.DataFrame(benchmark_data)

    output_file = "benchmark_results_v34_qwen2_600_300.xlsx"

    # Use ExcelWriter to format columns
    with pd.ExcelWriter(output_file, engine="xlsxwriter") as writer:
        df.to_excel(writer, sheet_name="Benchmark", index=False)
        workbook = writer.book
        worksheet = writer.sheets["Benchmark"]

        text_wrap_format = workbook.add_format({"text_wrap": True, "valign": "top"})
        header_format = workbook.add_format(
            {"bold": True, "bg_color": "#D3D3D3", "border": 1}
        )

        # Set column widths
        worksheet.set_column("A:A", 25, text_wrap_format)  # Model
        worksheet.set_column("B:B", 40, text_wrap_format)  # Question
        worksheet.set_column("C:C", 50, text_wrap_format)  # Generated Answer
        worksheet.set_column("D:D", 50, text_wrap_format)  # Expected Answer
        worksheet.set_column("E:E", 10, text_wrap_format)  # Time
        worksheet.set_column("F:F", 20, text_wrap_format)  # Similarity Score

        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)


if __name__ == "__main__":
    result_time, benchmark = run_benchmark()

    for key in result_time:
        avg_time = sum(result_time[key]) / len(result_time[key])
        result_time[key] = avg_time
    best_model = min(result_time, key=result_time.get)
    print(f"\n🏆 Best Model: {best_model} with average time {result_time[best_model]}")

    generate_excel(benchmark)
