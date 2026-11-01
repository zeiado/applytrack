"""Compare job links: two links to the same job often differ only in tracking bits."""

from urllib.parse import parse_qsl, urlencode, urlsplit

# Query parameters that say how someone got to the page, not which job it is.
_TRACKING_PARAMS = frozenset(
    {
        "fbclid",
        "gclid",
        "msclkid",
        "ref",
        "refid",
        "ref_src",
        "source",
        "src",
        "trackingid",
        "trk",
        "trkinfo",
        "lipi",
        "originalsubdomain",
        "from",
        "eboffset",
        "position",
        "pagenum",
    }
)


def normalize_job_url(url: str | None) -> str | None:
    """A key that is the same for two links to the same job page, or None for no link.

    It lowercases the host, drops ``www.``, the fragment, a trailing slash and tracking
    parameters (``utm_*``, ``trk``, ``ref``, ...), and sorts the parameters left. A LinkedIn
    search page showing one job (``?currentJobId=123``) becomes that job's own page.
    """
    if not url or not url.strip():
        return None
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return None
    host = (parts.hostname or "").lower().removeprefix("www.")
    if not host:
        return None
    # Country subdomains of LinkedIn (eg.linkedin.com) show the same jobs.
    if host.endswith(".linkedin.com"):
        host = "linkedin.com"
    path = parts.path.rstrip("/") or "/"
    params = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=False)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_PARAMS
    ]
    if host == "linkedin.com" and path.startswith("/jobs"):
        job_id = next((v for k, v in params if k == "currentJobId" and v.isdigit()), None)
        if job_id:
            return f"linkedin.com/jobs/view/{job_id}"
        # A job's page is /jobs/view/<id> or /jobs/view/<title>-<id>; only the id matters.
        if path.startswith("/jobs/view/"):
            last = path.rsplit("/", 1)[-1].rsplit("-", 1)[-1]
            if last.isdigit():
                return f"linkedin.com/jobs/view/{last}"
    query = urlencode(sorted(params))
    return f"{host}{path}" + (f"?{query}" if query else "")
