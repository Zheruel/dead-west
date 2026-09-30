#!/bin/sh
# usage: sheet.sh out cols w h files...
out=$1; cols=$2; w=$3; h=$4; shift 4
rows=""; row=""; i=0
tmp=$(mktemp -d)
for f in "$@"; do
  magick "$f" -resize ${w}x${h} -background '#222' -gravity center -extent ${w}x${h} "$tmp/$i.png"
  i=$((i+1))
done
n=$i; r=0; j=0
while [ $j -lt $n ]; do
  files=""; k=0
  while [ $k -lt $cols ] && [ $j -lt $n ]; do files="$files $tmp/$j.png"; j=$((j+1)); k=$((k+1)); done
  while [ $k -lt $cols ]; do magick -size ${w}x${h} xc:'#222' "$tmp/pad$r$k.png"; files="$files $tmp/pad$r$k.png"; k=$((k+1)); done
  magick $files +append "$tmp/row$r.png"; r=$((r+1))
done
magick $(i=0; while [ $i -lt $r ]; do echo "$tmp/row$i.png"; i=$((i+1)); done) -append "$out"
rm -rf "$tmp"
