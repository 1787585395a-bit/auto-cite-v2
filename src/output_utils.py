"""
Output directory helpers.
"""
from __future__ import annotations

import os


def ensure_output_dir(output_dir: str | None = None) -> str:
    """Create and return the output directory path."""
    resolved = output_dir or os.environ.get("AUTO_CITE_OUTPUT_DIR") or "outputs"
    os.makedirs(resolved, exist_ok=True)
    return resolved


def output_file_path(filename: str, output_dir: str | None = None) -> str:
    """Return an absolute-ish path under the output directory."""
    return os.path.join(ensure_output_dir(output_dir), filename)
