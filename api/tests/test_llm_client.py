import json
from types import SimpleNamespace

from shared import llm_client


def test_ai_request_is_bounded_and_not_retried(monkeypatch):
    client_options = {}
    request = {}
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"hero": {"bio": "ok"}})))],
        usage=None,
    )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            client_options.update(kwargs)

            def create(**create_kwargs):
                request.update(create_kwargs)
                return response

            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    monkeypatch.setattr(llm_client, "AzureOpenAI", FakeOpenAI)
    monkeypatch.setattr(llm_client, "_SDK_OK", True)
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.test")
    monkeypatch.setenv("AZURE_OPENAI_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "test-model")

    result = llm_client.generate_roasts(
        "x" * 10_000,
        "n" * 10_000,
        [{"heading": "Experience", "canonical": "experience", "body": "b" * 10_000}],
    )

    prompt = request["messages"][0]["content"]
    assert result is not None
    assert client_options["timeout"] == 25
    assert client_options["max_retries"] == 0
    assert "n" * 200 in prompt and "n" * 201 not in prompt
    assert len(prompt.split("CV BY SECTION:\n", 1)[1]) == 6000
