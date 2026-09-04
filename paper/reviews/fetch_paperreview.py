#!/usr/bin/env python3
"""Fetch a paperreview.ai review by token and archive it as JSON and Markdown.

Usage:
    python3 paper/reviews/fetch_paperreview.py <round-number>
    python3 paper/reviews/fetch_paperreview.py <round-number> --from-file saved.json

Reads reviews/round<N>.token, then GETs /api/review/<token>. Exits 2 while the
review is still generating (HTTP 202), 0 once both files are written.

The Markdown rendering matches paperreview-round1.md so successive reviews read
the same way; verified by regenerating round one from its own JSON.
"""

import argparse
import datetime
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://paperreview.ai"
HERE = Path(__file__).resolve().parent

WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six"}
SECRET_KEYS = ("token", "lookup_token", "review_token", "api_key", "secret")


def stamp(value: str) -> str:
    if not value:
        return "None"
    try:
        return datetime.datetime.fromisoformat(value).strftime("%Y-%m-%d %H:%M:%S UTC")
    except ValueError:
        return value


def render(data: dict, rnd: int, json_name: str) -> str:
    word = WORDS.get(rnd, str(rnd))
    content = (data.get("content") or "").strip()
    if not content:
        parts = []
        for name, body in (data.get("sections") or {}).items():
            parts.append(f"### {name.replace('_', ' ').title()}\n\n{body}")
        content = "\n\n".join(parts).strip()
    if not content:
        sys.exit("response carried neither `content` nor `sections`; nothing to render")

    score = data.get("numerical_score")
    return "\n".join([
        f"# PaperReview.ai round-{word} review",
        "",
        "| Field | Value |",
        "|---|---|",
        f"| Paper | {data.get('title') or 'None'} |",
        f"| Submitted | {stamp(data.get('submission_date', ''))} |",
        f"| Reviewed | {stamp(data.get('review_date', ''))} |",
        f"| Venue supplied | {data.get('venue') or 'None'} |",
        f"| Numerical score returned | {score if score is not None else 'None'} |",
        "",
        "This is the service-generated review text returned by PaperReview.ai. The",
        f"complete structured response is in [{json_name}]({json_name}).",
        "The private review lookup token is intentionally excluded.",
        "",
        "## Review",
        "",
        content,
        "",
    ])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("round", type=int)
    ap.add_argument("--from-file", type=Path, help="render a response saved elsewhere")
    args = ap.parse_args()

    json_out = HERE / f"paperreview-round{args.round}.json"
    md_out = HERE / f"paperreview-round{args.round}.md"
    for existing in (json_out, md_out):
        if existing.exists():
            print(f"refusing to overwrite {existing.name}; move it aside first")
            return 1

    if args.from_file:
        raw = args.from_file.read_bytes()
    else:
        token_file = HERE / f"round{args.round}.token"
        if not token_file.is_file():
            print(f"no {token_file.name}. Without the token the review cannot be retrieved:")
            print("the service offers no lookup by paper or by email.")
            return 1
        token = token_file.read_text().strip()
        req = urllib.request.Request(f"{API}/api/review/{token}")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                status, raw = resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            status, raw = exc.code, exc.read()
        except urllib.error.URLError as exc:
            print(f"network error: {exc.reason}")
            return 1
        if status == 202:
            print("still generating; try again shortly")
            return 2
        if status != 200:
            print(f"HTTP {status}: {raw[:300]!r}")
            return 1

    data = json.loads(raw.decode())
    if data.get("success") is False:
        print("service reported failure:", data.get("error") or data)
        return 1

    for key in SECRET_KEYS:
        data.pop(key, None)

    json_out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_out.write_text(render(data, args.round, json_out.name), encoding="utf-8")

    print(f"wrote {json_out.name} and {md_out.name}")
    print(f"  title:    {data.get('title', '')!r}")
    print(f"  reviewed: {data.get('review_date', '')}")
    for line in (data.get("content") or "").splitlines():
        s = line.strip()
        if s.startswith("- ") and ":" in s and "#" in s:
            print("  " + s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
