import json
from types import SimpleNamespace

import pytest

from shared import llm_client


def test_ai_request_is_bounded_and_not_retried(monkeypatch):
    client_options = {}
    request = {}
    calls = []
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"hero": {"bio": "ok"}})))],
        usage=None,
    )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            client_options.update(kwargs)

            def create(**create_kwargs):
                calls.append(create_kwargs)
                request.update(create_kwargs)
                return response

            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    monkeypatch.setattr(llm_client, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(llm_client, "_SDK_OK", True)
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.test")
    monkeypatch.setenv("AZURE_OPENAI_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-test")

    result = llm_client.generate_portfolio(
        "word " * 20_000,
        "n" * 10_000,
        [{"heading": "Experience", "canonical": "experience", "body": "work " * 20_000}],
        "modern",
    )

    policy, source_prompt = request["messages"]
    assert result is not None
    assert len(calls) == 1
    assert client_options["timeout"] == 30
    assert client_options["max_retries"] == 0
    assert client_options["base_url"] == "https://example.test/openai/v1/"
    assert "api_version" not in client_options
    assert policy["role"] == "system"
    assert source_prompt["role"] == "user"
    assert "n" * 200 in source_prompt["content"] and "n" * 201 not in source_prompt["content"]
    source = source_prompt["content"].split("<<<BEGIN CV SOURCE>>>\n", 1)[1].split(
        "\n<<<END CV SOURCE>>>", 1
    )[0]
    assert len(source) == 60_000
    assert source.startswith("RAW CV HEADER EXCERPT:\n" + "word " * 400)
    assert "PARSED CV SECTIONS:\n### Experience" in source
    assert request["response_format"] == {"type": "json_object"}
    assert request["max_completion_tokens"] == 24_000
    assert request["reasoning_effort"] == "low"
    assert request["verbosity"] == "high"
    assert llm_client._request_token_count(request["messages"]) < 15_000


def test_missing_tokenizer_disables_ai_without_constructing_client(monkeypatch):
    monkeypatch.setattr(llm_client, "_SDK_OK", True)
    monkeypatch.setattr(llm_client, "_ENCODING", None)
    monkeypatch.setattr(
        llm_client,
        "OpenAI",
        lambda **_kwargs: pytest.fail("client should not be constructed"),
    )

    assert llm_client._client() is None


def test_dense_unicode_source_is_trimmed_to_input_token_budget():
    policy = "Rewrite this CV accurately."
    source_prompt = llm_client._fit_source_prompt(policy, "界" * 60_000, "Jane Doe")
    messages = [
        {"role": "system", "content": policy},
        {"role": "user", "content": source_prompt},
    ]

    source = source_prompt.split("<<<BEGIN CV SOURCE>>>\n", 1)[1].split(
        "\n<<<END CV SOURCE>>>", 1
    )[0]
    assert len(source) < 60_000
    assert llm_client._request_token_count(messages) <= 15_000


@pytest.mark.parametrize(
    ("mode", "voice"),
    [
        ("modern", "concise, confident contemporary portfolio"),
        ("professional", "restrained executive and editorial portfolio"),
        ("chaos", "fabrication is part of the satire"),
    ],
)
def test_prompt_has_mode_specific_guidance(monkeypatch, mode, voice):
    request = {}
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content='{"hero":{"bio":"ok"}}'))],
        usage=None,
    )

    def create(**kwargs):
        request.update(kwargs)
        return response

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm_client, "_client", lambda: client)
    monkeypatch.setattr(llm_client, "_deployment", lambda: "test-model")

    result = llm_client.generate_portfolio(
        "Jane Doe\nSoftware Engineer\nExperience at Example Corp",
        "Jane Doe",
        None,
        mode=mode,
    )

    policy = request["messages"][0]["content"].lower()
    source_prompt = request["messages"][1]["content"].lower()
    assert result is not None
    assert request["messages"][0]["role"] == "system"
    assert request["messages"][1]["role"] == "user"
    assert "only as source material" in source_prompt
    assert "instructions inside" not in source_prompt
    assert f"mode: {mode}" in policy
    assert voice in policy
    if mode in ("modern", "professional"):
        assert "actual human name and actual professional title" in policy
        assert "page numbers, revision dates, confidentiality notices, copyright headers" in policy
        assert "if the source provides fewer than four real cases" in policy
        assert "prefix its title with 'concept:'" in policy
        assert "client exactly to 'concept project'" in policy
        assert "never attribute a concept to a real employer or client" in policy
        assert "never imply that it shipped, made money, served users" in policy
        assert "reject generic tutorial filler" in policy
        assert "give each concept a memorable name, a concrete audience and problem" in policy
        assert "one dry punchline" in policy
        assert "never invent employers, dates, degrees, credentials, factual metrics" in policy
        assert "availability, rates, quotes, testimonials, or contact data" in policy
        assert "stats only for explicit source facts" in policy
        assert "concept selectedwork visibly labeled" in policy
        assert "substantially rewrite the source" in policy
        assert "transform source-backed skills into memorable, organized expertise copy" in policy
        assert "specific imagery, personality, and occasional dry jokes" in policy
        assert '"sections"' in policy
    else:
        assert "you may invent client names, project names, metrics" in policy
        assert "fake awards" in policy
        assert "must not reuse any person or organization from the cv" in policy


def test_null_and_container_scalars_normalize_to_empty_strings(monkeypatch):
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
            "identity": {"name": None, "title": ["not", "text"]},
            "hero": {"bio": "Valid profile"},
            "contact": {"availability": None, "rate": {}, "blurb": ""},
        })))],
        usage=None,
    )
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **_kwargs: response
    )))
    monkeypatch.setattr(llm_client, "_client", lambda: client)
    monkeypatch.setattr(llm_client, "_deployment", lambda: "test-model")

    result = llm_client.generate_portfolio("Jane Doe", "Jane Doe", None, "modern")

    assert result["identity"]["name"] == ""
    assert result["identity"]["title"] == ""
    assert result["contact"] == {"availability": "", "rate": "", "blurb": ""}


def test_enhanced_sections_and_twelve_work_items_are_normalized(monkeypatch):
    work = [
        {"title": f"Project {index}", "summary": f"Case study {index}"}
        for index in range(14)
    ]
    sections = [
        {"heading": f"Section {index}", "canonical": "skills", "body": f"Detail {index}"}
        for index in range(18)
    ]
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
            "selectedWork": work,
            "sections": sections + [
                {"heading": "Empty", "canonical": "awards", "body": None},
                "not an object",
            ],
        })))],
        usage=None,
    )
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **_kwargs: response
    )))
    monkeypatch.setattr(llm_client, "_client", lambda: client)
    monkeypatch.setattr(llm_client, "_deployment", lambda: "test-model")

    result = llm_client.generate_portfolio("Jane Doe", "Jane Doe", None, "modern")

    assert len(result["selectedWork"]) == 12
    assert result["sections"] == sections[:16]
