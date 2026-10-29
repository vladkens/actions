#!/usr/bin/env bash
# rust-publish's check of the release files in DIR, before anything is published: regular files
# named PREFIX*. After a pack command (PACK=true) also update.txt, its subfolders (the binaries it
# packed) skipped, and at least one file.
set -euo pipefail

dir=$1
prefix=$2
pack=${3:-false}

expected="regular files named '$prefix*'"
if [ "$pack" = true ]; then
  expected+=" or 'update.txt'"
fi

count=0
for f in "$dir"/* "$dir"/.[!.]*; do
  [ -e "$f" ] || [ -L "$f" ] || continue
  name=${f#"$dir"/}
  if [ "$pack" = true ] && [ -d "$f" ] && [ ! -L "$f" ]; then
    continue
  fi

  if [ -L "$f" ] || [ ! -f "$f" ] || { [[ "$name" != "$prefix"* ]] && { [ "$pack" != true ] || [ "$name" != update.txt ]; }; }; then
    echo "::error::unexpected '$name' in the release files: expected $expected"
    exit 1
  fi

  count=$((count + 1))
done

if [ "$pack" = true ] && [ "$count" = 0 ]; then
  echo "::error::the pack command left no release files in $dir: expected $expected"
  exit 1
fi
