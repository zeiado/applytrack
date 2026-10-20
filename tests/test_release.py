import importlib.util
import re
import tomllib
from pathlib import Path

import pytest

import applytrack

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("changelog", ROOT / "scripts" / "changelog.py")
assert _spec and _spec.loader
changelog = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(changelog)

SAMPLE = """# Changelog

## [Unreleased]

### Added
- Something new

## [1.1.0] - 2026-11-01

### Fixed
- A bug ([#40])

## [1.0.0] - 2026-10-20

### Added
- First release

[Unreleased]: https://example.com/compare/v1.1.0...HEAD
[#40]: https://example.com/pull/40
"""


def test_version_comes_from_pyproject() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["version"]

    assert applytrack.__version__ == project


def test_section_extracts_one_version() -> None:
    assert changelog.section(SAMPLE, "1.1.0") == "### Fixed\n- A bug ([#40])"
    assert changelog.section(SAMPLE, "1.0.0") == "### Added\n- First release"
    assert changelog.section(SAMPLE, "Unreleased") == "### Added\n- Something new"


def test_section_does_not_match_a_version_prefix() -> None:
    with pytest.raises(SystemExit, match=r"no section for version 1\.0$"):
        changelog.section(SAMPLE, "1.0")


def test_cli(
    capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    path = tmp_path / "CHANGELOG.md"
    path.write_text(SAMPLE)
    monkeypatch.setattr(changelog, "CHANGELOG", path)

    assert changelog.main(["changelog.py", "v1.0.0"]) == 0  # a leading "v" is accepted
    assert capsys.readouterr().out.strip() == "### Added\n- First release"
    assert changelog.main(["changelog.py"]) == 2


def test_real_changelog_is_well_formed() -> None:
    text = (ROOT / "CHANGELOG.md").read_text()

    changelog.section(text, "Unreleased")  # exists; empty right after a release
    headings = re.findall(r"^## \[([^\]]+)\]", text, re.MULTILINE)
    assert headings[0] == "Unreleased"
    for version in headings[1:]:
        assert re.fullmatch(r"\d+\.\d+\.\d+", version), version
    # every [#n] reference used in the text has a link definition
    used = set(re.findall(r"\[#(\d+)\](?!:)", text))
    defined = set(re.findall(r"^\[#(\d+)\]: ", text, re.MULTILINE))
    assert used <= defined, f"missing links for {sorted(used - defined)}"
