/**
 * On a phone, the on-screen keyboard takes half the screen. While a text field is focused on a
 * touch screen and the screen has shrunk for the keyboard, `<html data-kb="open">` is set: the
 * bottom bar folds into one row and the session header gets out of the way (index.css), and the
 * field (with its tone row) is scrolled to sit just above the bottom bar instead of behind it.
 */
const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|)$/.test((el as HTMLInputElement).type)));

export function startKeyboardMode(): void {
  if (typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  const height = () => window.visualViewport?.height ?? window.innerHeight;
  // The full height for the current width (turning the phone starts over).
  let full = { width: window.innerWidth, height: height() };

  // The field plus whatever belongs right under it (the tone row), scrolled clear of the bar.
  const reveal = () => {
    const el = document.activeElement;
    if (isField(el)) (el.closest('[data-typebox]') ?? el).scrollIntoView({ block: 'end' });
  };
  const update = () => {
    const h = height();
    if (window.innerWidth !== full.width) full = { width: window.innerWidth, height: h };
    else if (h > full.height) full.height = h;
    const open = isField(document.activeElement) && h < full.height * 0.8;
    if (open === (root.dataset.kb === 'open')) return;
    if (open) {
      root.dataset.kb = 'open';
      requestAnimationFrame(reveal);
    } else delete root.dataset.kb;
  };

  window.visualViewport?.addEventListener('resize', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', () => setTimeout(update, 300));
  // A moment's grace: tapping a tone button keeps the focus, tapping Check ends typing anyway.
  document.addEventListener('focusout', () => setTimeout(update, 150));
}
