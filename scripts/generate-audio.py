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
import shutil
import sys
import time
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
VOICES = {"f": "zh-CN-XiaoxiaoNeural", "m": "zh-CN-YunxiNeural"}
SLOW_RATE = "-25%"
WORD_RATE = "-10%"  # single words a touch slower than conversational speed
CONCURRENCY = 8
# Pad every clip with a little silence: some browsers (Firefox) drop the last
# fraction of a second of these MP3s, and Bluetooth/USB audio can swallow the start.
PAD_BEFORE_MS = 150
PAD_AFTER_S = 0.4
AUDIO_FORMAT = 2  # bump to re-process all existing files
SLOW_VERSION = 2  # bump to re-record slow sentence files (e.g. after changing SLOW_RATE)


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


async def pad(path):
    """Re-encode with silence before/after (gapless LAME header included)."""
    tmp = path.with_suffix(".pad.mp3")
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(path),
        "-af", f"adelay={PAD_BEFORE_MS}:all=1,apad=pad_dur={PAD_AFTER_S}",
        "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", str(tmp),
    )
    if await proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for {path.name}")
    tmp.replace(path)


async def duration(path):
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path),
        stdout=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    try:
        return float(out.decode().strip())
    except ValueError:
        return 0.0


def min_seconds(text):
    """Shortest believable recording. The TTS service sometimes returns only the first syllable."""
    n = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    # Normal clips are rarely under a second (the service adds a little silence); cut-off ones are about 0.4 s.
    return max(0.8, 0.18 * n + 0.2)


async def synth(text, voice, rate, dest, sem):
    async with sem:
        for attempt in range(5):
            try:
                tmp = dest.with_suffix(".tmp")
                await edge_tts.Communicate(text, voice, rate=rate).save(str(tmp))
                secs = await duration(tmp)
                if secs < min_seconds(text) and attempt < 4:
                    raise RuntimeError(f"recording too short ({secs:.2f}s), probably cut off")
                tmp.replace(dest)
                await pad(dest)
                return True
            except Exception as e:  # network hiccups: retry with backoff
                print(f"  retry {attempt + 1} for {dest.name}: {e}", file=sys.stderr)
                await asyncio.sleep(2 * (attempt + 1))
        return False


MANIFEST = OUT / "manifest.json"


def dict_key(hanzi):
    """File name for dictionary audio: hex code points joined by '_' (matches src/lib/audio.ts)."""
    return "_".join(format(ord(c), "x") for c in hanzi)


def dict_jobs():
    """Every HSK 1-6 word, for the dictionary (one voice, no slow version)."""
    path = ROOT / "content" / "hsk" / "hsk-levels.json"
    if not path.exists():
        return []
    seen = set()
    for w in json.loads(path.read_text(encoding="utf-8"))["words"]:
        h = w["h"]
        if h not in seen and all("\u4e00" <= c <= "\u9fff" for c in h):
            seen.add(h)
            yield h


async def main():
    force = "--force" in sys.argv
    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = []
    # manifest: id -> text the audio was generated from. When the text changes
    # (e.g. a sentence is edited), the audio is regenerated.
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required (sudo apt-get install ffmpeg)")
    first_run = not MANIFEST.exists()
    raw = {} if first_run else json.loads(MANIFEST.read_text(encoding="utf-8"))
    # Format 1 was a flat {id: text}; format 2 is {"_format": 2, "items": {...}}.
    fmt = raw.get("_format", 1) if isinstance(raw.get("_format"), int) else 1
    manifest = raw.get("items", raw) if fmt >= 2 else raw
    slow_stale = raw.get("_slow", 1) != SLOW_VERSION
    items = list(jobs())
    for item_id, text, is_sentence in items:
        stale = force or (not first_run and manifest.get(item_id) != text)
        for v, voice in VOICES.items():
            (OUT / v).mkdir(parents=True, exist_ok=True)
            variants = [("", "+0%" if is_sentence else WORD_RATE)]
            if is_sentence:
                variants.append((".slow", SLOW_RATE))
            for suffix, rate in variants:
                dest = OUT / v / f"{item_id}{suffix}.mp3"
                if stale or not dest.exists() or (suffix == ".slow" and slow_stale):
                    tasks.append(synth(text, voice, rate, dest, sem))
    (OUT / "dict").mkdir(parents=True, exist_ok=True)
    for h in dict_jobs():
        dest = OUT / "dict" / f"{dict_key(h)}.mp3"
        if force or not dest.exists():
            tasks.append(synth(h, VOICES["f"], WORD_RATE, dest, sem))
    print(f"{len(tasks)} file(s) to generate")
    started = time.time()
    results = await asyncio.gather(*tasks)
    failed = results.count(False)
    if fmt < AUDIO_FORMAT:
        # One-off: pad every file that was made before padding existed.
        # Files generated in this run are already padded.
        old = [p for p in OUT.glob("*/*.mp3") if p.stat().st_mtime < started]
        print(f"padding {len(old)} existing file(s)")
        psem = asyncio.Semaphore(8)

        async def pad_one(p):
            async with psem:
                await pad(p)

        await asyncio.gather(*(pad_one(p) for p in old))
    if not failed:
        MANIFEST.write_text(
            json.dumps({"_format": AUDIO_FORMAT, "_slow": SLOW_VERSION, "items": {i: t for i, t, _ in items}}, ensure_ascii=False, indent=0, sort_keys=True),
            encoding="utf-8",
        )
    print(f"done: {len(results) - failed} generated, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
