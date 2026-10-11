#!/usr/bin/env python3
"""
Generates MP3s for every word, sentence and sound in /content using edge-tts
(free Microsoft neural voices). Only missing files are generated, so it is
safe to re-run. Output: public/audio/{f|m}/{id}.mp3 (+ {id}.slow.mp3 for sentences).

    pip install edge-tts
    python3 scripts/generate-audio.py            # generate missing files
    python3 scripts/generate-audio.py --force    # regenerate everything

Runs automatically in GitHub Actions (see .github/workflows/deploy.yml).
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
VOICES = {"f": "zh-CN-XiaoxiaoNeural", "m": "zh-CN-YunxiNeural"}
SLOW_RATE = "-35%"
WORD_RATE = "-10%"  # single words a touch slower than conversational speed
CONCURRENCY = 6


def jobs():
    units = sorted((ROOT / "content" / "units").glob("*.json"))
    for path in units:
        unit = json.loads(path.read_text(encoding="utf-8"))
        for w in unit.get("words", []):
            yield w["id"], w["hanzi"], False
        for s in unit.get("sentences", []):
            yield s["id"], s["hanzi"], True
    sounds = json.loads((ROOT / "content" / "sounds.json").read_text(encoding="utf-8"))
    for s in sounds["syllables"]:
        yield s["id"], s["hanzi"], False


async def synth(text, voice, rate, dest, sem):
    async with sem:
        for attempt in range(4):
            try:
                tmp = dest.with_suffix(".tmp")
                await edge_tts.Communicate(text, voice, rate=rate).save(str(tmp))
                tmp.replace(dest)
                return True
            except Exception as e:  # network hiccups: retry with backoff
                print(f"  retry {attempt + 1} for {dest.name}: {e}", file=sys.stderr)
                await asyncio.sleep(2 * (attempt + 1))
        return False


async def main():
    force = "--force" in sys.argv
    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = []
    for item_id, text, is_sentence in jobs():
        for v, voice in VOICES.items():
            (OUT / v).mkdir(parents=True, exist_ok=True)
            variants = [("", "+0%" if is_sentence else WORD_RATE)]
            if is_sentence:
                variants.append((".slow", SLOW_RATE))
            for suffix, rate in variants:
                dest = OUT / v / f"{item_id}{suffix}.mp3"
                if force or not dest.exists():
                    tasks.append(synth(text, voice, rate, dest, sem))
    print(f"{len(tasks)} file(s) to generate")
    results = await asyncio.gather(*tasks)
    failed = results.count(False)
    print(f"done: {len(results) - failed} generated, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
