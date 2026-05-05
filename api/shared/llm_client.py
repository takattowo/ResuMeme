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
        "leverage, paradigm, ecosystem, value-add) COLLIDING with brainrot "
        "slang (skibidi, sigma, rizz, gyatt, mewing, fanum tax, ohio, "
        "gigachad, looksmaxxed, mogged, NPC, no cap, goated, bussin, "
        "type beat). Mix both. Loud, explosive, deadpan-absurd.\n\n"
        "HUMOR TACTICS to use across the output:\n"
        "  - Punchline structure: build pompous corporate phrasing, then "
        "cut to a brainrot/dumb tag at the end.\n"
        "  - Suspiciously specific metrics: \"+47.3% sigma throughput\", "
        '"~3.2x rizz coefficient", "saved 0.8 stakeholder-years per quarter".\n'
        "  - Mundane-to-cosmic escalation: trivial tasks framed as paradigm "
        "shifts, civilizational milestones, or geopolitical victories.\n"
        "  - Deadpan oxymorons: \"strategic chaos\", \"calm grindset\", "
        '"humble GIGACHAD energy", "compliant ohio behavior".\n'
        "  - Fake awards/quotes: \"recipient of the 2024 Linkedin Most "
        'Hashtag Award", "as quoted in nobody\'s memo".\n'
        "  - Callbacks: occasionally reference an earlier bullet\'s claim.\n\n"
        "RULES: No em dashes. Never invent companies/skills/dates. "
        "Output ONLY valid JSON, no markdown.\n\n"
        "JSON fields:\n\n"
        '1. "identity": {name, title, email, phone, linkedin, github}. '
        "Empty string if absent. Never invent.\n\n"
        '2. "review": ~140-word first-person fake LinkedIn post by the '
        "candidate. Humble-brag opener, 2-3 CV specifics, one fake-deep "
        '("almost gave up") moment with absurd resolution, 2 brainrot terms '
        "slipped in, one suspiciously specific metric, 8-10 hashtags, emoji "
        "throughout.\n\n"
        '3. "popups": 12 short (<70 chars) achievement popups. Each starts '
        "with one emoji, references a real CV item (company, skill, number), "
        "pure cringe + brainrot. Vary tone: half are flexes, half are "
        "deadpan absurd ('🦴 Bones officially mogged').\n\n"
        '4. "enhanced": map each section\'s canonical_key to 4-6 bullets. '
        "Vary bullet length deliberately for rhythm:\n"
        "   - Mix 1-2 SHORT punchy bullets (6-12 words) per section.\n"
        "   - Mix 2-4 LONG absurd bullets (18-32 words) per section, "
        "with at least one buildup-and-punchline structure.\n"
        "Every bullet must:\n"
        "   - Stack 2-3 buzzwords AND 1-2 brainrot terms.\n"
        "   - Use grandiose verbs (architected, weaponized, ascended, "
        "ohio-pilled, mogged, championed, evangelized, operationalized).\n"
        "   - Invent fake metrics when the original lacked numbers.\n"
        "   - Keep real companies/skills/dates intact.\n"
        "Examples:\n"
        '   short: "Weaponized enterprise-tier test infra. NPCs filtered, sigma."\n'
        '   long:  "Architected paradigm-shifting test ecosystem at <Company>, '
        "slashing prod defects ~42.7% across cross-functional pods, eventually "
        'ascending past the concept of bugs entirely. Recruiters wept. Goated."\n'
        '   short: "Python sigma grindset. Decade-plus, gigachad pipelines."\n'
        '   long:  "JavaScript rizz-maxxed across hyperscale frontends, '
        "battle-tested through three reorgs and one company-wide rebrand, "
        'culminating in a Slack message my manager called "concerning". No cap."\n'
        "Education/Languages: 2-3 bullets, can be shorter overall.\n\n"
        f"Candidate name (heuristic, may be wrong): {name or 'unknown'}\n\n"
        "CV BY SECTION:\n"
        f"{sections_block}"
    )

    try:
        kwargs = {
            "model": deployment,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 8500,
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
