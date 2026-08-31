"""Direct Anthropic API replacement for the old ``emergentintegrations`` shim.

The app only ever used a tiny slice of ``emergentintegrations.llm.chat``:

    chat = LlmChat(api_key=..., session_id=..., system_message=...)
    chat.with_model("anthropic", "<model>")
    text = await chat.send_message(UserMessage(text=...))   # -> str

This module reproduces exactly that surface — single-shot — backed by the
official Anthropic SDK instead of Emergent's LLM proxy. Swapping the import
(`from utils.llm import LlmChat, UserMessage`) is all a caller needs.

It was text-only until Aug 2026, when the goods composer needed to read a
photo (`utils/item_vision.py`). ``UserMessage`` now takes an optional
``image_urls``; with none passed the request body is byte-for-byte what it
was, so no existing caller changed behaviour.

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
    """Stand-in for emergentintegrations' ``UserMessage``.

    Text-only by default, exactly as before. ``image_urls`` is additive:
    every existing call site constructs this with a single ``text=`` and
    keeps its old behaviour byte for byte.

    Images are passed to Anthropic BY URL rather than downloaded and
    base64-encoded here. The only images this is used on are our own
    Cloudinary deliveries, which are already public; fetching them into
    the API process to re-encode them would add a second network hop, a
    memory cost proportional to the photo, and a new place for a timeout
    to happen, in exchange for nothing.
    """

    def __init__(self, text: str = "", image_urls: list[str] | None = None) -> None:
        self.text = text or ""
        self.image_urls = [u for u in (image_urls or []) if u]


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

        # A bare string when there are no images, so a text-only call sends
        # the identical request body it sent before images existed.
        content: Any = user_message.text
        if getattr(user_message, "image_urls", None):
            content = [
                {"type": "image", "source": {"type": "url", "url": url}}
                for url in user_message.image_urls
            ]
            # Text AFTER the images: the instructions read as being about
            # the pictures above them, which is the order the model is
            # documented to handle best.
            content.append({"type": "text", "text": user_message.text})

        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": [{"role": "user", "content": content}],
        }
        if self.system_message:
            kwargs["system"] = self.system_message

        resp = await self._client.messages.create(**kwargs)
        # Concatenate the text blocks, matching the old single-string return.
        return "".join(
            block.text for block in resp.content if getattr(block, "type", None) == "text"
        )
