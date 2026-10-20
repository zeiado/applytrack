"""The real client IP behind reverse proxies.

Each trusted proxy appends the address it received the request from to
``X-Forwarded-For``, but keeps whatever the client sent. So only the entries added
by our own proxies can be trusted, counted from the right: with N proxies the
client is the Nth entry from the end. Anything further left may be forged.
"""

import ipaddress


def forwarded_for_entries(headers: list[str]) -> list[str]:
    """All X-Forwarded-For entries, in order, across repeated headers."""
    return [e.strip() for header in headers for e in header.split(",") if e.strip()]


def resolve_client_ip(peer: str, forwarded_for: list[str], trusted_hops: int) -> str:
    """The client's IP, given the connection's peer address and every X-Forwarded-For header.

    Falls back to ``peer`` when no hops are trusted, or the header is missing,
    too short or not an IP address.
    """
    if trusted_hops <= 0:
        return peer
    entries = forwarded_for_entries(forwarded_for)
    if len(entries) < trusted_hops:
        return peer
    try:
        return str(ipaddress.ip_address(entries[-trusted_hops]))
    except ValueError:
        return peer
