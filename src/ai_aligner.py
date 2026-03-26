"""
AI alignment helpers for the "existing Chinese draft" flow.
"""
from __future__ import annotations

import json
import re
import time
from typing import Dict, List

from dashscope import Generation

from src.config import config
from src.output_utils import output_file_path


class AIAligner:
    """Use DashScope to align English footnotes against an existing Chinese draft."""

    def __init__(self) -> None:
        print(f"[OK] AIAligner initialized with model: {config.MODEL_NAME}")

    def detect_footnotes(self, english_text: str, output_dir: str | None = None) -> List[Dict[str, str]]:
        """Public wrapper used by the auto-translation flow."""
        return self._detect_footnotes(english_text, output_dir=output_dir)

    def generate_alignment_table(
        self,
        english_text: str,
        chinese_text: str,
        english_footnotes=None,
        citation_style: str = "GB/T 7714",
        output_dir: str | None = None,
    ) -> List[Dict]:
        """
        Generate an alignment table in two stages:
        1. detect English footnotes
        2. align them against the Chinese draft in batches
        """
        print("\n[STEP 1] Preparing alignment inputs...")
        print(f"[INFO] English length: {len(english_text)} chars")
        print(f"[INFO] Chinese length: {len(chinese_text)} chars")

        if english_footnotes:
            footnotes_list = self._normalize_footnotes(english_footnotes)
            print(f"[STEP 2] Reusing {len(footnotes_list)} detected footnotes...")
        else:
            print("[STEP 2] Detecting English footnotes...")
            footnotes_list = self._detect_footnotes(english_text, output_dir=output_dir)

        print(f"[OK] Detected {len(footnotes_list)} footnotes.")
        if not footnotes_list:
            print("[WARNING] No footnotes detected.")
            return []

        print("[STEP 3] Aligning with the existing Chinese translation...")
        all_results: List[Dict] = []
        batch_size = 10

        for start in range(0, len(footnotes_list), batch_size):
            batch = footnotes_list[start:start + batch_size]
            batch_num = start // batch_size + 1
            total_batches = (len(footnotes_list) + batch_size - 1) // batch_size
            print(
                f"[BATCH {batch_num}/{total_batches}] "
                f"Footnotes {batch[0]['id']} - {batch[-1]['id']}"
            )

            try:
                batch_results = self._align_batch(
                    english_text,
                    chinese_text,
                    batch,
                    citation_style=citation_style,
                    output_dir=output_dir,
                )
                all_results.extend(batch_results)
                print(f"[OK] Batch {batch_num} returned {len(batch_results)} rows.")
            except Exception as exc:
                print(f"[WARNING] Batch {batch_num} failed: {exc}")

            if start + batch_size < len(footnotes_list):
                time.sleep(config.RATE_LIMIT_DELAY)

        print(f"[OK] Alignment finished with {len(all_results)} rows.")
        return all_results

    def _detect_footnotes(self, english_text: str, output_dir: str | None = None) -> List[Dict[str, str]]:
        """Detect English footnotes from the source text."""
        prompt = f"""Please identify all footnotes in the following English academic document.

English document:
{english_text}

Output JSON only:
[
  {{
    "id": "1",
    "content": "full English footnote text"
  }}
]

Rules:
1. Return only the footnotes, not the body paragraphs.
2. Keep the original footnote numbering.
3. Return JSON only, with no markdown fences.
"""

        response_text = self._call_api(prompt)
        with open(output_file_path("raw_response_detect.txt", output_dir), "w", encoding="utf-8") as file:
            file.write(response_text)
        return self._parse_simple_list(response_text)

    def _align_batch(
        self,
        english_text: str,
        chinese_text: str,
        batch: List[Dict[str, str]],
        citation_style: str = "GB/T 7714",
        output_dir: str | None = None,
    ) -> List[Dict]:
        footnotes_desc = "\n".join(
            f'Footnote {item["id"]}: {item["content"]}'
            for item in batch
        )
        ids_desc = ", ".join(item["id"] for item in batch)

        prompt = f"""You are aligning English academic footnotes to a Chinese translation.

Target citation style: {citation_style}
Only process the following footnotes: {ids_desc}

Detected footnotes:
{footnotes_desc}

English document:
{english_text}

Chinese document:
{chinese_text}

Return JSON only:
[
  {{
    "footnote_id": "1",
    "english_footnote": "original English footnote",
    "chinese_footnote": "translated Chinese footnote in the requested style",
    "english_sentence": "the full English sentence containing the citation",
    "chinese_sentence": "the aligned Chinese sentence",
    "chinese_word": "the Chinese word or short phrase after which the footnote should be inserted",
    "context_before": "up to 5 Chinese characters before chinese_word",
    "context_after": "up to 5 Chinese characters after chinese_word",
    "word_occurrence": 1,
    "confidence": 0.95
  }}
]

Rules:
1. context_before and context_after must come from the original Chinese document.
2. If the same chinese_word appears multiple times in the sentence, set word_occurrence.
3. Return JSON only with no markdown fences.
4. Every row must correspond to one of these footnotes only: {ids_desc}
"""

        response_text = self._call_api(prompt)
        return self._parse_response(response_text, output_dir=output_dir)

    def _parse_simple_list(self, response_text: str) -> List[Dict[str, str]]:
        """Parse the footnote-detection response."""
        try:
            cleaned = self._strip_code_fences(response_text)
            if not cleaned.endswith("]"):
                last_complete = cleaned.rfind("}")
                if last_complete > 0:
                    cleaned = cleaned[:last_complete + 1] + "\n]"
                    print("[WARNING] Footnote detection JSON was truncated. Auto-fixed trailing bracket.")

            data = json.loads(cleaned)
            if not isinstance(data, list):
                raise ValueError("Response is not a JSON list.")

            result: List[Dict[str, str]] = []
            for entry in data:
                if "id" in entry and "content" in entry:
                    result.append({"id": str(entry["id"]), "content": entry["content"]})
            return result
        except json.JSONDecodeError as exc:
            print(f"[ERROR] Footnote detection JSON parse failed: {exc}")
            print(f"[ERROR] Raw response preview: {response_text[:500]}")
            raise

    def _parse_response(self, response_text: str, output_dir: str | None = None) -> List[Dict]:
        """Parse the alignment response."""
        with open(output_file_path("raw_response.txt", output_dir), "a", encoding="utf-8") as file:
            file.write("\n---BATCH---\n")
            file.write(response_text)

        cleaned = self._strip_code_fences(response_text)
        if not cleaned.endswith("]"):
            last_complete = cleaned.rfind("}")
            if last_complete > 0:
                cleaned = cleaned[:last_complete + 1] + "\n]"
                print("[WARNING] Alignment JSON was truncated. Auto-fixed trailing bracket.")

        data = json.loads(cleaned)
        if not isinstance(data, list):
            raise ValueError("Alignment response is not a JSON list.")

        required_fields = [
            "footnote_id",
            "chinese_word",
            "context_before",
            "context_after",
            "chinese_sentence",
        ]
        for index, entry in enumerate(data, start=1):
            missing_fields = [field for field in required_fields if field not in entry]
            if missing_fields:
                print(f"[WARNING] Row {index} is missing fields: {missing_fields}")

        return data

    def _call_api(self, prompt: str) -> str:
        """Call DashScope with retries."""
        for attempt in range(config.MAX_RETRIES):
            try:
                if attempt > 0:
                    time.sleep(config.RATE_LIMIT_DELAY)

                response = Generation.call(
                    model=config.MODEL_NAME,
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
                    f"[WARNING] API call failed: {exc} "
                    f"(attempt {attempt + 1}/{config.MAX_RETRIES})"
                )
                if attempt == config.MAX_RETRIES - 1:
                    raise
                time.sleep(config.RETRY_DELAY)

        raise RuntimeError("API call failed after retries.")

    def _normalize_footnotes(self, english_footnotes) -> List[Dict[str, str]]:
        """Accept either dict or list input for detected footnotes."""
        if isinstance(english_footnotes, list):
            return [
                {"id": str(item["id"]), "content": item["content"]}
                for item in english_footnotes
                if "id" in item and "content" in item
            ]

        if isinstance(english_footnotes, dict):
            return [
                {"id": str(key), "content": value}
                for key, value in english_footnotes.items()
            ]

        raise ValueError("english_footnotes must be a dict or a list.")

    def _strip_code_fences(self, text: str) -> str:
        stripped = text.strip()
        stripped = re.sub(r"^```(?:json|text)?\s*", "", stripped, flags=re.IGNORECASE)
        stripped = re.sub(r"\s*```$", "", stripped)
        return stripped.strip()
