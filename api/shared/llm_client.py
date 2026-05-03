"""Optional Azure OpenAI integration.

Every public function returns None on any failure (missing config, network
error, quota exhaustion, parse error). Callers must treat None as "fall
back to default behavior" — never raise to the user.
"""
import json
import logging
import os
from typing import Optional

try:
    from openai import AzureOpenAI
    _SDK_OK = True
except ImportError:
    _SDK_OK = False

_TIMEOUT_SECONDS = 12


def _client():
    if not _SDK_OK:
        return None
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    key = os.environ.get("AZURE_OPENAI_KEY")
    if not endpoint or not key:
        return None
    try:
        return AzureOpenAI(
            api_key=key,
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
            azure_endpoint=endpoint,
            timeout=_TIMEOUT_SECONDS,
        )
    except Exception:
        logging.exception("AzureOpenAI client construction failed")
        return None


def _deployment() -> Optional[str]:
    return os.environ.get("AZURE_OPENAI_DEPLOYMENT")


def generate_roasts(text: str, name: str) -> Optional[dict]:
    """Generate personalized roast content from a CV.

    Returns dict with keys 'review' (str) and 'popups' (list[str]),
    or None if AI is unavailable / fails.
    """
    client = _client()
    deployment = _deployment()
    if client is None or not deployment:
        return None

    prompt = (
        "You are writing humorous content for a satirical CV-roasting meme website. "
        "Given the CV below, produce JSON with exactly these fields:\n"
        '- "review": an 80-100 word fake "AI Career Counselor Review" — '
        "positive in tone but absurd in substance, full of corporate buzzwords. "
        "Reference 1-2 specific things from the CV.\n"
        '- "popups": an array of EXACTLY 10 short (under 70 chars each) '
        "achievement-popup strings. Each must reference something specific "
        "from the CV in a funny way. Lead each with one emoji. Lean into "
        "corporate cringe and meme energy.\n\n"
        f"Candidate name: {name or 'unknown'}\n"
        f"CV:\n{text[:6000]}\n\n"
        "Reply with ONLY valid JSON, no markdown."
    )

    try:
        resp = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=700,
            temperature=0.9,
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
    except Exception:
        logging.exception("AI generate_roasts call failed")
        return None

    review = str(data.get("review", "")).strip()
    raw_popups = data.get("popups", []) if isinstance(data.get("popups"), list) else []
    popups = [str(p).strip() for p in raw_popups if str(p).strip()][:12]

    if not review and not popups:
        return None
    return {"review": review, "popups": popups}
