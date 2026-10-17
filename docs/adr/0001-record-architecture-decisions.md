# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-10-17

## Context

Design choices get forgotten. Months later nobody remembers why a library or
pattern was picked, so it's hard to know whether changing it is safe.

## Decision

We record significant decisions as Architecture Decision Records (ADRs) in
`docs/adr/`, numbered in order, using the format by Michael Nygard:
Context, Decision, Consequences.

## Consequences

- New contributors can read the reasoning behind the codebase.
- Changing a decision means writing a new ADR that supersedes the old one,
  so history is kept.
