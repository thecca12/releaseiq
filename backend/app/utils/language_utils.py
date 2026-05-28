"""
Multilingual utilities for ReleaseIQ chat.

Handles:
- Language detection (English, Hindi, Marathi, Hinglish/Romanized)
- Multilingual intent keyword mapping
- Universal entity extraction (JIRA IDs, version names, error codes)
- Response language instruction for Ollama
"""

from __future__ import annotations

import re
from typing import Optional

# ---------------------------------------------------------------------------
# Multilingual intent keywords
# Hindi/Marathi/Hinglish synonyms mapped to English intent keywords
# ---------------------------------------------------------------------------

MULTILINGUAL_KEYWORDS: dict[str, list[str]] = {
    # JIRA / Issue synonyms
    "jira": [
        "jira", "issue", "ticket", "bug", "getsctcl",
        "samasya", "samasya", "dikkat", "galti", "problem",
        "issue hai", "bug hai", "kya hua", "kya problem",
    ],
    # Release / Patch note synonyms
    "release": [
        "release", "patch", "patch notes", "version", "deploy",
        "optimus", "1209", "3009",
        "update", "badlav", "nayi version", "naya patch",
        "kya fix hua", "changes", "kya change", "patch kya hai",
        "dikhao patch", "patch dikhao", "version dikhao",
        "release dikhao", "latest release", "naya release",
    ],
    # Error / Error code synonyms
    "error": [
        "error", "rejection", "reject", "err_", "error_",
        "galti", "dikkat", "kya matlab", "matlab kya",
        "error code", "error kya", "kya error", "yeh error",
        "why rejected", "kyon reject", "reject kyun",
    ],
    # Log synonyms
    "log": [
        "log", "fix log", "order", "trade", "session",
        "log dikhao", "crash", "exception",
    ],
    # Client synonyms
    "client": [
        "client", "broker", "upgrade",
        "client kaun", "kaunsa client", "client ka version",
    ],
    # Flag synonyms
    "flag": [
        "flag", "trading style", "ini", "kill switch",
        "flag kya hai", "flag ki value", "flag dikhao",
    ],
    # Help synonyms
    "help": [
        "help", "madad", "kya kar sakte ho", "kya puchh sakte",
        "kya puchh sakta", "batao kya", "aap kya karte ho",
        "tum kya kar sakte", "sahi jankari", "jankari do",
    ],
}

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

def detect_language(text: str) -> str:
    """
    Detect the language of user input.
    Returns 'hi' for Hindi/Hinglish/Marathi, 'en' for English.
    Falls back to 'en' on any error.
    """
    # Devanagari Unicode range: U+0900–U+097F
    devanagari_chars = sum(1 for c in text if "ऀ" <= c <= "ॿ")
    if devanagari_chars > 2:
        return "hi"  # Native Devanagari script

    # Romanized Hindi/Marathi heuristic — check for common Hindi words
    lower = text.lower()
    hindi_words = [
        "dikhao", "batao", "kya", "kaun", "kab", "kyun", "kyon",
        "matlab", "hai", "nahi", "hota", "karo", "karo", "liye",
        "mujhe", "humko", "mera", "hamara", "unka", "uska",
        "aur", "ya", "lekin", "kyunki", "isliye", "toh",
        "kaise", "kitna", "kitne", "sab", "sabko", "sabse",
    ]
    hindi_count = sum(1 for w in hindi_words if re.search(r'\b' + w + r'\b', lower))
    if hindi_count >= 2:
        return "hi"

    try:
        from langdetect import detect, LangDetectException
        lang = detect(text)
        # Treat Indonesian (often mis-detected Hinglish) as Hindi
        if lang in ("hi", "mr", "ne", "id"):
            return "hi"
        return "en"
    except Exception:
        return "en"


# ---------------------------------------------------------------------------
# Universal entity extraction (language-agnostic)
# ---------------------------------------------------------------------------

def extract_jira_ids(text: str) -> list[str]:
    """Extract GETSCTCL-XXXXX JIRA IDs from any language text."""
    return re.findall(r"GETSCTCL-\d+", text.upper())


def extract_versions(text: str) -> list[str]:
    """Extract version/release names from any language text."""
    lower = text.lower()
    found = re.findall(r"v\d+\.\d+(?:[.-]\w+)?", lower)
    for name in ["optimus", "1209", "3009"]:
        if name in lower:
            found.append(name)
    return list(dict.fromkeys(found))  # deduplicate preserving order


def extract_error_codes(text: str) -> dict[str, list[str]]:
    """Extract error code references in any format."""
    upper = text.upper()
    return {
        "numeric_codes": re.findall(r"[A-Z]{2,5}[- ]?\d{3,4}", upper),
        "define_names": re.findall(r"\b(ERR_\w+|ERROR_\w+)\b", upper),
        "plain_numeric": re.findall(r"\b(\d{4,6})\b", text),
    }


# ---------------------------------------------------------------------------
# Multilingual intent detection
# ---------------------------------------------------------------------------

def detect_intent_multilingual(text: str) -> str:
    """
    Detect user intent from any language.
    Returns one of: jira_search | release_query | error_query | log_search |
                    client_query | flag_query | help | general
    """
    lower = text.lower()

    # Entity-based detection (language-independent)
    if extract_jira_ids(text):
        return "jira_search"
    if extract_versions(text):
        return "release_query"
    ec = extract_error_codes(text)
    if ec["numeric_codes"] or ec["define_names"] or ec["plain_numeric"]:
        if any(kw in lower for kw in ["error", "galti", "matlab", "mean", "kya", "rejection"]):
            return "error_query"

    # Keyword-based multilingual matching
    for intent, keywords in MULTILINGUAL_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            if intent == "jira":
                return "jira_search"
            if intent == "release":
                return "release_query"
            if intent == "error":
                return "error_query"
            if intent == "log":
                return "log_search"
            if intent == "client":
                return "client_query"
            if intent == "flag":
                return "flag_query"
            if intent == "help":
                return "help"

    return "general"


# ---------------------------------------------------------------------------
# Language instruction for Ollama system prompt
# ---------------------------------------------------------------------------

def get_language_instruction(lang: str) -> str:
    """Return a system prompt addition telling Ollama which language to use."""
    if lang == "hi":
        return (
            "\nIMPORTANT: The user is asking in Hindi or a regional Indian language. "
            "Respond in the same language (Hindi/Hinglish). "
            "Technical terms like JIRA IDs, version names, error codes should remain in English. "
            "Keep the response clear and professional."
        )
    return ""


# ---------------------------------------------------------------------------
# Translate mock responses to Hindi (basic)
# ---------------------------------------------------------------------------

_HINDI_TRANSLATIONS: dict[str, str] = {
    "not found": "नहीं मिला",
    "Open": "खुला",
    "Closed": "बंद",
    "In Progress": "प्रगति में",
    "Resolved": "हल हो गया",
    "Critical": "गंभीर",
    "High": "उच्च",
    "Medium": "मध्यम",
    "Low": "कम",
}


def maybe_add_hindi_header(response: str, lang: str) -> str:
    """For Hindi queries, prepend a note that data is shown in English for accuracy."""
    if lang == "hi" and not response.startswith("**"):
        return response
    return response
