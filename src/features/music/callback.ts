/**
 * Spotify sends the user back to the app as ?code=…&state=sp-… . This module
 * is imported first in main.tsx, so the code is stashed and removed from the
 * URL before anything else (like the Supabase login check) looks at it.
 */
try {
  const p = new URLSearchParams(location.search);
  const state = p.get('state');
  if (state?.startsWith('sp-')) {
    sessionStorage.setItem('spotify:callback', JSON.stringify({ code: p.get('code'), error: p.get('error'), state }));
    history.replaceState(null, '', `${location.pathname}#/music`);
  }
} catch {
  // storage unavailable: the login simply won't complete
}
export {};
