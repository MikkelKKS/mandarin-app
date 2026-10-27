#!/usr/bin/env bash
# Downloads everything scripts/build-vocab.ts needs into one folder (default: .vocab-sources).
# Used by the "data" GitHub workflow. The HSK lists are pinned to a commit so ids never shift
# under us; bump the commits on purpose to take upstream fixes.
#
#   bash scripts/fetch-vocab-sources.sh [folder]
set -euo pipefail
DIR="${1:-.vocab-sources}"
HSK30_COMMIT=4ff9e3915ce87baaecd7ebe263085573a4ea3192
DRK_COMMIT=7ac65bf1a6387d35f1ade478906172a19311c7f9
mkdir -p "$DIR/tatoeba"
cd "$DIR"

clone() { # url folder commit
  if [ ! -d "$2" ]; then git clone -q "$1" "$2"; fi
  git -C "$2" fetch -q origin "$3" 2>/dev/null || true
  git -C "$2" checkout -q "$3"
}
clone https://github.com/ivankra/hsk30.git hsk30 "$HSK30_COMMIT"
clone https://github.com/drkameleon/complete-hsk-vocabulary.git drk "$DRK_COMMIT"

[ -s cedict.txt.gz ] || curl -fsSL -o cedict.txt.gz https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz

T=https://downloads.tatoeba.org/exports
cd tatoeba
if [ ! -s cmn.tsv ] || [ ! -s eng.tsv ] || [ ! -s links.tsv ]; then
  # Per-language files are small; the full exports are the fallback.
  if curl -fsSL -o cmn.tsv.bz2 "$T/per_language/cmn/cmn_sentences_detailed.tsv.bz2" &&
     curl -fsSL -o eng.tsv.bz2 "$T/per_language/eng/eng_sentences_detailed.tsv.bz2" &&
     curl -fsSL -o links.tsv.bz2 "$T/per_language/cmn/cmn-eng_links.tsv.bz2"; then
    bunzip2 -f cmn.tsv.bz2 eng.tsv.bz2 links.tsv.bz2
  else
    echo "Per-language files not found; using the full exports."
    curl -fsSL "$T/sentences_detailed.tar.bz2" | tar -xjO > all.tsv
    awk -F'\t' '$2=="cmn"' all.tsv > cmn.tsv
    awk -F'\t' '$2=="eng"' all.tsv > eng.tsv
    rm all.tsv
    curl -fsSL "$T/links.tar.bz2" | tar -xjO > links.tsv
  fi
fi
wc -l cmn.tsv eng.tsv links.tsv
