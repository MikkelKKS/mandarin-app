#!/usr/bin/env node
/**
 * Claude Code status line for this repo (set in .claude/settings.json).
 * While the design-loop branch is checked out, it shows the loop's progress from
 * DESIGN_LOOP.md, e.g.
 *   Design loop ▓▓▓▓▓░░░░░░░░░░░ 31% · round 2/4 · building 1/3 · lowest 6.5 · C7 T7 M6.5 L7 O7
 * Otherwise it shows the branch name. Never fails loudly: any error prints a plain line.
 */
const fs = require('fs');
const path = require('path');

function main(input) {
  let dir = process.cwd();
  try {
    const j = JSON.parse(input || '{}');
    dir = j.workspace?.project_dir || j.workspace?.current_dir || j.cwd || dir;
  } catch {}
  const head = fs.readFileSync(path.join(dir, '.git', 'HEAD'), 'utf8').trim();
  const branch = head.startsWith('ref: refs/heads/') ? head.slice(16) : head.slice(0, 7);
  if (branch !== 'design-loop') return branch;

  const log = fs.readFileSync(path.join(dir, 'DESIGN_LOOP.md'), 'utf8').replace(/\r\n/g, '\n');
  const loop = log.slice(log.lastIndexOf('\n## Loop'));
  const field = (k) => (loop.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1]?.trim() ?? '';
  const state = field('State');
  const round = Number(field('Round')) || 0;
  const max = Number(field('Max rounds')) || 8;
  const phase = field('Phase');
  const confirming = field('Confirming') === 'yes';

  // Plan checklist of the current round: "- [x]" done, "- [ ]" to do.
  const sec = loop.split(`\n### Round ${round}\n`)[1]?.split('\n### Round ')[0] ?? '';
  const todo = (sec.match(/^- \[ \]/gm) || []).length;
  const done = (sec.match(/^- \[x\]/gim) || []).length;
  const total = todo + done;

  // Within a round: review 0–30%, decide 30%, build 30–100% by changes done.
  let within = 0;
  let label = 'reviewing';
  if (phase === 'decide') (within = 0.3), (label = 'deciding');
  else if (phase === 'build') (within = 0.3 + 0.7 * (total ? done / total : 0)), (label = `building ${Math.min(done + 1, total || 1)}/${total || '?'}`);
  if (confirming && phase === 'review') label = 'confirming';
  // Phase "review" with every planned change ticked: this round is built, the next review is about to start.
  if (phase === 'review' && total > 0 && todo === 0) (within = 1), (label = `round ${round} built, next: review`);
  let frac = Math.max(0, Math.min(1, (Math.max(round, 1) - 1 + within) / max));
  if (/^stopped|^merged|^parked|^rejected/.test(state)) (frac = 1), (label = state);

  const width = 16;
  const filled = Math.round(frac * width);
  const bar = '▓'.repeat(filled) + '░'.repeat(width - filled);

  // Latest scored row of the table: | n | C | T | M | L | O | lowest | note |
  const rows = [...loop.matchAll(/^\| (\d+) \| ([\d.–-]+) \| ([\d.–-]+) \| ([\d.–-]+) \| ([\d.–-]+) \| ([\d.–-]+) \| ([\d.–-]+) \|/gm)];
  const last = rows[rows.length - 1];
  const scores = last ? ` · lowest ${last[7]} · C${last[2]} T${last[3]} M${last[4]} L${last[5]} O${last[6]}` : '';
  return `Design loop ${bar} ${Math.round(frac * 100)}% · round ${Math.max(round, 1)}/${max} · ${label}${scores}`;
}

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    process.stdout.write(main(input));
  } catch {
    process.stdout.write('mandarin-app');
  }
});
