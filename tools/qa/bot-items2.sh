#!/bin/sh
# confirm run: 20 fresh seeds per item. usage: bot-items2.sh <tagprefix> id...   (id "none" = no item)
p=$1; shift
for id in "$@"; do
  it=""; [ "$id" != none ] && it="--items $id"
  node tools/qa/bot.mjs --seeds ${SEEDS:-401-420} --skill human $it --tag $p-$id --quiet > /tmp/bot-$p-$id.log 2>&1
done
echo done > /tmp/bot-$p.done
