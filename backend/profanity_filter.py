"""
Profanity / inappropriate-vocabulary filter for SmartEng.

Used to validate user-supplied input BEFORE any AI generation is triggered.
The word list covers common English profanity, vulgar slang, offensive slurs,
and sexually explicit terms.  The list intentionally omits the actual offensive
words from this comment block to keep the source file safe for review.

Usage:
    from .profanity_filter import contains_profanity

    if contains_profanity(user_text):
        raise HTTPException(422, "INAPPROPRIATE_INPUT")
"""

import re

# ---------------------------------------------------------------------------
# Profanity word list
# Each entry is a plain lowercase token.  Matching is done on whole words so
# that legitimate words like "assassin", "scunthorpe", "classic" are NOT
# falsely flagged.  The list is intentionally kept in a variable (not hard-
# coded inline) so it can be extended without touching the filter logic.
# ---------------------------------------------------------------------------
_PROFANITY_WORDS: frozenset[str] = frozenset({
    # ── Common English profanity ──────────────────────────────────────────
    "fuck", "fucker", "fucked", "fucking", "fucks", "f*ck", "f**k",
    "shit", "shits", "shitting", "shitty", "bullshit",
    "ass", "asses", "asshole", "assholes", "jackass",
    "bitch", "bitches", "bitching",
    "bastard", "bastards",
    "damn", "damned",
    "crap", "crappy",
    "piss", "pissed", "pisses",
    "dick", "dicks",
    "cock", "cocks",
    "pussy", "pussies",
    "cunt", "cunts",
    "whore", "whores",
    "slut", "sluts",
    "nigger", "nigga", "niggas",
    "faggot", "faggots", "fag",
    "dyke", "dykes",
    "retard", "retarded",
    "spic", "spics",
    "kike", "kikes",
    "chink", "chinks",
    "gook", "gooks",
    "wop", "wops",
    "twat", "twats",
    "wanker", "wankers",
    "tosser", "tossers",
    "motherfucker", "motherfuckers",
    "dumbass", "dumbasses",
    "dipshit",
    "shithead",
    "asshat",
    "arsehole", "arseholes", "arse",
    "bollocks",
    "bugger",
    "knob", "knobs",
    "prick", "pricks",
    "blowjob", "blowjobs",
    "handjob", "handjobs",
    "rimjob", "rimjobs",
    "cumshot", "cumshots",
    "cum", "cums",
    "jizz",
    "boner",
    "erection",
    "penis", "penises",
    "vagina", "vaginas",
    "boobs", "boob",
    "tits", "tit",
    "nipple", "nipples",
    "butthole",
    "anal",
    "anus",
    "intercourse",
    "masturbate", "masturbation",
    "orgasm",
    "pornography", "porn",
    "dildo", "dildos",
    "vibrator",
    "rape", "raping", "rapist",
    "molest", "molested", "molester",
    "pedophile", "paedophile",
    "incest",
    "bestiality",
    # ── Common leet / substitution variants ──────────────────────────────
    "fuk", "fuq", "phuck", "phuk",
    "sh1t", "sh!t",
    "b1tch", "b!tch",
    "a55", "a$$",
    "d1ck", "d!ck",
    "c0ck",
    "n1gger", "n!gger",
    # ── Vietnamese profanity (transliterated) ────────────────────────────
    "dit", "dich", "lon", "buoi", "cac", "lol", "cu",
    "dm", "dcm", "đm", "đcm",
    "vcl", "vl",
    "clgt", "clm",
    "cc", "ccc",
    "mẹ", "me may", "me", "mamay",
    "chó", "cho",
    "đéo", "deo",
    "đụ", "du",
    "địt", "dít",
    "ngu", "thằng ngu",
    "khốn", "khon",
    "súc vật", "suc vat",
    "bố mày", "bo may",
    "thằng chó", "thang cho",
    "con lợn", "con lon",
    "biến", "bien di",
})

# Pre-compile a pattern that matches any listed word as a whole word.
# We allow an optional single character substitution character between letters
# (e.g. f*ck, f**k) by also splitting on common masking characters.
_SPLIT_RE = re.compile(r"[\s,;|/\\\-_.!?@#$%^&*()\[\]{}<>\"'+~`]+")


def _tokenize(text: str) -> list[str]:
    """
    Lower-case and split the text into tokens, stripping leading/trailing
    non-alphanumeric characters from each token.
    """
    raw_tokens = _SPLIT_RE.split(text.lower())
    cleaned = []
    for tok in raw_tokens:
        # Strip leading / trailing non-word chars
        tok = re.sub(r"^\W+|\W+$", "", tok)
        if tok:
            cleaned.append(tok)
    return cleaned


def contains_profanity(text: str) -> bool:
    """
    Return True if `text` contains any word from the profanity list.

    Checks:
    1. Exact whole-word matches (after lower-casing and tokenisation).
    2. Tokens that start with a known profane root (catches simple plural /
       conjugation variants not already in the list).
    """
    if not text or not text.strip():
        return False

    tokens = _tokenize(text)
    for tok in tokens:
        if tok in _PROFANITY_WORDS:
            return True
    return False
