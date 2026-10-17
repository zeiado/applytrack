"""The Docker image must run a Python version that CI tests on."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_dockerfile_python_is_in_the_ci_matrix() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text()
    ci = (ROOT / ".github/workflows/ci.yml").read_text()

    image_versions = set(re.findall(r"^FROM python:(\d+\.\d+)", dockerfile, re.MULTILINE))
    matrix = re.search(r"python: \[(.*?)\]", ci)

    assert image_versions, "no python base image found in the Dockerfile"
    assert matrix, "no python matrix found in ci.yml"
    tested = set(re.findall(r'"(\d+\.\d+)"', matrix.group(1)))
    assert image_versions <= tested, (
        f"Dockerfile uses Python {sorted(image_versions)} but CI only tests {sorted(tested)}. "
        "Add the version to the matrix in .github/workflows/ci.yml."
    )
