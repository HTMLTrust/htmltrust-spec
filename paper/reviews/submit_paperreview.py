#!/usr/bin/env python3
"""Submit paper/htmltrust.pdf to paperreview.ai (Stanford Agentic Reviewer).

Usage:
    python3 paper/reviews/submit_paperreview.py <round-number> [--venue VENUE] [--email EMAIL]

The service has no documented public API. This performs the three-step flow its
own static/upload.js uses:

  1. POST /api/get-upload-url  {filename, venue}         -> presigned S3 POST
  2. POST presigned_url        (presigned fields + file) -> S3 stores the PDF
  3. POST /api/confirm-upload  {s3_key, venue, email}    -> {success, message, token}

The returned token is the only way to retrieve the review; there is no lookup
by email or by paper. It is written to reviews/round<N>.token at mode 600 and
that path is gitignored. Losing it loses the review, which is what happened to
round two.

Flow reverse-engineered in the AnthroSim project's research/tools; this is an
adaptation for HTMLTrust. Standard library only.
"""

import argparse
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://paperreview.ai"
HERE = Path(__file__).resolve().parent
PDF = HERE.parent / "htmltrust.pdf"

# The paper's own byline address, so review correspondence reaches the author.
DEFAULT_EMAIL = "jason@jason-grey.com"
# Round one recorded an empty venue. Keep that default so successive reviews
# stay comparable; pass --venue to steer the reviewer at a specific audience.
DEFAULT_VENUE = ""

MAX_BYTES = 10 * 1024 * 1024
ANALYZED_PAGES = 15


def post_json(url: str, obj: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(obj).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def post_multipart(url: str, fields: dict, file_part=None) -> tuple[int, bytes]:
    boundary = "----pyform" + secrets.token_hex(12)
    body = bytearray()
    for key, value in fields.items():
        body += (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'
            f"{value}\r\n"
        ).encode()
    if file_part is not None:
        name, filename, data, ctype = file_part
        body += (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f"Content-Type: {ctype}\r\n\r\n"
        ).encode()
        body += data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.status, resp.read()


def page_count(path: Path) -> int | None:
    """Page count via pdfinfo, which is what the repo's own checks use.

    The raw-bytes heuristic this replaced counted zero on our own PDF: pdflatex
    writes page objects into compressed object streams, so /Type /Page never
    appears as literal bytes."""
    try:
        out = subprocess.run(
            ["pdfinfo", str(path)], capture_output=True, text=True, timeout=30, check=True
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    for line in out.splitlines():
        if line.startswith("Pages:"):
            try:
                return int(line.split(":", 1)[1].strip())
            except ValueError:
                return None
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("round", type=int, help="round number, e.g. 3")
    ap.add_argument("--venue", default=DEFAULT_VENUE)
    ap.add_argument("--email", default=DEFAULT_EMAIL)
    ap.add_argument("--pdf", type=Path, default=PDF)
    args = ap.parse_args()

    token_file = HERE / f"round{args.round}.token"
    if token_file.exists():
        print(f"refusing to overwrite {token_file.name}; move it aside first")
        return 1

    if not args.pdf.is_file():
        print(f"no PDF at {args.pdf}; run `make paper` or `make paper-docker` first")
        return 1

    pdf_bytes = args.pdf.read_bytes()
    if not pdf_bytes.startswith(b"%PDF-"):
        print(f"{args.pdf} is not a PDF")
        return 1
    if len(pdf_bytes) > MAX_BYTES:
        print(f"{len(pdf_bytes):,} bytes exceeds the {MAX_BYTES:,} byte limit")
        return 1

    pages = page_count(args.pdf)
    filename = f"htmltrust-round{args.round}.pdf"

    print(f"PDF:    {args.pdf}")
    print(f"size:   {len(pdf_bytes):,} bytes")
    print(f"pages:  {pages if pages else 'unknown'} (the service analyzes the first {ANALYZED_PAGES})")
    print(f"email:  {args.email}")
    print(f"venue:  {args.venue or '(none)'}")
    print()

    try:
        print("1/3 requesting presigned upload URL...")
        d = post_json(f"{API}/api/get-upload-url", {"filename": filename, "venue": args.venue})
        if not d.get("success"):
            print("get-upload-url failed:", d)
            return 1

        print(f"2/3 uploading to S3 ({d['s3_key']})...")
        status, _ = post_multipart(
            d["presigned_url"],
            d["presigned_fields"],
            ("file", filename, pdf_bytes, "application/pdf"),
        )
        print(f"    S3 responded {status}")

        print("3/3 confirming upload...")
        status, raw = post_multipart(
            f"{API}/api/confirm-upload",
            {"s3_key": d["s3_key"], "venue": args.venue, "email": args.email},
        )
        result = json.loads(raw.decode())
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read()[:400]!r}")
        return 1
    except urllib.error.URLError as exc:
        print(f"network error: {exc.reason}")
        return 1

    if not result.get("success"):
        print("confirm-upload failed:", result)
        return 1

    token = result.get("token", "")
    token_file.write_text(token)
    token_file.chmod(0o600)

    print()
    print("Submitted.")
    print("Message:", result.get("message", ""))
    print(f"Token saved to {token_file} (mode 600, gitignored).")
    print(f"Retrieve with: python3 paper/reviews/fetch_paperreview.py {args.round}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
