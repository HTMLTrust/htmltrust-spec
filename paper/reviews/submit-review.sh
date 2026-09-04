#!/usr/bin/env bash
# Submit paper/htmltrust.pdf to PaperReview.ai and record the response.
#
# Companion to fetch-review.sh, which retrieves a finished review. This script
# only submits and saves whatever the service returns, which normally includes
# the private lookup token. That response goes to a path you choose, outside
# this repository by default, because the token must not be committed.
#
# Pre-flight checks run first and refuse to submit on a violation:
#   - PDF exists and is a PDF
#   - at most 10 MiB, the documented upload limit
#   - reports the page count, since only the first 15 pages are analyzed
#
# Usage:
#   PAPERREVIEW_SUBMIT_URL='https://<endpoint>' \
#   PAPERREVIEW_API_KEY='<key, if the service needs one>' \
#   ./submit-review.sh
#
# Optional:
#   PAPERREVIEW_FIELD=file        multipart field name for the upload
#   PAPERREVIEW_VENUE='...'       venue hint, if the service accepts one
#   PAPERREVIEW_OUT=~/path.json   where to save the response (default below)
#
# The multipart field name defaults to `file`, which is the common convention.
# If the service documents a different name, set PAPERREVIEW_FIELD. Nothing in
# this repository records the endpoint, so both it and the field name have to
# come from the service's own documentation.

set -euo pipefail

cd "$(dirname "$0")"

pdf="../htmltrust.pdf"
out="${PAPERREVIEW_OUT:-$HOME/htmltrust-paperreview-submission-$(date +%Y%m%d-%H%M%S).json}"
field="${PAPERREVIEW_FIELD:-file}"

# ---- pre-flight -------------------------------------------------------------

[[ -f "$pdf" ]] || { echo "no PDF at $pdf; run \`make paper\` first" >&2; exit 1; }

case "$(head -c 5 "$pdf")" in
  %PDF-) ;;
  *) echo "$pdf is not a PDF" >&2; exit 1 ;;
esac

bytes=$(wc -c < "$pdf")
limit=$((10 * 1024 * 1024))
if (( bytes > limit )); then
  echo "PDF is ${bytes} bytes, over the documented 10 MiB limit" >&2
  exit 1
fi

pages="unknown"
if command -v pdfinfo >/dev/null 2>&1; then
  pages=$(pdfinfo "$pdf" | awk '/^Pages:/ {print $2}')
fi

echo "submitting $pdf"
echo "  bytes:  ${bytes}"
echo "  pages:  ${pages} (the service analyzes the first 15)"
echo "  sha256: $(sha256sum "$pdf" | cut -d' ' -f1)"
echo "  saving the response to: ${out}"
echo

# ---- submit -----------------------------------------------------------------

: "${PAPERREVIEW_SUBMIT_URL:?set PAPERREVIEW_SUBMIT_URL to the submission endpoint}"

# The API key goes in through a config on stdin so it stays out of the process
# list. The file upload has to be an argument, which is fine: it is a path.
{
  echo "url = \"${PAPERREVIEW_SUBMIT_URL}\""
  echo 'header = "Accept: application/json"'
  if [[ -n "${PAPERREVIEW_API_KEY:-}" ]]; then
    echo "header = \"Authorization: Bearer ${PAPERREVIEW_API_KEY}\""
  fi
} | curl --config - \
      --fail-with-body --silent --show-error --location --max-time 300 \
      --form "${field}=@${pdf};type=application/pdf" \
      ${PAPERREVIEW_VENUE:+--form "venue=${PAPERREVIEW_VENUE}"} \
      --output "$out"

chmod 600 "$out"

echo "response saved to ${out}"
echo
python3 - "$out" <<'PY'
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        data = json.load(fh)
except Exception:
    print("response is not JSON; inspect the file directly")
    raise SystemExit(0)

if isinstance(data, dict):
    # Show the shape without printing anything token-shaped.
    secret = ("token", "lookup_token", "review_token", "api_key", "secret")
    for k, v in data.items():
        if any(s in k.lower() for s in secret):
            print(f"  {k}: <present, {len(str(v))} chars, not shown>")
        else:
            print(f"  {k}: {str(v)[:80]}")
    print()
    print("Keep the token out of Git. When the review is ready:")
    print("  PAPERREVIEW_URL=... PAPERREVIEW_TOKEN=... ./fetch-review.sh <round>")
PY
