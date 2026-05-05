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

_TIMEOUT_SECONDS = 35


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


def diagnose() -> dict:
    """Return AI configuration status plus the result of a tiny test call.

    Used by /api/diag for one-shot debugging when Application Insights is
    not available. Never returns the actual API key.
    """
    out: dict = {
        "sdk_available": _SDK_OK,
        "endpoint_set": bool(os.environ.get("AZURE_OPENAI_ENDPOINT")),
        "key_set": bool(os.environ.get("AZURE_OPENAI_KEY")),
        "deployment_set": bool(os.environ.get("AZURE_OPENAI_DEPLOYMENT")),
        "deployment_name": os.environ.get("AZURE_OPENAI_DEPLOYMENT", ""),
        "api_version": os.environ.get("AZURE_OPENAI_API_VERSION", "(default)"),
    }
    client = _client()
    if client is None:
        out["test_call_status"] = "skipped"
        out["reason"] = "client construction failed (missing config or SDK)"
        return out
    deployment = _deployment()
    if not deployment:
        out["test_call_status"] = "skipped"
        out["reason"] = "AZURE_OPENAI_DEPLOYMENT not set"
        return out
    try:
        kwargs: dict = {
            "model": deployment,
            "messages": [
                {"role": "user", "content": 'Reply with the JSON {"ok": true} and nothing else.'}
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 4000,
        }
        if any(p in deployment.lower() for p in ("gpt-5", "o1", "o3", "o4")):
            kwargs["reasoning_effort"] = "minimal"
        resp = client.chat.completions.create(**kwargs)
        out["test_call_status"] = "ok"
        out["response_preview"] = (resp.choices[0].message.content or "")[:300]
        out["finish_reason"] = resp.choices[0].finish_reason
        out["completion_tokens"] = resp.usage.completion_tokens if resp.usage else None
        out["reasoning_tokens"] = (
            resp.usage.completion_tokens_details.reasoning_tokens
            if resp.usage and resp.usage.completion_tokens_details
            else None
        )
    except Exception as e:
        out["test_call_status"] = "error"
        out["error_type"] = type(e).__name__
        out["error_message"] = str(e)[:600]
    return out


def generate_roasts(text: str, name: str, items: Optional[list] = None) -> Optional[dict]:
    """Generate personalized roast content from a CV.

    Returns dict with keys identity (dict), review (str), popups (list[str])
    and enhanced (dict[str, list[str]]), or None if AI is unavailable / fails.
    """
    client = _client()
    deployment = _deployment()
    if client is None or not deployment:
        return None

    if items:
        sections_block = "\n\n".join(
            f"### {it['heading']} (canonical_key: {it['canonical']})\n{it['body']}"
            for it in items
        )
    else:
        sections_block = f"(no parsed sections; raw text)\n{text[:6000]}"

    prompt = (
        "You write for ResuMeme: satire that inflates CVs into LinkedIn-cringe "
        "fused with Gen-Z brainrot. Voice = corporate jargon (synergy, "
        "leverage, paradigm, ecosystem) COLLIDING with brainrot slang "
        "(skibidi, sigma, rizz, gyatt, mewing, fanum tax, ohio, gigachad, "
        "looksmaxxed, mogged, NPC, no cap, goated, bussin). Mix both per "
        "bullet. Loud, explosive, brainrotted.\n\n"
        "RULES: No em dashes. Never invent companies/skills/dates. "
        "Output ONLY valid JSON, no markdown.\n\n"
        "JSON fields:\n\n"
        '1. "identity": {name, title, email, phone, linkedin, github}. '
        "Empty string if absent. Never invent.\n\n"
        '2. "review": ~120-word first-person fake LinkedIn post by the '
        "candidate. Humble-brag opener, 2-3 CV specifics, one fake-deep "
        '("almost gave up") moment, 1-2 brainrot terms slipped in, 7-9 '
        "hashtags, emoji throughout.\n\n"
        '3. "popups": 12 short (<70 chars) achievement popups. Each '
        "starts with one emoji, references a real CV item (company, "
        "skill, number), pure cringe + brainrot.\n\n"
        '4. "enhanced": map each section\'s canonical_key to 4-6 bullets, '
        "8-18 words each. Each bullet must:\n"
        "   - Stack 2-3 buzzwords AND 1-2 brainrot terms.\n"
        "   - Use grandiose verbs (architected, engineered, weaponized, "
        "ascended, ohio-pilled, mogged).\n"
        "   - Invent fake metrics when the original had none "
        '(e.g. "+47% sigma throughput", "~3.2x rizz coefficient").\n'
        "   - Keep real companies/skills/dates intact.\n"
        "Examples:\n"
        '   "Wrote unit tests for the API" -> "Weaponized enterprise-tier '
        'test infra, slashing prod defects ~42%. NPCs filtered, sigma."\n'
        '   "Python, JavaScript" -> ["Python sigma grindset, decade+ '
        'production velocity, gigachad pipelines.", '
        '"JavaScript rizz-maxxed across hyperscale stacks, no cap."]\n'
        "Education/Languages: 2-3 bullets.\n\n"
        f"Candidate name (heuristic, may be wrong): {name or 'unknown'}\n\n"
        "CV BY SECTION:\n"
        f"{sections_block}"
    )

    try:
        kwargs = {
            "model": deployment,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 7000,
        }
        # gpt-5* and o-series are reasoning models. "low" gives noticeably
        # better satire/inflation than "minimal" while keeping cost modest.
        deployment_lower = deployment.lower()
        if any(prefix in deployment_lower for prefix in ("gpt-5", "o1", "o3", "o4")):
            kwargs["reasoning_effort"] = "low"
        resp = client.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
    except Exception:
        logging.exception("AI generate_roasts call failed")
        return None

    review = str(data.get("review", "")).strip()
    raw_popups = data.get("popups", []) if isinstance(data.get("popups"), list) else []
    popups = [str(p).strip() for p in raw_popups if str(p).strip()][:14]

    raw_identity = data.get("identity") if isinstance(data.get("identity"), dict) else {}
    identity = {
        k: str(raw_identity.get(k, "")).strip()
        for k in ("name", "title", "email", "phone", "linkedin", "github")
    }

    raw_enhanced = data.get("enhanced") if isinstance(data.get("enhanced"), dict) else {}
    enhanced: dict[str, list[str]] = {}
    for key, value in raw_enhanced.items():
        if not isinstance(value, list):
            continue
        bullets = [str(b).strip() for b in value if str(b).strip()]
        if bullets:
            enhanced[str(key).strip().lower()] = bullets[:8]

    if not review and not popups and not any(identity.values()) and not enhanced:
        return None
    return {
        "identity": identity,
        "review": review,
        "popups": popups,
        "enhanced": enhanced,
    }
