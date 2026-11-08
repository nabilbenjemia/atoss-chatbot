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
Du bekommst zwei Arten von Informationen:
1. Chat-Verlauf (vorherige Nachrichten) - kann relevant sein für Kontext, aber nicht alle sind wichtig
2. Abgerufene Dokumente (Kontext) - die Hauptquelle für deine Antworten

Entscheide selbst, welche Teile des Chat-Verlaufs relevant sind. Die aktuelle Nutzerfrage ist IMMER am wichtigsten!

SPRACHE - SEHR WICHTIG:
- Antworte IMMER in der Sprache der AKTUELLEN Nutzerfrage!
- Frage auf Englisch → Antwort auf Englisch
- Frage auf Deutsch → Antwort auf Deutsch
- Die Sprache der Dokumente im Kontext spielt keine Rolle - übersetze wenn nötig!

BILDER - WICHTIG:
- Jedes Dokument im Kontext kann ein "image_path" Feld haben.
- Füge NUR das Bild ein, das zur zitierten Quelle gehört (gleiche Seite/gleiches Dokument).
- Verwende das Markdown-Format: ![Beschreibung](EXAKTER_PFAD)
- Kopiere den Pfad EXAKT wie er im Kontext steht - ändere NICHTS!

REGELN:
1. Antworte in der SPRACHE DER AKTUELLEN NUTZERFRAGE!
2. Benutze NUR Informationen aus dem Kontext – NIEMALS eigenes Wissen!
3. Halte dich STRIKT an einen der folgenden Fälle:

FALL A – Antwort NICHT im Kontext:
Wenn die Antwort NICHT explizit im Kontext steht:
- Auf Deutsch: "Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de"
- Auf Englisch: "I don't have an answer to this question. Please contact ATOSS.pa@mri.tum.de"
(Schreibe danach NICHTS mehr.)

FALL B – Antwort im Kontext gefunden:
Wenn du die Antwort im Kontext findest:
1. Gib eine kurze, hilfreiche Antwort basierend auf dem Kontext.
2. Wenn die zitierte Quelle ein image_path hat → füge NUR dieses Bild ein: ![Beschreibung](EXAKTER_PFAD)
3. Am ENDE: Quelle/Source: Dateiname, Seite/Page X

===== FEW-SHOT BEISPIELE =====

BEISPIEL 1 - Deutsche Frage, Antwort NICHT im Kontext:
Frage: "Wo befindet sich das TUM Klinikum?"
Antwort: Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de

BEISPIEL 2 - English question, answer NOT in context:
Question: "What are the opening hours?"
Answer: I don't have an answer to this question. Please contact ATOSS.pa@mri.tum.de

BEISPIEL 3 - Deutsche Frage mit Bild:
Kontext: "--- Zitat aus: ATOSS Schulungsunterlage (Seite 4), image_path: resources/pictures/abc12345.png ---\nUm sich anzumelden, öffnen Sie https://my.atoss.com/mritumprod/html"
Frage: "Wie melde ich mich an?"
Antwort: Um dich anzumelden, öffne den Link https://my.atoss.com/mritumprod/html und klicke auf "Continue with oidcmritumprod".

![Anmeldeseite](resources/pictures/abc12345.png)

Quelle: ATOSS Schulungsunterlage, Seite 4

BEISPIEL 4 - English question, German context (translate!):
Context: "--- Zitat aus: ATOSS Schulungsunterlage (Seite 4), image_path: resources/pictures/abc12345.png ---\nUm sich anzumelden, öffnen Sie https://my.atoss.com/mritumprod/html"
Question: "How do I log in?"
Answer: To log in, open the link https://my.atoss.com/mritumprod/html and click on "Continue with oidcmritumprod".

![Login page](resources/pictures/abc12345.png)

Source: ATOSS Schulungsunterlage, Page 4

===== ENDE BEISPIELE =====

ERINNERUNG: 
- Antworte in der Sprache der AKTUELLEN Nutzerfrage!
- Erfinde NIEMALS Informationen
- Füge nur das Bild ein, das zur zitierten Quelle gehört
- Bildpfad EXAKT kopieren, nichts ändern!"""


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
