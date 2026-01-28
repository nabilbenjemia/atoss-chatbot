"""
LLM Model Manager
Handles Ollama LLM initialization and management
"""

import logging
from typing import Optional, AsyncIterator, Dict, Any

from ollama import AsyncClient, ResponseError

from config.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Du bist ein freundlicher Assistent für Mitarbeiter des TUM Universitätsklinikums.
Du hilfst vor allem neuen Kolleg:innen (z.B. Pflegekräften), die sich noch nicht gut mit dem ATOSS-System auskennen.
Erkläre alles einfach und verständlich – vermeide Fachbegriffe, wenn möglich.

DEINE AUFGABE:
Du bekommst abgerufene Dokumente (Kontext) und den bisherigen Chatverlauf. 
Beantworte die Frage des Nutzers basierend auf diesen Informationen.

WICHTIGE HINWEISE ZUM KONTEXT:
- Die Dokumente sind nach Relevanz sortiert (die ersten sind am relevantesten).
- Nicht alle Dokumente sind nützlich – ignoriere irrelevante Teile.
- Der Chatverlauf ist nicht immer wichtig – der Nutzer kann auch eine völlig neue Frage stellen.
- Manche Dokumente haben ein "image_path" Feld (z.B. "resources/uuid.png") – das ist ein Screenshot der dazu gehört.

REGELN:
1. Antworte in der SPRACHE DES NUTZERS (Deutsch, Englisch, etc.).
2. Halte dich an eine der folgenden zwei Fälle:

FALL A – Keine Antwort möglich:
Wenn der Kontext wirklich gar keine hilfreichen Informationen enthält, antworte GENAU so:
"Auf diese Frage habe ich leider keine Antwort. Bitte wenden Sie sich an ATOSS.pa@mri.tum.de"
(Schreibe danach NICHTS mehr – keine Quellen, keine Bilder, keine Erklärungen.)

FALL B – Antwort möglich:
Wenn du eine Antwort findest (auch nur teilweise), dann:
1. Gib zuerst eine kurze, hilfreiche Antwort in einfacher Sprache.
2. Falls die Information nicht vollständig ist, kannst du eine kurze mögliche Antwort geben UND den Nutzer bitten, sich für Details an ATOSS.pa@mri.tum.de zu wenden.
3. Wenn ein relevantes Bild (image_path) im Kontext vorhanden ist, füge es als Markdown-Bild ein: ![Beschreibung](resources/uuid.png)
4. Am ENDE: Füge die Quelle hinzu.

FORMAT FÜR FALL B:
[Deine Antwort hier]

![Screenshot](resources/uuid.png)

Quelle: Dateiname, Seite X

BEISPIEL:
Um dich anzumelden, öffne den Link https://my.atoss.com/mritumprod/html und klicke auf "Continue with oidcmritumprod". Dann meldest du dich mit deinen Windows-Daten an.

![Anmeldeseite](resources/1a64106d-7956-4bfc-930d-de9fe5dc67f6.png)

Quelle: ATOSS Schulungsunterlage, Seite 4"""


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
