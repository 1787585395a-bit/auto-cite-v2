"""
Run the full Auto-Cite pipeline.

Modes:
1. English source + existing Chinese DOCX -> align and insert footnotes
2. English source only -> generate Chinese body, then insert footnotes
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.ai_aligner import AIAligner
from src.body_translator import BodyTranslator
from src.docx_builder import build_docx_from_text
from src.document_reader import DocumentReader
from src.footnote_inserter import FootnoteInserter
from src.output_utils import ensure_output_dir, output_file_path
from src.validator import FootnoteValidator


def save_alignment_outputs(alignment_table, output_dir: str) -> tuple[str, str]:
    """Persist JSON and Excel artifacts for the frontend and manual review."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    df = pd.DataFrame(alignment_table)
    excel_path = output_file_path(f"alignment_table_{timestamp}.xlsx", output_dir)
    json_path = output_file_path("alignment_table.json", output_dir)

    df.to_excel(excel_path, index=False)
    with open(json_path, "w", encoding="utf-8") as file:
        json.dump(alignment_table, file, ensure_ascii=False, indent=2)

    print(f"[OK] Saved Excel: {excel_path}")
    print(f"[OK] Saved JSON: {json_path}")
    return excel_path, json_path


def write_validation_report(report: dict, output_dir: str) -> str:
    """Save the validation summary."""
    report_path = output_file_path("validation_report.txt", output_dir)
    with open(report_path, "w", encoding="utf-8") as file:
        file.write("Validation Report\n")
        file.write(f"Total: {report['total']}\n")
        file.write(f"Correct: {report['correct']}\n")
        file.write(f"Incorrect: {report['incorrect']}\n")
        file.write(f"Missing: {report['missing']}\n")

    print(f"[OK] Saved validation report: {report_path}")
    return report_path


def process_with_existing_translation(
    english_file: str,
    chinese_file: str,
    output_docx: str,
    citation_style: str,
    output_dir: str,
) -> dict:
    """Original mode: align against an existing Chinese DOCX draft."""
    print("[MODE] Existing Chinese translation provided.")
    print("[STEP 1] Reading documents...")
    english_doc = DocumentReader.read_file(english_file)
    chinese_doc = DocumentReader.read_file(chinese_file)

    aligner = AIAligner()
    alignment_table = aligner.generate_alignment_table(
        english_doc["full_text"],
        chinese_doc["full_text"],
        english_footnotes={},
        citation_style=citation_style,
        output_dir=output_dir,
    )

    print("[STEP 4] Saving review artifacts...")
    excel_path, _ = save_alignment_outputs(alignment_table, output_dir)

    print("[STEP 5] Inserting footnotes into the Chinese DOCX...")
    inserter = FootnoteInserter(chinese_file)
    insertion_result = inserter.insert_from_table(alignment_table)
    print(f"[OK] Inserted footnotes: {len(insertion_result['success'])}")
    if insertion_result["failed"]:
        print(f"[WARNING] Failed insertions: {len(insertion_result['failed'])}")
        for failed in insertion_result["failed"]:
            print(f"[WARNING] {failed['id']}: {failed['reason']}")

    inserter.save(output_docx)

    print("[STEP 6] Validating output...")
    report = FootnoteValidator.validate(output_docx, alignment_table)
    FootnoteValidator.print_report(report)
    report_path = write_validation_report(report, output_dir)

    return {
        "alignment_table": alignment_table,
        "excel_path": excel_path,
        "report_path": report_path,
    }


