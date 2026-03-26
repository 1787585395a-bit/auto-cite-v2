"""
Read DOCX or PDF source files into a simple text structure.
"""
from __future__ import annotations

import os
from typing import Dict

import PyPDF2
from docx import Document


class DocumentReader:
    """Document reader with DOCX and PDF support."""

    @staticmethod
    def read_pdf(file_path: str) -> Dict:
        """Read PDF text page by page."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            with open(file_path, "rb") as file:
                pdf_reader = PyPDF2.PdfReader(file)
                paragraphs = []

                for page in pdf_reader.pages:
                    text = page.extract_text() or ""
                    if text.strip():
                        paragraphs.append(text.strip())

                full_text = "\n\n".join(paragraphs)
                return {
                    "paragraphs": paragraphs,
                    "full_text": full_text,
                    "has_footnotes": False,
                    "footnotes": {},
                }
        except Exception as exc:
            raise RuntimeError(f"Failed to read PDF: {exc}") from exc

    @staticmethod
    def read_docx(file_path: str) -> Dict:
        """Read DOCX paragraphs as plain text."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            doc = Document(file_path)
            paragraphs = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
            full_text = "\n\n".join(paragraphs)

            return {
                "paragraphs": paragraphs,
                "full_text": full_text,
                "has_footnotes": False,
                "footnotes": {},
            }
        except Exception as exc:
            raise RuntimeError(f"Failed to read DOCX: {exc}") from exc

    @staticmethod
    def read_file(file_path: str) -> Dict:
        """Dispatch to the correct reader based on file extension."""
        lower_path = file_path.lower()
        if lower_path.endswith(".pdf"):
            return DocumentReader.read_pdf(file_path)
        if lower_path.endswith(".docx"):
            return DocumentReader.read_docx(file_path)
        raise ValueError(f"Unsupported file format: {file_path}")
