"""
LLM Model Manager
Handles Ollama LLM initialization and management
"""

import logging
from typing import Optional, AsyncIterator, Dict, Any

from ollama import AsyncClient, ResponseError

from config.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Du bist ein Assistent für Mitarbeiter des TUM Universitätsklinikums.
Du hilfst vor allem neuen Kolleg:innen, die sich noch nicht gut mit dem ATOSS-System auskennen.

WICHTIGSTE REGEL - STRIKT BEFOLGEN:
Du darfst NUR Informationen verwenden, die EXPLIZIT im bereitgestellten Kontext stehen.
Du darfst NIEMALS dein eigenes Wissen verwenden oder Informationen erfinden.
Wenn die Antwort NICHT im Kontext steht, musst du das klar sagen.

DEINE AUFGABE:
Du bekommst abgerufene Dokumente (Kontext). Beantworte die Frage NUR basierend auf diesem Kontext.

HINWEISE ZUM KONTEXT:
- Manche Dokumente haben ein "image_path" Feld – das ist der Pfad zu einem Screenshot.
- Die Dokumente sind nach Relevanz sortiert.

REGELN:
1. Antworte in der SPRACHE DES NUTZERS.
2. Benutze NUR Informationen aus dem Kontext – NIEMALS eigenes Wissen!
3. Halte dich STRIKT an einen der folgenden Fälle:

FALL A – Antwort NICHT im Kontext:
Wenn die Antwort NICHT explizit im Kontext steht, antworte GENAU so:
"Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de"
(Schreibe danach NICHTS mehr.)

FALL B – Antwort im Kontext gefunden:
Wenn du die Antwort im Kontext findest:
1. Gib eine kurze, hilfreiche Antwort basierend auf dem Kontext.
2. Wenn ein relevantes Bild (image_path) vorhanden ist, füge es ein mit dem EXAKTEN Pfad aus dem Kontext: ![Beschreibung](EXAKTER_PFAD_AUS_KONTEXT)
3. Am ENDE: Quelle: Dateiname, Seite X

===== FEW-SHOT BEISPIELE =====

BEISPIEL 1 - Antwort NICHT im Kontext:
Kontext: "Das Staff Center ermöglicht die Zeiterfassung... Urlaubsanträge können eingereicht werden..."
Frage: "Wo befindet sich das TUM Klinikum?"
Antwort: Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de

BEISPIEL 2 - Antwort NICHT im Kontext:
Kontext: "Klicken Sie auf 'Antrag stellen' um einen neuen Urlaubsantrag zu erstellen..."
Frage: "Wie viele Mitarbeiter hat das Klinikum?"
Antwort: Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de

BEISPIEL 3 - Antwort im Kontext MIT Bild:
Kontext: "--- Zitat aus: ATOSS Schulungsunterlage (Seite 4), image_path: resources/pictures/abc12345-6789-def0-1234-567890abcdef.png ---\nUm sich anzumelden, öffnen Sie https://my.atoss.com/mritumprod/html und klicken Sie auf 'Continue with oidcmritumprod'."
Frage: "Wie melde ich mich an?"
Antwort: Um dich anzumelden, öffne den Link https://my.atoss.com/mritumprod/html und klicke auf "Continue with oidcmritumprod". Dann meldest du dich mit deinen Windows-Daten an.

![Anmeldeseite](resources/pictures/abc12345-6789-def0-1234-567890abcdef.png)

Quelle: ATOSS Schulungsunterlage, Seite 4

(WICHTIG: Der Bildpfad "resources/pictures/abc12345-6789-def0-1234-567890abcdef.png" wurde EXAKT aus dem Kontext übernommen!)

===== ENDE BEISPIELE =====

ERINNERUNG: Erfinde NIEMALS Informationen. Wenn es nicht im Kontext steht, sage dass du keine Antwort hast."""


class LLMManager:
    """Manages the Ollama LLM lifecycle"""

    _instance: Optional["LLMManager"] = None
    _client: Optional[AsyncClient] = None
    _is_loaded: bool = False
    _model_params: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._llm = None
            self._is_loaded = False

            self._model_params = {
                "temperature": settings.OLLAMA_TEMPERATURE,
                "num_ctx": settings.OLLAMA_NUM_CTX,
                "repeat_penalty": settings.OLLAMA_REPEAT_PENALTY,
                "num_predict": settings.OLLAMA_NUM_PREDICT,
            }

    async def load(self) -> bool:
        """Load the Ollama LLM"""
        if self._is_loaded:
            logger.info("LLM already loaded")
            return True

        try:
            logger.info("Loading Ollama LLM: %s", settings.OLLAMA_MODEL)

            # Client initialisieren
            self._client = AsyncClient(host=settings.OLLAMA_BASE_URL)

            logger.info("Ollama LLM (%s) loaded successfully", settings.OLLAMA_MODEL)
            self._is_loaded = True
            return True

        except ResponseError as e:
            if e.status_code == 404:
                logger.error(
                    "Model '%s' not found. Please run 'ollama pull %s'",
                    settings.OLLAMA_MODEL,
                )
            else:
                logger.error("Ollama API Error: %s", e)
            self._is_loaded = False
            return False
        except Exception as e:
            logger.error("Failed to connect to Ollama: %s", e)
            self._is_loaded = False
            return False

    def get_client(self) -> AsyncClient:
        """Get the Ollama client"""
        if not self._is_loaded or self._client is None:
            raise RuntimeError("LLM not loaded. Call load() first.")
        return self._client

    async def generate(self, context: str, question: str) -> str:
        """Generate a response from the LLM"""
        client = self.get_client()
        try:
            response = await client.chat(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {question}",
                    },
                ],
                options=self._model_params,
                stream=False,
            )
            return response["message"]["content"]

        except Exception as e:
            logger.error("Error during LLM chat generation: %s", e)
            raise

    async def stream_generate(self, context: str, question: str) -> AsyncIterator[str]:
        """Stream generate response from the LLM"""
        client = self.get_client()

        try:
            async for chunk in await client.chat(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {question}",
                    },
                ],
                options=self._model_params,
                stream=True,
            ):
                # Bei chat streaming ist der Content in chunk['message']['content']
                yield chunk["message"]["content"]

        except Exception as e:
            logger.error("Error during LLM chat streaming: %s", e)
            raise

    @property
    def is_loaded(self) -> bool:
        """Check if LLM is loaded"""
        return self._is_loaded

    def unload(self):
        """Unload the LLM"""
        self._client = None
        self._is_loaded = False
        logger.info("LLM unloaded")


# Singleton instance
llm_manager = LLMManager()
