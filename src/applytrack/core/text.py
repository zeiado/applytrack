"""Plain text from what people paste or tools send: job descriptions, often HTML."""

import re
from html import unescape
from html.parser import HTMLParser

# Only real markup counts as HTML, so text like "<5 years" or "a < b" is left alone.
_TAG = re.compile(
    r"</?(p|br|div|span|li|ul|ol|h[1-6]|strong|b|i|em|u|a|table|tr|td|th|section|font)\b[^>]*>",
    re.IGNORECASE,
)
_BLOCKS = {
    "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6",
    "table", "tr", "section", "article", "header", "footer", "blockquote", "pre",
}  # fmt: skip
_SKIPPED = {"script", "style", "noscript", "template"}


class _TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIPPED:
            self._skipping += 1
        elif tag == "br":
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("\n- ")
        elif tag in _BLOCKS:
            self.parts.append("\n\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIPPED:
            self._skipping = max(0, self._skipping - 1)
        elif tag in _BLOCKS and tag != "li":  # list items are one line each
            self.parts.append("\n\n")

    def handle_data(self, data: str) -> None:
        if not self._skipping:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    collector = _TextCollector()
    collector.feed(html)
    collector.close()
    return "".join(collector.parts)


def plain_text(value: str) -> str:
    """HTML becomes text (twice, for HTML sent escaped); then spaces are tidied: one space
    between words, no space at line ends, at most one empty line in a row."""
    for _ in range(2):
        if _TAG.search(value):
            value = html_to_text(value)
        elif _TAG.search(unescape(value)):
            value = html_to_text(unescape(value))
        else:
            break
    lines = [" ".join(line.split()) for line in value.splitlines()]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()
