#!/usr/bin/env bash
# Downloads the 18 source photos listed in MANIFEST.md from Unsplash and Pexels.
# Idempotent: skips files that already exist.

set -euo pipefail

DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/source-photos"
mkdir -p "$DEST"

# Each entry: filename|url
declare -a PHOTOS=(
  "01-wedding-couple.jpg|https://images.pexels.com/photos/10074941/pexels-photo-10074941.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "02-wedding-bouquet.jpg|https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1600&auto=format&fit=crop&q=80"
  "03-wedding-rings.jpg|https://images.pexels.com/photos/168927/pexels-photo-168927.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "04-quinceanera.jpg|https://images.pexels.com/photos/17931321/pexels-photo-17931321.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "05-birthday-candles.jpg|https://images.pexels.com/photos/6148512/pexels-photo-6148512.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "06-birthday-cake.jpg|https://images.unsplash.com/photo-1607482369189-a53b6e71fa48?w=1600&auto=format&fit=crop&q=80"
  "07-family-portrait.jpg|https://images.pexels.com/photos/16555927/pexels-photo-16555927.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "08-baby.jpg|https://images.unsplash.com/photo-1649880210584-3365f4c4c08b?w=1600&auto=format&fit=crop&q=80"
  "09-grandpa.jpg|https://images.unsplash.com/photo-1605126164543-7e9ea393f8a1?w=1600&auto=format&fit=crop&q=80"
  "10-grandma.jpg|https://images.unsplash.com/photo-1752084794888-0b27a762b6fd?w=1600&auto=format&fit=crop&q=80"
  "11-dog.jpg|https://images.unsplash.com/photo-1558788353-f76d92427f16?w=1600&auto=format&fit=crop&q=80"
  "12-cat.jpg|https://images.pexels.com/photos/3822875/pexels-photo-3822875.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "13-house.jpg|https://images.pexels.com/photos/34030968/pexels-photo-34030968.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "14-car.jpg|https://images.pexels.com/photos/32790643/pexels-photo-32790643.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "15-guitar.jpg|https://images.pexels.com/photos/15486142/pexels-photo-15486142.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "16-soccer-ball.jpg|https://images.pexels.com/photos/12039816/pexels-photo-12039816.jpeg?auto=compress&cs=tinysrgb&w=1600"
  "17-camera.jpg|https://images.unsplash.com/photo-1516962126636-27ad087061cc?w=1600&auto=format&fit=crop&q=80"
  "18-tacos.jpg|https://images.unsplash.com/photo-1648437595587-e6a8b0cdf1f9?w=1600&auto=format&fit=crop&q=80"
)

for entry in "${PHOTOS[@]}"; do
  filename="${entry%%|*}"
  url="${entry#*|}"
  out="$DEST/$filename"
  if [ -f "$out" ]; then
    echo "skip  $filename (already exists)"
    continue
  fi
  echo "fetch $filename"
  curl -sSL -A "Mozilla/5.0" -o "$out" "$url"
done

echo
echo "Done. Files in $DEST:"
ls -lh "$DEST"
