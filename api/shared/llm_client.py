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

    Returns dict with keys 'identity' (dict), 'review' (str) and 'popups'
    (list[str]), or None if AI is unavailable / fails.
    """
    client = _client()
    deployment = _deployment()
    if client is None or not deployment:
        return None

    prompt = (
        "You are writing for CVEnhancer, a satirical meme site that mocks "
        "LinkedIn-influencer-thought-leader culture. Tone: maximum cringe. "
        "Self-aggrandizing humility, hashtag spam, unironic emoji, fake-deep "
        "observations about mundane things, corporate jargon (synergy, "
        "leverage, paradigm, ecosystem, value-add).\n\n"
        "Given the CV below, return JSON with EXACTLY these fields:\n\n"
        '1. "identity": object with these string fields (empty string if '
        "the CV does not contain it; never invent a value):\n"
        "   - name: candidate's full name\n"
        "   - title: their current or most recent role title\n"
        "   - email\n"
        "   - phone\n"
        "   - linkedin: full URL if present\n"
        "   - github: full URL if present\n\n"
        '2. "review": a 100-word fake LinkedIn post written IN FIRST '
        "PERSON as if the candidate themselves posted it. MUST include:\n"
        "   - a humble-brag opener (\"Humbled to share...\", \"Grateful "
        "to announce...\", \"Plot twist...\")\n"
        "   - reference 1-2 specific things from the CV (a company, a "
        "skill, years of experience)\n"
        "   - one fake-deep takeaway (\"And honestly? That's the real "
        "ROI.\")\n"
        "   - 5-7 hashtags at the end (#blessed #leadership etc.)\n"
        "   - emoji sprinkled throughout\n\n"
        '3. "popups": EXACTLY 10 short (under 70 chars each) '
        "achievement popups in the same LinkedIn-cringe voice. Each "
        "leads with one emoji. Each must reference something SPECIFIC "
        "from the CV (a real company name, a real skill, a real number "
        "from their experience). Examples of the tone:\n"
        "   \"🚀 4 years at Acme that disrupted disruption itself\"\n"
        "   \"💎 Listed Python AND Synergy, iconic flex\"\n\n"
        f"Candidate name (heuristic guess, may be wrong): {name or 'unknown'}\n"
        f"CV:\n{text[:6000]}\n\n"
        "Reply with ONLY valid JSON, no markdown."
    )

    try:
        resp = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_completion_tokens=900,
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

    raw_identity = data.get("identity") if isinstance(data.get("identity"), dict) else {}
    identity = {
        k: str(raw_identity.get(k, "")).strip()
        for k in ("name", "title", "email", "phone", "linkedin", "github")
    }

    if not review and not popups and not any(identity.values()):
        return None
    return {"identity": identity, "review": review, "popups": popups}
