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
    """Generate a satirical 'sigma founder' portfolio from a real CV.

    The CV input becomes raw material for an absurdly inflated personal
    portfolio site (hero bio, fake case studies, fake testimonials, vanity
    stats, contact block). Returns dict with keys identity, popups, hero,
    stats, selectedWork, testimonials, contact — or None on any failure.
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
        "You write for ResuMeme: satire that converts a real CV into an "
        "ABSURD personal portfolio site for a self-styled sigma founder / "
        "thought leader. Voice = corporate jargon (synergy, leverage, "
        "paradigm, ecosystem, value-add, north star) COLLIDING with Gen-Z "
        "brainrot (skibidi, sigma, rizz, gyatt, mewing, fanum tax, ohio, "
        "gigachad, looksmaxxed, mogged, NPC, no cap, goated, bussin, type "
        "beat). Mix both. Loud, explosive, deadpan-absurd.\n\n"
        "HUMOR TACTICS to use across the output:\n"
        "  - Punchline structure: build pompous corporate phrasing, then "
        "cut to a brainrot/dumb tag at the end.\n"
        "  - Suspiciously specific metrics: \"+47.3% sigma throughput\", "
        '"~3.2x rizz coefficient", "saved 0.8 stakeholder-years per quarter".\n'
        "  - Mundane-to-cosmic escalation: trivial tasks framed as paradigm "
        "shifts, civilizational milestones, geopolitical victories.\n"
        "  - Deadpan oxymorons: \"strategic chaos\", \"calm grindset\", "
        '"humble GIGACHAD energy", "compliant ohio behavior".\n'
        "  - Fake awards/recognitions and self-mythologizing. Callbacks "
        "between sections (a stat references a case study, a testimonial "
        "echoes a metric).\n\n"
        "RULES: No em dashes. Keep real companies/skills/dates/proper-nouns "
        "intact when present in the source CV. You MAY invent client names, "
        "project names, metrics, awards, and testimonial authors. Never "
        "claim degrees from real institutions. Output ONLY valid JSON, no "
        "markdown.\n\n"
        "JSON SCHEMA (top level keys exactly):\n\n"
        '1. "identity": {name, title, tagline, email, phone, linkedin, '
        "github}.\n"
        "   - name: the candidate's REAL HUMAN NAME, copied verbatim from "
        "the CV. NEVER a job title. NEVER invented. NEVER prefixed with "
        '"Founder", "CEO", "Chief", "VP", "Lead", "Head of", "Architect of". '
        "If you cannot identify a clear human name in the CV, return empty "
        "string.\n"
        "   - title: a satirical sigma founder title you invent "
        "(\"Founder & CEO of Vibes\", \"Chief Synergy Officer\", "
        "\"Lead Architect of Disruption\"). This is the ONLY place to put "
        "an invented title. Never put it in the name field.\n"
        "   - tagline: one short brainrot + corporate line (under 80 chars).\n"
        "   - email/phone/linkedin/github: copy from CV verbatim, empty "
        "string if absent. Never invent.\n\n"
        '2. "popups": 12-14 short (<70 chars) achievement popups. Each '
        "starts with one emoji, references a real CV item (company, "
        "skill, number) or a portfolio fake (case study, metric). Cringe "
        "+ brainrot. Vary tone: half flex, half deadpan absurd.\n\n"
        '3. "hero": {bio}. bio is ~70-100 words, third-person sigma '
        "founder bio. Open with grandiose self-mythology, weave in 1-2 "
        "real CV specifics (company, skill, school), end on an absurd "
        "punchline. Mix 2-3 buzzwords with 2-3 brainrot terms.\n\n"
        '4. "stats": array of 5-6 absurd vanity-metric strings, each '
        "<60 chars. Examples: \"$4.2B+ revenue impact (allegedly)\", "
        '"17 unicorns shipped", "94 NDAs signed", "0 NPCs hired". Mix '
        "real CV numbers (years experience, language counts) inflated to "
        "civilizational scale with pure fiction.\n\n"
        '5. "selectedWork": array of 4-5 case-study objects. Each: '
        "{title, client, role, year, summary, metrics, tags}.\n"
        "   - title: invented project codename (\"Project Skibidi\", "
        "\"Operation Synergy Ascension\", \"The Rizz Matrix\").\n"
        "   - client: a fake but plausibly grandiose client (\"Fortune 50 "
        "Beverage Conglomerate\", \"undisclosed sovereign wealth fund\", "
        "\"a unicorn currently in stealth\"). If the source CV lists a real "
        "company, use it once and label the rest as fake clients.\n"
        "   - role: the candidate's role, inflated. Use real CV role "
        "wording where present, escalated.\n"
        "   - year: a 4-digit year inferred from CV dates if available, "
        "else a recent year (2021-2025).\n"
        "   - summary: 2-3 sentence absurd case study. Builds pompous, "
        "ends on punchline.\n"
        "   - metrics: 3 short metric strings (<50 chars each), at least "
        "one with a suspiciously specific decimal.\n"
        "   - tags: 3-5 short tags mixing tech buzzwords (AI, blockchain, "
        "edge, GraphQL) and brainrot tags (sigma, rizz-ops, ohio-grade).\n"
        "   IMPORTANT: ground each entry in a real CV experience or skill "
        "where possible. Real bullet about unit tests becomes a case study "
        "about \"weaponizing enterprise QA infra\", etc.\n\n"
        '6. "testimonials": array of 4-5 testimonial objects. Each: '
        "{quote, author, role, company}.\n"
        "   - quote: 1-2 sentences of absurd glazing. Mix corporate praise "
        "with brainrot (\"His rizz is, frankly, ohio-grade. We promoted him "
        "twice on the spot.\"). Reference a real CV detail when possible.\n"
        "   - author: a fake plausible name.\n"
        "   - role: a senior fake role (\"VP of Synergy\", \"Former "
        "Chief of Staff\", \"Series B angel investor\").\n"
        "   - company: a fake but plausible company name OR \"undisclosed\" "
        "/ \"stealth\". Do NOT put real CV companies in fake quotes.\n\n"
        '7. "contact": {availability, rate, blurb}.\n'
        "   - availability: short status line (\"Booked through Q3 2027\", "
        "\"Currently mogging at capacity\").\n"
        "   - rate: an absurd rate (\"$4500/hr discovery call (sigmas "
        "negotiable)\", \"3 unicorn equity points minimum\").\n"
        "   - blurb: 1-2 sentence call-to-action with brainrot energy.\n\n"
        "Use the candidate's real CV below as the source of truth for "
        "identity fields, real companies, real skills, real numbers. "
        "Inflate everything around them.\n\n"
        f"Candidate name (heuristic, may be wrong): {name or 'unknown'}\n\n"
        "CV BY SECTION:\n"
        f"{sections_block}"
    )

    try:
        kwargs = {
            "model": deployment,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 12000,
        }
        deployment_lower = deployment.lower()
        if any(prefix in deployment_lower for prefix in ("gpt-5", "o1", "o3", "o4")):
            kwargs["reasoning_effort"] = "low"
        resp = client.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
    except Exception:
        logging.exception("AI generate_roasts call failed")
        return None

    usage_obj = getattr(resp, "usage", None)
    details = getattr(usage_obj, "completion_tokens_details", None) if usage_obj else None
    usage = {
        "prompt_tokens": getattr(usage_obj, "prompt_tokens", None) if usage_obj else None,
        "completion_tokens": getattr(usage_obj, "completion_tokens", None) if usage_obj else None,
        "total_tokens": getattr(usage_obj, "total_tokens", None) if usage_obj else None,
        "reasoning_tokens": getattr(details, "reasoning_tokens", None) if details else None,
    }
    logging.info(
        "ai_usage prompt=%s completion=%s reasoning=%s total=%s",
        usage["prompt_tokens"], usage["completion_tokens"],
        usage["reasoning_tokens"], usage["total_tokens"],
    )

    raw_identity = data.get("identity") if isinstance(data.get("identity"), dict) else {}
    identity = {
        k: str(raw_identity.get(k, "")).strip()
        for k in ("name", "title", "tagline", "email", "phone", "linkedin", "github")
    }

    raw_popups = data.get("popups", []) if isinstance(data.get("popups"), list) else []
    popups = [str(p).strip() for p in raw_popups if str(p).strip()][:14]

    raw_hero = data.get("hero") if isinstance(data.get("hero"), dict) else {}
    hero = {"bio": str(raw_hero.get("bio", "")).strip()}

    raw_stats = data.get("stats", []) if isinstance(data.get("stats"), list) else []
    stats = [str(s).strip() for s in raw_stats if str(s).strip()][:6]

    raw_work = data.get("selectedWork", []) if isinstance(data.get("selectedWork"), list) else []
    selected_work: list[dict] = []
    for entry in raw_work:
        if not isinstance(entry, dict):
            continue
        metrics = entry.get("metrics") if isinstance(entry.get("metrics"), list) else []
        tags = entry.get("tags") if isinstance(entry.get("tags"), list) else []
        item = {
            "title": str(entry.get("title", "")).strip(),
            "client": str(entry.get("client", "")).strip(),
            "role": str(entry.get("role", "")).strip(),
            "year": str(entry.get("year", "")).strip(),
            "summary": str(entry.get("summary", "")).strip(),
            "metrics": [str(m).strip() for m in metrics if str(m).strip()][:4],
            "tags": [str(t).strip() for t in tags if str(t).strip()][:6],
        }
        if item["title"] or item["summary"]:
            selected_work.append(item)
    selected_work = selected_work[:5]

    raw_test = data.get("testimonials", []) if isinstance(data.get("testimonials"), list) else []
    testimonials: list[dict] = []
    for entry in raw_test:
        if not isinstance(entry, dict):
            continue
        quote = str(entry.get("quote", "")).strip()
        if not quote:
            continue
        testimonials.append({
            "quote": quote,
            "author": str(entry.get("author", "")).strip(),
            "role": str(entry.get("role", "")).strip(),
            "company": str(entry.get("company", "")).strip(),
        })
    testimonials = testimonials[:5]

    raw_contact = data.get("contact") if isinstance(data.get("contact"), dict) else {}
    contact = {
        "availability": str(raw_contact.get("availability", "")).strip(),
        "rate": str(raw_contact.get("rate", "")).strip(),
        "blurb": str(raw_contact.get("blurb", "")).strip(),
    }

    if (not any(identity.values()) and not popups and not hero["bio"]
            and not stats and not selected_work and not testimonials):
        return None
    return {
        "identity": identity,
        "popups": popups,
        "hero": hero,
        "stats": stats,
        "selectedWork": selected_work,
        "testimonials": testimonials,
        "contact": contact,
        "_usage": usage,
    }
