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
        "You are writing for ResuMeme, a satirical site that mocks "
        "LinkedIn-influencer-thought-leader culture by inflating ordinary "
        "CV content into maximum corporate cringe. Tone: self-aggrandizing "
        "humility, hashtag spam, unironic emoji, fake-deep observations, "
        "jargon (synergy, leverage, paradigm, ecosystem, value-add).\n\n"
        "STYLE RULE: Do not use em dashes (—) anywhere in your output. "
        "Use periods, commas, colons, or parentheses instead.\n\n"
        "Given the CV below, return JSON with EXACTLY these fields:\n\n"
        '1. "identity": object with these string fields (empty string if '
        "the CV does not contain it; never invent a value):\n"
        "   - name, title, email, phone, linkedin, github\n\n"
        '2. "review": a 130-word fake LinkedIn post written IN FIRST '
        "PERSON as if the candidate themselves posted it. MUST include: a "
        "humble-brag opener, reference 2-3 specifics from the CV, one "
        "fake-deep takeaway, a story-arc moment (\"I almost gave up...\"), "
        "7-9 hashtags, emoji throughout.\n\n"
        '3. "popups": EXACTLY 12 short (<70 chars) achievement popups in '
        "LinkedIn-cringe voice. Each leads with one emoji and references "
        "something SPECIFIC from the CV (real company, skill, number).\n\n"
        '4. "enhanced": object mapping each section\'s canonical_key '
        "(seen below) to an array of 4-7 bullet strings. Each bullet is "
        "a wildly inflated rewrite of the original content, transforming "
        "ordinary work into earth-shaking corporate impact. Lean into "
        "this: stack 2-3 buzzwords per bullet, invent grandiose verbs, "
        "imply transformative business outcomes, sprinkle in fake metrics "
        "where the original lacked numbers (e.g. \"reducing latency by "
        '~37%\"), and frame mundane tasks as paradigm shifts. Keep the '
        "real companies/skills/dates from the original (do NOT change "
        "those), but escalate everything else to peak corporate cringe. "
        "Bullets should be 12-25 words each, longer than the original. "
        "Examples:\n"
        '   - Original: "Wrote unit tests for the API"\n'
        '     Enhanced: "Architected enterprise-grade test infrastructure '
        "that fundamentally redefined the API quality vertical, slashing "
        'production defects by ~42% across cross-functional pods"\n'
        '   - Original skills: "Python, JavaScript"\n'
        '     Enhanced: ["Polyglot Python virtuoso (decade+ at production '
        "velocity, mission-critical pipelines, zero-downtime ethos)\", "
        '"JavaScript thought leader; full-stack ecosystem battle-tested '
        'across hyperscale frontends and stakeholder-facing dashboards"]\n'
        "   For one-line sections (Education, Languages) produce 2-4 "
        "bullets. The enhanced section has the SAME canonical_key shown "
        "below — match exactly.\n\n"
        f"Candidate name (heuristic guess, may be wrong): {name or 'unknown'}\n\n"
        "CV BY SECTION:\n"
        f"{sections_block}\n\n"
        "Reply with ONLY valid JSON, no markdown."
    )

    try:
        kwargs = {
            "model": deployment,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 9000,
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
