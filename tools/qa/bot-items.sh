#!/bin/sh
# Per-item bot sweep: node tools/qa/bot.mjs with each item preloaded (10 seeds, human skill). Results: art/qa/bot-item-<id>.jsonl
for id in "$@"; do
  node tools/qa/bot.mjs --seeds 301-310 --skill human --items $id --tag item-$id --quiet > /tmp/bot-item-$id.log 2>&1
done
echo ALLDONE > /tmp/bot-items.done
