"""Guardrails for prompt settings modification.

Three defence layers:
1. Schema     — Pydantic field constraints (length, type, item count).
2. Content    — regex blocklist rejects adversarial injections, context-bypass
                phrases, inappropriate tone directives, and profanity
                (including common obfuscations like f***, sh1t, @ss).
3. Hard-pin   — MANDATORY_CONSTRAINT is always injected by build_grounded_prompt
                regardless of what is saved here; sanitize_constraints() drops
                any constraint that contradicts grounding at build time.

Adding new rules:
- Injection / hallucination / exfiltration → add to _BLOCKED_PATTERNS
- Tone / behaviour directives              → add to _BLOCKED_PATTERNS
- Profanity words / obfuscations           → add to _PROFANITY_ROOTS
"""

from __future__ import annotations

import re

try:
    from better_profanity import profanity as _better_profanity
except Exception:  # pragma: no cover - optional dependency
    _better_profanity = None

# ---------------------------------------------------------------------------
# 1. Injection, hallucination, exfiltration, role-hijack, context-bypass
# ---------------------------------------------------------------------------
_BLOCKED_PATTERNS: list[tuple[str, str]] = [
    # Prompt-injection
    (r"ignore\s+(all\s+)?(previous|above|prior|system)\s+(instructions?|prompt)", "injection: ignore previous"),
    (r"disregard\s+(all\s+)?(previous|above|prior|system|your)\s+", "injection: disregard"),
    (r"forget\s+(all\s+)?(previous|above|prior|your)\s+", "injection: forget"),
    (r"override\s+(your\s+)?(system\s+)?(prompt|instructions?)", "injection: override system prompt"),
    # Hallucination enablement
    (r"\bmake\s+up\s+facts?\b", "hallucination: make up facts"),
    (r"\binvent\s+facts?\b", "hallucination: invent facts"),
    (r"\bfabricate\b", "hallucination: fabricate"),
    (r"\bhallucinate\b", "hallucination: hallucinate"),
    # Citation suppression
    (r"\bdo\s+not\s+cite\b", "citation suppression"),
    (r"\bno\s+citations?\b", "citation suppression"),
    (r"\bwithout\s+(any\s+)?sources?\b", "citation suppression"),
    # System-prompt exfiltration
    (r"reveal\s+(your\s+)?(system\s+)?prompt", "exfiltration: reveal prompt"),
    (r"repeat\s+(your\s+)?(system\s+)?prompt", "exfiltration: repeat prompt"),
    (r"print\s+(your\s+)?(system\s+)?prompt", "exfiltration: print prompt"),
    # Role hijacking
    (r"you\s+are\s+now\s+(?!a\s+retrieval)", "role hijack: you are now"),
    (r"act\s+as\s+(?!a\s+retrieval)", "role hijack: act as"),
    (r"pretend\s+(to\s+be|you\s+are)", "role hijack: pretend"),
    # Context / question bypass (fixed-output attacks)
    (r"no\s+matter\s+what\s+(the\s+)?(context|question|input|user)", "context bypass: no matter what"),
    (r"regardless\s+of\s+(the\s+)?(context|question|input|user)", "context bypass: regardless of"),
    (r"ignore\s+(all\s+)?(constraints|rules|instructions?|guidelines)", "context bypass: ignore constraints"),
    (r"always\s+(respond|reply|say|answer)\s+(with\s+)?\S+\s+(no\s+matter|regardless)", "fixed-output override"),
    (
        r"\b(always|only)\s+(respond|reply|say|answer)\b.{0,80}\b(no\s+matter\s+what|regardless\s+of\b)",
        "fixed-output override",
    ),
    (
        r"\b(respond|reply|say|answer)\s+(as|with)\b.{0,80}\b(no\s+matter\s+what|regardless\s+of\b)",
        "fixed-output override",
    ),
    (r"\banswer\s+only\s+['\"]?\w+['\"]?\s+(no\s+matter|regardless|always)", "fixed-output override"),
    (r"ignore\s+(the\s+)?(context|question|user\s+input)", "context bypass: ignore context"),
    # Inappropriate tone directives
    (r"\b(be|use|respond\s+with|write\s+in|speak\s+in|answer\s+in)\s+(a\s+)?(rude|offensive|aggressive|vulgar|profane|abusive|hateful|racist|sexist|filthy)\b", "inappropriate tone directive"),
    (r"\bfilthy\s+(language|tone|style)\b", "inappropriate tone directive"),
    (r"\binsult\s+(the\s+)?(user|person|questioner|human)\b", "abusive directive: insult user"),
    (r"\b(threaten|harass|bully|demean|degrade|humiliate)\s+(the\s+)?(user|person|questioner)\b", "abusive directive"),
    (r"\buse\s+(swear\s+words?|curse\s+words?|profanity)\b", "profanity directive"),
    (r"\bswear\s+at\b", "profanity directive"),
]

_COMPILED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(p, re.IGNORECASE), reason)
    for p, reason in _BLOCKED_PATTERNS
]