def process_with_auto_translation(
    english_file: str,
    output_docx: str,
    citation_style: str,
    output_dir: str,
) -> dict:
    """New mode: generate Chinese body first, then insert translated footnotes."""
    print("[MODE] No Chinese translation provided. Generating one automatically.")
    print("[STEP 1] Reading English source...")
    english_doc = DocumentReader.read_file(english_file)

    aligner = AIAligner()
    footnotes = aligner.detect_footnotes(english_doc["full_text"], output_dir=output_dir)
    with open(output_file_path("detected_footnotes.json", output_dir), "w", encoding="utf-8") as file:
        json.dump(footnotes, file, ensure_ascii=False, indent=2)

    translator = BodyTranslator()
    translated_body = translator.translate_body_with_markers(
        english_doc["full_text"],
        footnotes,
        citation_style=citation_style,
        output_dir=output_dir,
    )
    if not translated_body.strip():
        raise RuntimeError("The translated Chinese body is empty.")

    translated_footnotes = translator.translate_footnotes(
        footnotes,
        citation_style=citation_style,
        output_dir=output_dir,
    )
    if footnotes and len(translated_footnotes) != len(footnotes):
        print(
            "[WARNING] The translated footnote count does not match the detected "
            f"footnote count ({len(translated_footnotes)} vs {len(footnotes)})."
        )

    alignment_table = translator.build_translation_table(translated_body, translated_footnotes)

    print("[STEP 4] Saving review artifacts...")
    excel_path, _ = save_alignment_outputs(alignment_table, output_dir)

    draft_docx_path = output_file_path("translated_body_draft.docx", output_dir)
    print("[STEP 5] Building translated DOCX draft...")
    build_docx_from_text(translated_body, draft_docx_path)

    if translated_footnotes:
        marker_map = translator.build_marker_map(translated_footnotes)
        inserter = FootnoteInserter(draft_docx_path)
        insertion_result = inserter.insert_from_markers(marker_map)
        print(f"[OK] Inserted markers as footnotes: {len(insertion_result['success'])}")
        if insertion_result["failed"]:
            print(f"[WARNING] Failed marker insertions: {len(insertion_result['failed'])}")
            for failed in insertion_result["failed"]:
                print(f"[WARNING] {failed['id']}: {failed['reason']}")
        inserter.save(output_docx)
    else:
        shutil.copyfile(draft_docx_path, output_docx)
        print("[INFO] No footnotes were detected. Saved translated DOCX without footnotes.")

    print("[STEP 6] Validating output...")
    report = FootnoteValidator.validate(output_docx, alignment_table)
    FootnoteValidator.print_report(report)
    report_path = write_validation_report(report, output_dir)

    return {
        "alignment_table": alignment_table,
        "excel_path": excel_path,
        "report_path": report_path,
    }


def main(english_file: str, output_docx: str, chinese_file: str | None = None, citation_style: str = "GB/T 7714", output_dir: str | None = None):
    """CLI entrypoint."""
    resolved_output_dir = ensure_output_dir(output_dir)

    print("\n" + "=" * 72)
    print("Auto-Cite V2 Pipeline")
    print("=" * 72)
    print(f"[INFO] Output directory: {resolved_output_dir}")
    print(f"[INFO] Citation style: {citation_style}")

    try:
        if chinese_file:
            result = process_with_existing_translation(
                english_file=english_file,
                chinese_file=chinese_file,
                output_docx=output_docx,
                citation_style=citation_style,
                output_dir=resolved_output_dir,
            )
        else:
            result = process_with_auto_translation(
                english_file=english_file,
                output_docx=output_docx,
                citation_style=citation_style,
                output_dir=resolved_output_dir,
            )

        alignment_table = result["alignment_table"]
        total = len(alignment_table)

        print("\n" + "=" * 72)
        print("[DONE] Processing complete.")
        print("=" * 72)
        print(f"[INFO] Output DOCX: {output_docx}")
        print(f"[INFO] Alignment Excel: {result['excel_path']}")
        print(f"[INFO] Validation report: {result['report_path']}")
        if total:
            print(f"[INFO] Total footnotes: {total}")

    except Exception as exc:
        print(f"\n[ERROR] {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Auto-Cite full pipeline")
    parser.add_argument("--english", required=True, help="Path to the English source file (.docx or .pdf)")
    parser.add_argument("--chinese", help="Optional path to the Chinese DOCX draft")
    parser.add_argument("--output", required=True, help="Path to the output DOCX file")
    parser.add_argument("--citation-style", default="GB/T 7714", help="Target citation style")
    parser.add_argument("--output-dir", help="Directory used for intermediate artifacts")

    args = parser.parse_args()
    main(
        english_file=args.english,
        chinese_file=args.chinese,
        output_docx=args.output,
        citation_style=args.citation_style,
        output_dir=args.output_dir,
    )
