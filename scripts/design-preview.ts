/**
 * Helpers for /design-review (.claude/commands/design-review.md).
 *
 *   npx tsx scripts/design-preview.ts shots <outDir> [screens] [--dir <path>] [--port <n>]
 *       Screenshots of the main screens (qa/design.spec.ts) at 412px and 1440px, light and dark,
 *       into <outDir>/<phone|pc>/<light|dark>/<screen>.png. screens: optional comma list
 *       (home, session, tone-gym, library, stats, settings, music). Needs a fresh `npm run build` in that dir.
 *   npx tsx scripts/design-preview.ts motion <outDir> [--dir <path>] [--port <n>]
 *       Frame sequences of key interactions (qa/design-motion.spec.ts), normal and reduced motion.
 *   npx tsx scripts/design-preview.ts worktree <name> [ref]
 *       A temporary git worktree at .design-worktrees/<name> (detached at <ref>, default HEAD; never on a branch),
 *       without public/audio (55k files, not needed for screenshots), sharing node_modules and the dictionary.
 *   npx tsx scripts/design-preview.ts build <name>
 *       npm run build inside that worktree.
 *   npx tsx scripts/design-preview.ts remove <name>
 *       Deletes the worktree again (the shared node_modules link is removed first, so the real one is untouched).
 *   npx tsx scripts/design-preview.ts compare <dir> [title]
 *       Writes <dir>/compare.html: every <dir>/before/**.png next to the same file in <dir>/after/,
 *       so Mikkel opens one file in his browser and sees before | after side by side. Only screens that
 *       changed are shown; identical pairs are left out and named at the end.
 *
 *   npx tsx scripts/design-preview.ts pairs <beforeDir> <afterDir> <outDir> [--only a,b]
 *       Blind A/B pairs for the design-judge agent: every screenshot (and motion interaction folder)
 *       that exists in both and differs becomes two pair folders, <outDir>/pair-NN/{A,B}, once in
 *       each order, shuffled; <outDir>/pairs.txt names the screen of each pair. Which side is the
 *       "after" goes ONLY to design-review/keys/<outDir name>.json (the judge never reads it).
 *       --only: comma list of path prefixes (e.g. phone/light/home,motion/phone/full/answer-right).
 *
 * Browsers are always headless and muted (playwright.qa.config.ts → e2e/launch.ts).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = rest[i + 1];
  rest.splice(i, 2);
  return v;
};
const dirFlag = flag('dir');
const portFlag = flag('port');
const wtPath = (name: string) => join(root, '.design-worktrees', name);

function run(command: string, args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  const r = spawnSync(command, args, { cwd: opts.cwd ?? root, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...opts.env } });
  return r.status ?? 1;
}
const git = (...args: string[]) => {
  if (run('git', args) !== 0) throw new Error(`git ${args.join(' ')} failed`);
};

function playwright(spec: string, outDir: string, extraEnv: Record<string, string> = {}) {
  const dir = resolve(root, dirFlag ?? '.');
  const port = portFlag ?? (dir === root ? '4173' : '4174');
  const out = resolve(root, outDir);
  return run('npx', ['playwright', 'test', '-c', 'playwright.qa.config.ts', spec], {
    cwd: dir,
    env: { DESIGN_REVIEW: '1', DESIGN_OUT: out, QA_PORT: port, ...extraEnv },
  });
}

function isLink(p: string) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function unlinkDir(p: string) {
  if (!isLink(p)) return;
  try {
    unlinkSync(p);
  } catch {
    rmdirSync(p); // a Windows junction
  }
}

switch (cmd) {
  case 'shots': {
    const [outDir, screens] = rest;
    if (!outDir) throw new Error('usage: shots <outDir> [screens]');
    process.exit(playwright('qa/design.spec.ts', outDir, screens ? { DESIGN_SCREENS: screens } : {}));
  }
  case 'motion': {
    const [outDir] = rest;
    if (!outDir) throw new Error('usage: motion <outDir>');
    process.exit(playwright('qa/design-motion.spec.ts', outDir));
  }
  case 'worktree': {
    const [name, ref = 'HEAD'] = rest;
    if (!name) throw new Error('usage: worktree <name>');
    const p = wtPath(name);
    if (existsSync(p)) throw new Error(`${p} already exists: run "remove ${name}" first`);
    git('worktree', 'add', '--no-checkout', '--detach', p, ref);
    git('-C', p, 'sparse-checkout', 'set', '--no-cone', '/*', '!/public/audio/');
    git('-C', p, 'checkout', '--detach', 'HEAD');
    symlinkSync(join(root, 'node_modules'), join(p, 'node_modules'), 'junction');
    mkdirSync(join(p, 'public', 'dict'), { recursive: true });
    for (const f of ['cedict.tsv', 't2s.json']) {
      const src = join(root, 'public', 'dict', f);
      if (existsSync(src)) copyFileSync(src, join(p, 'public', 'dict', f));
    }
    console.log(`Worktree ready: ${p}`);
    break;
  }
  case 'build': {
    const [name] = rest;
    process.exit(run('npm', ['run', 'build'], { cwd: wtPath(name) }));
  }
  case 'remove': {
    const [name] = rest;
    if (!name) throw new Error('usage: remove <name>');
    const p = wtPath(name);
    unlinkDir(join(p, 'node_modules'));
    if (existsSync(p)) git('worktree', 'remove', '--force', p);
    git('worktree', 'prune');
    console.log(`Removed ${p}`);
    break;
  }
  case 'pairs': {
    const only = (flag('only') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const [beforeArg, afterArg, outArg] = rest;
    if (!beforeArg || !afterArg || !outArg) throw new Error('usage: pairs <beforeDir> <afterDir> <outDir> [--only a,b]');
    const [before, after, out] = [beforeArg, afterArg, outArg].map((p) => resolve(root, p));
    // Units to compare: still PNGs, and motion interaction folders (the ones holding frames.txt).
    const units = (d: string, rel = ''): string[] =>
      readdirSync(join(d, rel), { withFileTypes: true }).flatMap((e) => {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) return existsSync(join(d, r, 'frames.txt')) ? [r] : units(d, r);
        return e.name.endsWith('.png') ? [r] : [];
      });
    // Stills: only if the pixels changed. Motion frames always differ in timing, so they're kept (narrow them with --only).
    const differs = (r: string) => !r.endsWith('.png') || !readFileSync(join(before, r)).equals(readFileSync(join(after, r)));
    const list = units(before)
      .filter((r) => existsSync(join(after, r)) && (!only.length || only.some((o) => r.startsWith(o))))
      .filter(differs);
    const jobs = list.flatMap((r) => [{ r, afterIs: 'A' }, { r, afterIs: 'B' }]);
    for (let i = jobs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
    }
    mkdirSync(out, { recursive: true });
    const key: Record<string, { screen: string; after: string }> = {};
    const lines: string[] = [];
    jobs.forEach((job, i) => {
      const id = `pair-${String(i + 1).padStart(2, '0')}`;
      const ext = job.r.endsWith('.png') ? '.png' : '';
      const [a, b] = job.afterIs === 'A' ? [after, before] : [before, after];
      mkdirSync(join(out, id), { recursive: true });
      cpSync(join(a, job.r), join(out, id, `A${ext}`), { recursive: true });
      cpSync(join(b, job.r), join(out, id, `B${ext}`), { recursive: true });
      key[id] = { screen: job.r.replace(/\.png$/, ''), after: job.afterIs };
      lines.push(`${id}: ${job.r.replace(/\.png$/, '')}`);
    });
    writeFileSync(join(out, 'pairs.txt'), lines.join('\n') + '\n');
    const keys = join(root, 'design-review', 'keys');
    mkdirSync(keys, { recursive: true });
    const keyFile = join(keys, `${basename(out)}.json`);
    writeFileSync(keyFile, JSON.stringify(key, null, 2));
    console.log(`Wrote ${jobs.length} pairs (${list.length} screens, both orders) to ${out}; key: ${keyFile}`);
    break;
  }
  case 'compare': {
    const [dirArg, ...title] = rest;
    if (!dirArg) throw new Error('usage: compare <dir> [title]');
    const dir = resolve(root, dirArg);
    const pngs = (d: string): string[] =>
      existsSync(d)
        ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pngs(join(d, e.name)) : e.name.endsWith('.png') ? [join(d, e.name)] : []))
        : [];
    const all = pngs(join(dir, 'before'))
      .map((f) => relative(join(dir, 'before'), f).split('\\').join('/'))
      .sort();
    // Only screens that changed: identical before/after files are left out and listed by name at the end.
    const same = (r: string) => existsSync(join(dir, 'after', r)) && readFileSync(join(dir, 'before', r)).equals(readFileSync(join(dir, 'after', r)));
    const unchanged = all.filter(same);
    const rows = all
      .filter((r) => !same(r))
      .map((r) => {
        const after = existsSync(join(dir, 'after', r)) ? `<img src="after/${r}">` : '<p>(no after shot)</p>';
        return `<h2>${r.replace(/\.png$/, '')}</h2><div class="pair"><figure><figcaption>Before</figcaption><img src="before/${r}"></figure><figure><figcaption>After</figcaption>${after}</figure></div>`;
      });
    const name = title.join(' ') || 'Design preview';
    const css =
      'body{font:16px system-ui;margin:16px;background:#f4f4f4;color:#111}h2{font-size:15px;margin:28px 0 8px}' +
      '.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{width:100%;border:1px solid #ccc}';
    writeFileSync(join(dir, 'compare.html'), `<!doctype html><meta charset="utf-8"><title>${name}</title><style>${css}</style><h1>${name}</h1>${rows.length ? rows.join('') : '<p>No screen changed.</p>'}${unchanged.length ? `<h2>Unchanged (not shown)</h2><p>${unchanged.map((r) => r.replace(/\.png$/, '')).join(', ')}</p>` : ''}`);
    console.log(`Wrote ${join(dir, 'compare.html')} (${rows.length} changed screens, ${unchanged.length} unchanged left out)`);
    break;
  }
  default:
    console.log('usage: design-preview.ts shots|motion|worktree|build|remove|compare … (see the comment at the top)');
    process.exit(1);
}
