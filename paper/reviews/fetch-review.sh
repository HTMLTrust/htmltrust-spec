#!/usr/bin/env bash
# Retrieve a PaperReview.ai result and archive it beside its siblings.
#
# Writes two files in this directory:
#   paperreview-round<N>.json   the structured response, verbatim
#   paperreview-round<N>.md     a readable rendering, in the round-one format
#
# The private lookup token is never written to either file, never passed in
# argv where `ps` could read it, and never echoed. It reaches curl through a
# config file on stdin.
#
# Usage:
#   PAPERREVIEW_URL='https://.../reviews/<id>' \
#   PAPERREVIEW_TOKEN='<private lookup token>' \
#   ./fetch-review.sh 2
#
# If the URL takes the token in the path or query rather than a header, put
# the literal string {token} where it belongs and it will be substituted:
#   PAPERREVIEW_URL='https://.../reviews/{token}'
#
# If you already have the JSON, from the web UI or an email, skip the request:
#   ./fetch-review.sh 2 --from-file ~/Downloads/review.json

set -euo pipefail

cd "$(dirname "$0")"

round="${1:-}"
if [[ ! "$round" =~ ^[0-9]+$ ]]; then
  echo "usage: $0 <round-number> [--from-file <path>]" >&2
  exit 2
fi
shift

from_file=""
if [[ "${1:-}" == "--from-file" ]]; then
  from_file="${2:-}"
  [[ -n "$from_file" ]] || { echo "--from-file needs a path" >&2; exit 2; }
fi

json="paperreview-round${round}.json"
md="paperreview-round${round}.md"

for existing in "$json" "$md"; do
  if [[ -e "$existing" ]]; then
    echo "refusing to overwrite $existing; move it aside first" >&2
    exit 1
  fi
done

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if [[ -n "$from_file" ]]; then
  cp "$from_file" "$tmp"
else
  : "${PAPERREVIEW_URL:?set PAPERREVIEW_URL to the review endpoint}"
  : "${PAPERREVIEW_TOKEN:?set PAPERREVIEW_TOKEN to the private lookup token}"

  url="${PAPERREVIEW_URL//\{token\}/$PAPERREVIEW_TOKEN}"

  # The config comes in on stdin so neither the URL nor the token appears in
  # the process list.
  curl --config - --fail-with-body --silent --show-error --location \
       --max-time 120 --output "$tmp" <<CURLRC
url = "${url}"
header = "Accept: application/json"
header = "Authorization: Bearer ${PAPERREVIEW_TOKEN}"
CURLRC
fi

python3 - "$tmp" "$json" "$md" "$round" <<'PY'
import json, sys, datetime

src, json_out, md_out, round_n = sys.argv[1:5]

with open(src, encoding="utf-8") as fh:
    data = json.load(fh)

if data.get("success") is False:
    sys.exit(f"service reported failure: {data.get('error') or data}")

# Anything token-shaped stays out of the archived copy.
for key in ("token", "lookup_token", "review_token", "api_key"):
    data.pop(key, None)

with open(json_out, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2, ensure_ascii=False)
    fh.write("\n")


def stamp(value):
    if not value:
        return "None"
    try:
        return datetime.datetime.fromisoformat(value).strftime("%Y-%m-%d %H:%M:%S UTC")
    except ValueError:
        return value


words = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five"}
word = words.get(round_n, round_n)

content = (data.get("content") or "").strip()
if not content:
    sections = data.get("sections") or {}
    parts = []
    for name, body in sections.items():
        parts.append(f"### {name.replace('_', ' ').title()}\n\n{body}")
    content = "\n\n".join(parts).strip()
if not content:
    sys.exit("response contained neither `content` nor `sections`; nothing to render")

lines = [
    f"# PaperReview.ai round-{word} review",
    "",
    "| Field | Value |",
    "|---|---|",
    f"| Paper | {data.get('title') or 'None'} |",
    f"| Submitted | {stamp(data.get('submission_date'))} |",
    f"| Reviewed | {stamp(data.get('review_date'))} |",
    f"| Venue supplied | {data.get('venue') or 'None'} |",
    f"| Numerical score returned | {data.get('numerical_score') if data.get('numerical_score') is not None else 'None'} |",
    "",
    "This is the service-generated review text returned by PaperReview.ai. The",
    f"complete structured response is in [{json_out}]({json_out}).",
    "The private review lookup token is intentionally excluded.",
    "",
    "## Review",
    "",
    content,
    "",
]

with open(md_out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))

print(f"wrote {json_out} and {md_out}")
PY
