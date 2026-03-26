"""
Generate only the alignment table for manual review.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.ai_aligner import AIAligner
from src.document_reader import DocumentReader
from src.output_utils import ensure_output_dir, output_file_path


def main(english_file: str, chinese_file: str, citation_style: str = "GB/T 7714", output_dir: str | None = None) -> None:
    resolved_output_dir = ensure_output_dir(output_dir)

    print("\n" + "=" * 72)
    print("Auto-Cite Table Generator")
    print("=" * 72)
    print(f"[INFO] Output directory: {resolved_output_dir}")

    if not os.path.exists(english_file):
        raise FileNotFoundError(f"English source not found: {english_file}")
    if not os.path.exists(chinese_file):
        raise FileNotFoundError(f"Chinese draft not found: {chinese_file}")

    print("[STEP 1] Reading documents...")
    english_doc = DocumentReader.read_file(english_file)
    chinese_doc = DocumentReader.read_file(chinese_file)

    print("[STEP 2] Generating alignment table...")
    aligner = AIAligner()
    alignment_table = aligner.generate_alignment_table(
        english_doc["full_text"],
        chinese_doc["full_text"],
        english_footnotes={},
        citation_style=citation_style,
        output_dir=resolved_output_dir,
    )

    df = pd.DataFrame(alignment_table)
    excel_path = output_file_path("alignment_table.xlsx", resolved_output_dir)
    json_path = output_file_path("alignment_table.json", resolved_output_dir)

    df.to_excel(excel_path, index=False)
    with open(json_path, "w", encoding="utf-8") as file:
        json.dump(alignment_table, file, ensure_ascii=False, indent=2)

    print(f"[OK] Saved Excel: {excel_path}")
    print(f"[OK] Saved JSON: {json_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate only the alignment table")
    parser.add_argument("--english", required=True, help="Path to the English source file")
    parser.add_argument("--chinese", required=True, help="Path to the Chinese draft DOCX")
    parser.add_argument("--citation-style", default="GB/T 7714", help="Target citation style")
    parser.add_argument("--output-dir", help="Directory used for intermediate artifacts")

    args = parser.parse_args()
    try:
        main(
            english_file=args.english,
            chinese_file=args.chinese,
            citation_style=args.citation_style,
            output_dir=args.output_dir,
        )
    except Exception as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)
