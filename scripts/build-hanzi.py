#!/usr/bin/env python3
"""
Character data for the Reading track (DECISIONS.md, 2026-10-29).

Input:  a checkout of Make Me a Hanzi (https://github.com/skishore/makemeahanzi):
        dictionary.txt (LGPL-3.0: readings, definitions, decomposition, etymology)
        graphics.txt   (Arphic Public License: stroke outlines, used here only to
                        measure how alike two characters look; nothing of it is shipped)
        and content/data/words.json (the HSK list).
Output: content/data/hanzi.json             every character in an HSK word: reading,
                                            meaning, building blocks, lowest HSK level
        content/data/lookalike-candidates.tsv  visually similar pairs, best first
                                            (the curated list in content/lookalikes.json
                                            may only use pairs from this file)

Usage:  python3 scripts/build-hanzi.py /path/to/makemeahanzi
Needs:  pip install pillow numpy
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MMAH = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / '.vocab-sources' / 'makemeahanzi')
OUT = ROOT / 'content' / 'data'
HAN = re.compile(r'[㐀-鿿]')
IDC = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻')
TERNARY = set('⿲⿳')


def load_jsonl(p):
    with open(p, encoding='utf-8') as f:
        return {d['character']: d for d in map(json.loads, f) if d.get('character')}


def short_def(d, limit=40):
    """The first senses of a Unihan definition, at most `limit` characters."""
    if not d:
        return ''
    senses = [s.strip() for s in re.split(r';', d) if s.strip()]
    out = ''
    for s in senses:
        s = re.sub(r'\s*\([^)]*\)', '', s).strip(' ,')
        if not s:
            continue
        cand = s if not out else f'{out}; {s}'
        if len(cand) > limit:
            break
        out = cand
    if not out and senses:
        out = re.sub(r'\s*\([^)]*\)', '', senses[0]).split(',')[0].strip()
        if len(out) > limit:
            out = out[:limit].rsplit(' ', 1)[0]
    return out


def parse_ids(s):
    """Direct parts of an IDS decomposition (sub-shapes flattened to their characters)."""
    pos = 0

    def node():
        nonlocal pos
        if pos >= len(s):
            return []
        ch = s[pos]
        pos += 1
        if ch in IDC:
            kids = [node() for _ in range(3 if ch in TERNARY else 2)]
            return [('group', kids)]
        return [ch]

    tree = node()
    if not tree or not isinstance(tree[0], tuple):
        return []
    parts = []
    for kid in tree[0][1]:
        flat = []

        def walk(n):
            for x in n:
                if isinstance(x, tuple):
                    for k in x[1]:
                        walk(k)
                elif x != '？':
                    flat.append(x)

        walk(kid)
        parts.extend(flat)
    return parts


def plain(r):
    import unicodedata
    return re.sub('[\u0300-\u036f]', '', unicodedata.normalize('NFD', r)).replace('ü', 'u')


def syllables(py):
    return [x for x in re.split(r"[\s']+", py.strip()) if x]


def main():
    words = json.loads((ROOT / 'content' / 'data' / 'words.json').read_text(encoding='utf-8'))
    dic = load_jsonl(MMAH / 'dictionary.txt')
    gfx = load_jsonl(MMAH / 'graphics.txt')

    # Readings as the HSK words use them, most common word first.
    uses = {}
    level = {}
    single = {}
    for w in sorted(words, key=lambda w: w['order']):
        chars = [c for c in w['hanzi'] if HAN.match(c)]
        syl = syllables(w['pinyin'])
        for i, c in enumerate(chars):
            level[c] = min(level.get(c, 99), w['level'] if w['level'] >= 1 else 99)
            if len(syl) == len(chars):
                uses.setdefault(c, []).append(syl[i].lower())
        if len(chars) == 1 and len(w['hanzi']) == 1:
            single.setdefault(w['hanzi'], []).append(w)

    chars = {}
    for c in sorted(level, key=lambda c: (level[c], c)):
        d = dic.get(c, {})
        readings = []
        for r in ([s['pinyin'] for s in single.get(c, [])] + uses.get(c, []) + d.get('pinyin', [])):
            r = r.lower()
            if r and r not in readings:
                readings.append(r)
        if not readings:
            continue
        # Most common reading: the most frequent single-character word, else how the most frequent word reads it.
        main = single[c][0]['pinyin'].lower() if c in single else readings[0]
        toned = re.compile('[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]')
        if c not in single and not toned.search(main):
            # 睛 is jing in 眼睛, but read on its own it's jīng.
            main = next((r for r in readings if toned.search(r) and plain(r) == plain(main)), main)
        ety = d.get('etymology') or {}
        parts = []
        for p in parse_ids(d.get('decomposition', ''))[:4]:
            pd = dic.get(p, {})
            role = 'meaning' if ety.get('semantic') == p else 'sound' if ety.get('phonetic') == p else ''
            pys = pd.get('pinyin') or ['']
            toned = [x for x in pys if re.search('[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]', x)]
            parts.append([p, (toned or pys)[0], short_def(pd.get('definition', ''), 30), role])
        if len(parts) < 2:
            parts = []
        entry = {'py': main, 'def': short_def(d.get('definition', '')), 'lvl': level[c] if level[c] < 99 else 0}
        # Other readings, leaving out the neutral-tone form of the main one (谢 xie in 谢谢).
        alt = [r for r in readings if r != main and not (plain(r) == r and plain(r) == plain(main))][:3]
        if alt:
            entry['alt'] = alt
        if parts:
            entry['parts'] = parts
        if ety.get('type'):
            entry['type'] = ety['type']
        hint = re.sub(r'\s+', ' ', (ety.get('hint') or '').replace('\xa0', ' ')).strip()
        if hint:
            entry['hint'] = hint[:90]
        if c in gfx:
            entry['strokes'] = len(gfx[c]['strokes'])
        chars[c] = entry

    about = (
        'Character data for the Reading track, built by scripts/build-hanzi.py from Make Me a Hanzi '
        '(dictionary.txt, LGPL-3.0, derived from Unihan and CJKlib) and the HSK word list. '
        'py = most common reading, def = meaning, parts = [part, pinyin, meaning, role], lvl = lowest HSK level.'
    )
    (OUT / 'hanzi.json').write_text(json.dumps({'_about': about, 'chars': chars}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

    # --- Look-alikes: render every character's outline small and compare the pictures.
    S = 48
    pool = [c for c in chars if c in gfx and chars[c]['lvl']]

    def render(c, mirror=False):
        img = Image.new('L', (S, S), 0)
        dr = ImageDraw.Draw(img)
        for path in gfx[c]['strokes']:
            pts, cur = [], (0.0, 0.0)
            toks = path.replace(',', ' ').split()
            i = 0
            while i < len(toks):
                t = toks[i]
                if t in ('M', 'L'):
                    cur = (float(toks[i + 1]), float(toks[i + 2]))
                    pts.append(cur)
                    i += 3
                elif t == 'Q':
                    cx, cy, x, y = map(float, toks[i + 1:i + 5])
                    for k in range(1, 7):
                        u = k / 6
                        pts.append(((1 - u) ** 2 * cur[0] + 2 * (1 - u) * u * cx + u * u * x, (1 - u) ** 2 * cur[1] + 2 * (1 - u) * u * cy + u * u * y))
                    cur = (x, y)
                    i += 5
                else:
                    i += 1
            if len(pts) > 2:
                dr.polygon([(x / 1024 * S, (900 - y) / 1024 * S) for x, y in pts], fill=255)
        if mirror:
            img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        img = img.filter(ImageFilter.GaussianBlur(1.2))
        v = np.asarray(img, dtype=np.float32).ravel()
        v -= v.mean()
        n = np.linalg.norm(v)
        return v / n if n else v

    M = np.stack([render(c) for c in pool])
    F = np.stack([render(c, True) for c in pool])
    sim = M @ M.T
    mir = M @ F.T
    found = {}
    index = {c: k for k, c in enumerate(pool)}

    def add(s, a, b, kind):
        key = tuple(sorted((a, b)))
        if key not in found or found[key][0] < s:
            found[key] = (s, kind)

    for i in range(len(pool)):
        for j in range(i + 1, len(pool)):
            a, b = pool[i], pool[j]
            if abs(chars[a].get('strokes', 0) - chars[b].get('strokes', 0)) > 2:
                continue
            if sim[i, j] >= 0.80:
                add(float(sim[i, j]), a, b, 'shape')
            elif mir[i, j] >= 0.80:
                add(float(mir[i, j]), a, b, 'mirror')
    # Strokes in the same places, one stroke moved or added (人 / 入, 天 / 夫): match stroke centre lines.
    def lines(c):
        out = []
        for m in gfx[c]['medians']:
            pts = np.array(m, dtype=np.float32)
            seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
            t = np.linspace(0, seg[-1] or 1, 8)
            out.append(np.c_[np.interp(t, seg, pts[:, 0]), np.interp(t, seg, pts[:, 1])])
        return np.array(out)

    L = {c: lines(c) for c in pool}
    by_n = {}
    for c in pool:
        by_n.setdefault(len(L[c]), []).append(c)

    def unmatched(a, b, tol):
        A, B = L[a], L[b]
        d = np.linalg.norm(A[:, None] - B[None], axis=3).mean(axis=2)
        left, used = 0, set()
        for i in np.argsort(d.min(axis=1)):
            j = min((j for j in range(len(B)) if j not in used), key=lambda j: d[i, j], default=None)
            if j is None or d[i, j] > tol:
                left += 1
            else:
                used.add(j)
        return left + max(0, len(B) - len(A))

    for n, cs in by_n.items():
        if n < 2:
            continue
        others = cs + by_n.get(n + 1, [])
        for a in cs:
            for b in others:
                if a >= b and len(L[b]) == n:
                    continue
                k = (index[a], index[b])
                if unmatched(a, b, 70) <= 1:
                    add(0.5 + 0.5 * float(sim[k]), a, b, 'one stroke')
                elif len(L[b]) == n and sim[k] >= 0.55 and unmatched(a, b, 150) == 0:
                    # Same strokes, some longer or shorter (土 / 士) or shifted (人 / 入).
                    add(0.4 + 0.5 * float(sim[k]), a, b, 'strokes shifted')
    # One character plus a small extra part (买 → 卖, 大 → 太): from the decompositions.
    for b in pool:
        ps = parse_ids(dic.get(b, {}).get('decomposition', ''))
        if len(ps) != 2:
            continue
        for a, extra in (ps, ps[::-1]):
            if a in index and a != b and gfx.get(extra) and len(gfx[extra]['strokes']) <= 2:
                add(float(sim[index[a], index[b]]), a, b, 'extra part')
    # Same right-hand part, different radical (情 / 请 / 清 / 晴), both common: easy to mix up when reading.
    right = {}
    for c in pool:
        dec = dic.get(c, {}).get('decomposition', '')
        if dec.startswith('⿰') and len(dec) == 3 and chars[c]['lvl'] <= 4:
            right.setdefault(dec[2], []).append(c)
    for side, cs in right.items():
        if len(cs) < 2 or len(cs) > 6:
            continue
        for i, x in enumerate(cs):
            for y in cs[i + 1:]:
                add(0.3 + 0.5 * float(sim[index[x], index[y]]), x, y, 'radical swap')
    rows = sorted(((s, a, b, kind) for (a, b), (s, kind) in found.items()), reverse=True)
    with open(OUT / 'lookalike-candidates.tsv', 'w', encoding='utf-8') as f:
        f.write('similarity\tkind\ta\tb\ta_level\tb_level\ta_pinyin\tb_pinyin\ta_meaning\tb_meaning\n')
        for s, a, b, kind in rows:
            f.write(f"{s:.3f}\t{kind}\t{a}\t{b}\t{chars[a]['lvl']}\t{chars[b]['lvl']}\t{chars[a]['py']}\t{chars[b]['py']}\t{chars[a]['def']}\t{chars[b]['def']}\n")
    print(f'{len(chars)} characters, {len(rows)} look-alike candidates')


if __name__ == '__main__':
    main()
