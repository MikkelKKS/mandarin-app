/**
 * On a phone, the on-screen keyboard takes half the screen. While a text field is focused on a
 * touch screen and the screen has shrunk for the keyboard, `<html data-kb="open">` is set: the
 * bottom bar folds into one row and the session header gets out of the way (index.css), and the
 * field (with its tone row) is scrolled to sit just above the bottom bar instead of behind it.
 */
const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|)$/.test((el as HTMLInputElement).type)));

/** Is the keyboard open? Either the view shrank by 20% from the tallest we've seen at this width,
 * or it's under 70% of the physical screen height (catches the case where we never saw it closed). */
export function keyboardOpen(h: number, tallest: number, innerWidth: number, screenW: number, screenH: number): boolean {
  const short = Math.min(screenW, screenH);
  const long = Math.max(screenW, screenH);
  const screenTall = innerWidth > short + 1 ? short : long; // landscape: the short side is the height
  return h < tallest * 0.8 || (screenTall > 0 && h < screenTall * 0.7);
}

/** How far to scroll so `box` ends just above the fixed bottom bar (or the visible area). */
export function revealOffset(boxTop: number, boxBottom: number, limit: number, topLimit: number): number {
  const gap = 8;
  const down = boxBottom + gap - limit;
  if (down <= 0) return 0;
  // Never push the top of the field above the header.
  return Math.min(down, Math.max(0, boxTop - topLimit));
}

export function startKeyboardMode(): void {
  if (typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  const height = () => vv?.height ?? window.innerHeight;
  // The full height for the current width (turning the phone starts over).
  let full = { width: window.innerWidth, height: height() };

  // The field plus whatever belongs right under it (the tone row), scrolled clear of the bar.
  const reveal = () => {
    const el = document.activeElement;
    if (!isField(el)) return;
    const box = (el.closest('[data-typebox]') ?? el).getBoundingClientRect();
    const viewBottom = (vv?.offsetTop ?? 0) + height();
    const bars = Array.from(document.querySelectorAll<HTMLElement>('.kb-bar'))
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.top < viewBottom);
    const limit = Math.min(viewBottom, ...bars.map((r) => r.top));
    const header = document.querySelector<HTMLElement>('.kb-head');
    const topLimit = header ? header.getBoundingClientRect().bottom : 0;
    const dy = revealOffset(box.top, box.bottom, limit, topLimit);
    if (dy > 0) window.scrollBy({ top: dy });
  };
  let frame = 0;
  const revealSoon = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(reveal));
  };

  const update = () => {
    const h = height();
    if (window.innerWidth !== full.width) full = { width: window.innerWidth, height: h };
    else if (h > full.height) full.height = h;
    const focused = isField(document.activeElement);
    const open = focused && keyboardOpen(h, full.height, window.innerWidth, screen.width, screen.height);
    if (open !== (root.dataset.kb === 'open')) {
      if (open) root.dataset.kb = 'open';
      else delete root.dataset.kb;
    }
    // The keyboard slides in over several frames: keep the field in view the whole way.
    if (open) revealSoon();
  };

  vv?.addEventListener('resize', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', () => setTimeout(update, 300));
  // Typing can wrap the field's surroundings; keep it visible.
  document.addEventListener('input', () => root.dataset.kb === 'open' && revealSoon());
  // A moment's grace: tapping a tone button keeps the focus, tapping Check ends typing anyway.
  document.addEventListener('focusout', () => setTimeout(update, 150));
}
