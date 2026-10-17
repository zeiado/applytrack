"""ApplyTrack: track job applications, interviews and follow-ups."""

from importlib.metadata import PackageNotFoundError, version

try:
    # The single source of truth is `version` in pyproject.toml.
    __version__ = version("applytrack")
except PackageNotFoundError:  # pragma: no cover - only when running from an uninstalled checkout
    __version__ = "0.0.0+unknown"
