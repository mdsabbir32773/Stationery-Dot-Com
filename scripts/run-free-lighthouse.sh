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
for url in "${pages[@]}"; do
  slug="$(echo "$url" | sed 's#https://stationerydotcom.me/##; s#/#-#g; s/[^a-zA-Z0-9-]/-/g')"
  slug="${slug:-homepage}"
  for device in mobile desktop; do
    args=(--chrome-path="$CHROME_BIN" --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" --output=json --output-path="lighthouse-results/${slug}-${device}.json" --quiet)
    if [[ "$device" == "desktop" ]]; then args+=(--preset=desktop); fi
    echo "Lighthouse $device: $url"
    npx --no-install lighthouse "$url" "${args[@]}" || echo "Lighthouse failed for $device $url; continue to next URL"
  done
done
