"""Direct Anthropic API replacement for the old ``emergentintegrations`` shim.

The app only ever used a tiny slice of ``emergentintegrations.llm.chat``:

    chat = LlmChat(api_key=..., session_id=..., system_message=...)
    chat.with_model("anthropic", "<model>")
    text = await chat.send_message(UserMessage(text=...))   # -> str

This module reproduces exactly that surface — text-only, single-shot — backed
by the official Anthropic SDK instead of Emergent's LLM proxy. Swapping the
import (`from utils.llm import LlmChat, UserMessage`) is all a caller needs.

The API key is read from ``ANTHROPIC_API_KEY`` (env or explicit). A stray
Emergent key (``sk-emergent-…``) is ignored — it means nothing to Anthropic.
"""
import os
from typing import Any

from anthropic import AsyncAnthropic

# Only used when a caller never calls .with_model(); every real call site does.
_DEFAULT_MODEL = "claude-sonnet-4-6"
# Generous cap for translations / structured extraction. Non-streaming at this
# size stays comfortably under the SDK's HTTP-timeout guard.
_DEFAULT_MAX_TOKENS = 16000


class UserMessage:
    """Text-only stand-in for emergentintegrations' ``UserMessage``."""

    def __init__(self, text: str = "") -> None:
        self.text = text or ""


class LlmChat:
    """Drop-in replacement for ``emergentintegrations.llm.chat.LlmChat``.

    Only the surface the app actually used is implemented. The client is
    created lazily on first ``send_message`` so constructing the object never
    requires a key (matches the old lazy-failure behaviour).
    """

    def __init__(self, api_key: str = "", session_id: str = "", system_message: str = "") -> None:
        # Prefer an explicitly-passed real Anthropic key; otherwise fall back
        # to the environment. Emergent keys are treated as "no key".
        passed = api_key or ""
        self._api_key = passed if passed.startswith("sk-ant-") else os.environ.get("ANTHROPIC_API_KEY", "")
        self.system_message = system_message or ""
        self.session_id = session_id  # kept for signature compatibility; unused
        self.model = _DEFAULT_MODEL
        self.max_tokens = _DEFAULT_MAX_TOKENS
        self._client: AsyncAnthropic | None = None

    def with_model(self, provider: str, model: str) -> "LlmChat":
        # `provider` is always Anthropic here; kept so call sites read verbatim.
        self.model = model
        return self

    def with_params(self, **params: Any) -> "LlmChat":
        if "max_tokens" in params and params["max_tokens"]:
            self.max_tokens = int(params["max_tokens"])
        return self

    async def send_message(self, user_message: UserMessage) -> str:
        if self._client is None:
            self._client = AsyncAnthropic(api_key=self._api_key or None)

        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": [{"role": "user", "content": user_message.text}],
        }
        if self.system_message:
            kwargs["system"] = self.system_message

        resp = await self._client.messages.create(**kwargs)
        # Concatenate the text blocks, matching the old single-string return.
        return "".join(
            block.text for block in resp.content if getattr(block, "type", None) == "text"
        )
