"""
Translate English source text into a Chinese draft and translated footnotes.
"""
from __future__ import annotations

import json
import math
import re
import time
from typing import Dict, List

from dashscope import Generation

from src.config import config
from src.output_utils import output_file_path


class BodyTranslator:
    """AI-backed translation helpers for the no-Chinese-draft flow."""

    def __init__(self) -> None:
        self.model_name = config.MODEL_NAME

    def translate_body_with_markers(
        self,
        english_text: str,
        footnotes: List[Dict[str, str]],
        citation_style: str = "GB/T 7714",
        output_dir: str | None = None,
    ) -> str:
        """
        Translate the English document body into Chinese.

        The model is instructed to preserve exact marker tokens like [[FN_12]]
        where the corresponding footnote should be inserted.
        """
        chunks = self._chunk_text_for_translation(english_text)
        translated_chunks: List[str] = []

        print(f"[STEP 3A] Translating Chinese body in {len(chunks)} chunk(s)...")

        for index, chunk in enumerate(chunks, start=1):
            print(f"[CHUNK {index}/{len(chunks)}] Translating body chunk...")
            prompt = self._build_body_prompt(chunk, footnotes, citation_style)
            translated = self._call_api(prompt)
            cleaned = self._strip_code_fences(translated).strip()
            if cleaned:
                translated_chunks.append(cleaned)
            if index < len(chunks):
                time.sleep(config.RATE_LIMIT_DELAY)

        combined = "\n\n".join(chunk for chunk in translated_chunks if chunk).strip()

        with open(output_file_path("translated_body.txt", output_dir), "w", encoding="utf-8") as file:
            file.write(combined)

        return combined

    def translate_footnotes(
        self,
        footnotes: List[Dict[str, str]],
        citation_style: str = "GB/T 7714",
        output_dir: str | None = None,
    ) -> List[Dict[str, str]]:
        """Translate English footnotes into Chinese citation strings."""
        if not footnotes:
            return []

        print("[STEP 3B] Translating footnotes...")

        batch_size = 10
        translated: List[Dict[str, str]] = []

        for start in range(0, len(footnotes), batch_size):
            batch = footnotes[start:start + batch_size]
            batch_num = start // batch_size + 1
            total_batches = math.ceil(len(footnotes) / batch_size)
            print(f"[BATCH {batch_num}/{total_batches}] Translating footnotes...")

            prompt = self._build_footnote_prompt(batch, citation_style)
            response = self._call_api(prompt)
            translated.extend(self._parse_json_list(response))

            if start + batch_size < len(footnotes):
                time.sleep(config.RATE_LIMIT_DELAY)

        with open(output_file_path("translated_footnotes.json", output_dir), "w", encoding="utf-8") as file:
            json.dump(translated, file, ensure_ascii=False, indent=2)

        return translated

    def build_marker_map(self, translated_footnotes: List[Dict[str, str]]) -> Dict[str, str]:
        """Return a marker name -> Chinese footnote content mapping."""
        marker_map: Dict[str, str] = {}
        for item in translated_footnotes:
            footnote_id = str(item.get("footnote_id", "")).strip()
            if not footnote_id:
                continue
            marker_map[f"FN_{footnote_id}"] = item.get("chinese_footnote", "")
        return marker_map

    def build_translation_table(
        self,
        translated_body: str,
        translated_footnotes: List[Dict[str, str]],
    ) -> List[Dict[str, str]]:
        """Build a lightweight alignment table for the auto-translation mode."""
        paragraphs = [para.strip() for para in translated_body.split("\n\n") if para.strip()]
        table: List[Dict[str, str]] = []

        for item in translated_footnotes:
            footnote_id = str(item.get("footnote_id", "")).strip()
            marker = f"[[FN_{footnote_id}]]"
            containing_paragraph = next((para for para in paragraphs if marker in para), "")
            table.append(
                {
                    "footnote_id": footnote_id,
                    "english_footnote": item.get("english_footnote", ""),
                    "chinese_footnote": item.get("chinese_footnote", ""),
                    "english_sentence": "",
                    "chinese_sentence": containing_paragraph.replace(marker, "").strip(),
                    "chinese_word": marker,
                    "context_before": "",
                    "context_after": "",
                    "word_occurrence": 1,
                    "confidence": item.get("confidence", 0.8),
                    "mode": "auto_translation",
                }
            )

        return table

    def _chunk_text_for_translation(self, text: str, max_chars: int = 4500) -> List[str]:
        """Chunk text on paragraph boundaries to keep translation prompts manageable."""
        paragraphs = [para.strip() for para in text.replace("\r\n", "\n").split("\n\n") if para.strip()]
        if not paragraphs:
            return [text]

        chunks: List[str] = []
        current: List[str] = []
        current_length = 0

        for paragraph in paragraphs:
            paragraph_length = len(paragraph)
            if current and current_length + paragraph_length + 2 > max_chars:
                chunks.append("\n\n".join(current))
                current = [paragraph]
                current_length = paragraph_length
            else:
                current.append(paragraph)
                current_length += paragraph_length + 2

        if current:
            chunks.append("\n\n".join(current))

        return chunks

    def _build_body_prompt(
        self,
        english_chunk: str,
        footnotes: List[Dict[str, str]],
        citation_style: str,
    ) -> str:
        footnotes_desc = "\n".join(
            f'- Footnote {item["id"]}: {item["content"]}'
            for item in footnotes
        )
        return f"""You are translating an English academic document into Chinese.

Task requirements:
1. Translate only the body content into natural academic Chinese.
2. Do NOT append a footnote list or bibliography section at the end.
3. When the translated body reaches a location that should receive a footnote, insert the exact marker token for that footnote, such as [[FN_3]].
4. Keep paragraph breaks from the source chunk.
5. Do not change the marker format. The marker must stay ASCII and exact, for example [[FN_3]].
6. The requested citation style for footnotes is {citation_style}. You only need to place markers in the body here.

Detected footnotes:
{footnotes_desc}

English source chunk:
{english_chunk}

Output only the translated Chinese body text, with markers inserted inline where needed.
Do not use JSON.
Do not use markdown fences."""

    def _build_footnote_prompt(self, footnotes: List[Dict[str, str]], citation_style: str) -> str:
        footnotes_desc = "\n".join(
            f'Footnote {item["id"]}: {item["content"]}'
            for item in footnotes
        )
        return f"""You are formatting translated academic footnotes.

Please translate the following English footnotes into Chinese and format them in {citation_style}.

Output JSON only:
[
  {{
    "footnote_id": "1",
    "english_footnote": "original English footnote",
    "chinese_footnote": "translated Chinese footnote",
    "confidence": 0.95
  }}
]

Footnotes:
{footnotes_desc}
"""

    def _call_api(self, prompt: str) -> str:
        """Call DashScope with retries."""
        for attempt in range(config.MAX_RETRIES):
            try:
                if attempt > 0:
                    time.sleep(config.RATE_LIMIT_DELAY)

                response = Generation.call(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    result_format="message",
                    temperature=config.GENERATION_CONFIG["temperature"],
                    max_tokens=config.GENERATION_CONFIG["max_tokens"],
                    top_p=config.GENERATION_CONFIG["top_p"],
                )

                if response.status_code == 200:
                    return response.output.choices[0].message.content

                raise RuntimeError(f"API error: {response.code} - {response.message}")
            except Exception as exc:
                print(
                    f"[WARNING] Translation API call failed: {exc} "
                    f"(attempt {attempt + 1}/{config.MAX_RETRIES})"
                )
                if attempt == config.MAX_RETRIES - 1:
                    raise
                time.sleep(config.RETRY_DELAY)

        raise RuntimeError("Translation API call failed after retries.")

    def _parse_json_list(self, response_text: str) -> List[Dict[str, str]]:
        cleaned = self._strip_code_fences(response_text).strip()
        if not cleaned.endswith("]"):
            last_complete = cleaned.rfind("}")
            if last_complete > 0:
                cleaned = cleaned[:last_complete + 1] + "\n]"

        data = json.loads(cleaned)
        if not isinstance(data, list):
            raise ValueError("Expected a JSON list response.")

        normalized: List[Dict[str, str]] = []
        for item in data:
            if "footnote_id" not in item:
                continue
            normalized.append(
                {
                    "footnote_id": str(item["footnote_id"]),
                    "english_footnote": item.get("english_footnote", ""),
                    "chinese_footnote": item.get("chinese_footnote", ""),
                    "confidence": item.get("confidence", 0.8),
                }
            )
        return normalized

    def _strip_code_fences(self, text: str) -> str:
        stripped = text.strip()
        stripped = re.sub(r"^```(?:json|text)?\s*", "", stripped, flags=re.IGNORECASE)
        stripped = re.sub(r"\s*```$", "", stripped)
        return stripped