# ---------------------------------------------------------------------------
# 2. Profanity — roots + common obfuscation variants
#
# Strategy: normalise the input (strip leet-speak, punctuation used as
# substitutes) then word-match against a root set.  This catches:
#   f***, f**k, fck, fvck, sh!t, sh1t, @ss, a$$, b1tch, etc.
# ---------------------------------------------------------------------------
_PROFANITY_ROOTS: frozenset[str] = frozenset({
    # F-words
    "fuck", "fck", "fuk", "fvck", "fuc",
    # S-words
    "shit", "sht", "shyt",
    # A-words
    "ass", "arse", "arsehole", "asshole",
    # B-words
    "bitch", "btch", "biatch",
    "bastard", "bstard",
    "bullshit", "bs",
    # C-words
    "cunt", "cnt",
    "cock", "cok",
    "crap",
    # D-words
    "damn", "dick", "dck",
    # P-words
    "piss", "piss off", "pussy",
    # W-words
    "wanker", "wank",
    # Other
    "nigger", "nigga", "faggot", "fag", "retard",
    "whore", "slut", "twat",
})

# Characters that are commonly substituted for letters in obfuscated profanity.
_LEET: dict[str, str] = str.maketrans({
    "@": "a",
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "!": "i",
    "$": "s",
    "+": "t",
    "7": "t",
    "8": "b",
    "|": "i",
})

# Characters used purely as censoring fill (f***, s**t) that should be removed
# so the root is recoverable.
_FILL_CHARS_RE = re.compile(r"[*#_\-]+")


def _normalize_for_profanity(text: str) -> str:
    """Lower-case, apply leet substitutions, strip filler characters."""
    lowered = text.lower().translate(_LEET)
    return _FILL_CHARS_RE.sub("", lowered)


def _extract_tokens(text: str) -> list[str]:
    """Return word tokens from normalised text, splitting on whitespace and
    common separators while keeping internal letter sequences intact."""
    # Split on anything that's not alphanumeric (after normalisation).
    return re.findall(r"[a-z0-9]+", text)


def check_profanity(text: str, field_name: str = "text") -> None:
    """Raise ValueError if *text* contains a profane word or obfuscation.

    Catches:
      - Plain words  : "fuck", "shit"
      - Asterisked   : "f***", "s**t", "f**k"
      - Leet-speak   : "sh1t", "f4ck", "@ss", "a$$", "b1tch"
      - Partial fills: "fck", "btch"
    """
    if _better_profanity is not None:
        try:
            library_detected = _better_profanity.contains_profanity(text)
        except Exception:
            # Fall back to the local detector if the optional package is
            # unavailable or misconfigured at runtime.
            library_detected = False
        if library_detected:
            raise ValueError(
                f"'{field_name}' contains inappropriate language. "
                "Please keep role and constraints professional."
            )

    normalised = _normalize_for_profanity(text)
    tokens = _extract_tokens(normalised)
    for token in tokens:
        if token in _PROFANITY_ROOTS:
            raise ValueError(
                f"'{field_name}' contains inappropriate language. "
                "Please keep role and constraints professional."
            )
    # Also check the full normalised string for multi-word roots like "bullshit".
    for root in _PROFANITY_ROOTS:
        if " " in root and root in normalised:
            raise ValueError(
                f"'{field_name}' contains inappropriate language. "
                "Please keep role and constraints professional."
            )


# ---------------------------------------------------------------------------
# 3. Combined entry-point used by Pydantic validators
# ---------------------------------------------------------------------------

def check_text(text: str, field_name: str = "text") -> None:
    """Run all content checks against *text*.

    Raises ValueError with a descriptive message on the first violation found.
    Call this from every Pydantic field_validator that handles free text.
    """
    # Injection / hallucination / bypass / tone patterns
    for pattern, reason in _COMPILED_PATTERNS:
        if pattern.search(text):
            raise ValueError(
                f"'{field_name}' contains a disallowed instruction ({reason}). "
                "Please remove the flagged phrase and try again."
            )
    # Profanity (runs after structural checks so error messages are specific)
    check_profanity(text, field_name=field_name)


# ---------------------------------------------------------------------------
# 4. Build-time sanitizer (Layer 3 — last line of defence)
# ---------------------------------------------------------------------------

_CONTRADICTION_FRAGMENTS: tuple[str, ...] = (
    "invent", "fabricate", "make up", "don't cite",
    "do not cite", "no citations", "without sources",
    "ignore context", "ignore the context",
    "no matter what", "regardless of the",
    "always answer", "answer as", "respond as", "reply as", "say as",
)


def sanitize_constraints(constraints: list[str]) -> list[str]:
    """Return constraints with any entries that contradict the mandatory
    grounding constraint silently dropped.

    This is the defence-in-depth layer applied at *build time* inside
    build_grounded_prompt().  Even if a constraint bypasses API validation
    (e.g. someone edits prompt_settings.json directly), it cannot remove
    the hard-pinned grounding rule.
    """
    kept: list[str] = []
    for c in constraints:
        low = c.lower()
        if any(frag in low for frag in _CONTRADICTION_FRAGMENTS):
            continue  # silently drop
        kept.append(c)
    return kept
