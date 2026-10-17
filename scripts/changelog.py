"""Print one version's section of CHANGELOG.md (used as the GitHub Release notes).

python scripts/changelog.py 1.0.0
"""

import re
import sys
from pathlib import Path

CHANGELOG = Path(__file__).resolve().parents[1] / "CHANGELOG.md"


def section(text: str, version: str) -> str:
    """The body under `## [version]`, up to the next `## [` heading."""
    pattern = rf"^## \[{re.escape(version)}\][^\n]*\n(.*?)(?=^## \[|\Z)"
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    if match is None:
        raise SystemExit(f"CHANGELOG.md has no section for version {version}")
    body = match.group(1)
    # Drop the link definitions that live at the end of the file.
    body = re.sub(r"^\[[^\]]+\]: \S+\n?", "", body, flags=re.MULTILINE)
    return body.strip()


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    print(section(CHANGELOG.read_text(encoding="utf-8"), argv[1].removeprefix("v")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
