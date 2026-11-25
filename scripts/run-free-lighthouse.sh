#!/usr/bin/env bash
set -euo pipefail
CHROME_BIN="$(cat "${CHROME_PATH_FILE}")"
pages=(
  "https://stationerydotcom.me/"
  "https://stationerydotcom.me/services"
  "https://stationerydotcom.me/digital-subscriptions"
  "https://stationerydotcom.me/meta-services"
  "https://stationerydotcom.me/document-services"
  "https://stationerydotcom.me/creative-services"
  "https://stationerydotcom.me/blog"
  "https://stationerydotcom.me/contact"
  "https://stationerydotcom.me/services/nid"
  "https://stationerydotcom.me/services/gemini-ai-google-ai"
)
tasks_file="$(mktemp)"
for url in "${pages[@]}"; do
  for device in mobile desktop; do printf '%s|%s\n' "$url" "$device" >> "$tasks_file"; done
done
export CHROME_BIN
export LIGHTHOUSE_BIN="$PWD/node_modules/.bin/lighthouse"
export RESULTS_DIR="$PWD/lighthouse-results"
mkdir -p "$RESULTS_DIR"
run_one() {
  local url="$1" device="$2" slug
  slug="$(echo "$url" | sed 's#https://stationerydotcom.me/##; s#/#-#g; s/[^a-zA-Z0-9-]/-/g')"
  slug="${slug:-homepage}"
  local args=(--chrome-path="$CHROME_BIN" --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" --output=json --output-path="$RESULTS_DIR/${slug}-${device}.json" --quiet --max-wait-for-load=45000)
  if [[ "$device" == "desktop" ]]; then args+=(--preset=desktop); fi
  echo "Lighthouse $device: $url"
  "$LIGHTHOUSE_BIN" "$url" "${args[@]}" || echo "Lighthouse failed for $device $url"
}
export -f run_one
cat "$tasks_file" | xargs -P 3 -n 1 -I TASK bash -c 'IFS="|" read -r u d <<< "$1"; run_one "$u" "$d"' _ TASK
rm -f "$tasks_file"
