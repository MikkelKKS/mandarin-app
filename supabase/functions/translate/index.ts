// Supabase Edge Function: sentence translation with Azure Translator (free F0 tier,
// 2 million characters a month, never billed). The key lives here as a secret, so
// it is never in the app's public code. Only the app's owner, signed in, may use it.
//
// Secrets (set by .github/workflows/translate-function.yml):
//   AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, OWNER_ID (the owner's Supabase user id)
import { createClient } from 'npm:@supabase/supabase-js@2.50.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Who is asking? Only the owner's account.
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data } = await supabase.auth.getUser();
  const owner = (Deno.env.get('OWNER_ID') ?? '').trim();
  if (!data.user || !owner || data.user.id !== owner) return json({ error: 'Not allowed' }, 403);

  const key = Deno.env.get('AZURE_TRANSLATOR_KEY');
  const region = Deno.env.get('AZURE_TRANSLATOR_REGION') ?? 'swedencentral';
  if (!key) return json({ error: 'Translator not set up' }, 503);

  const { text, dir } = (await req.json().catch(() => ({}))) as { text?: string; dir?: 'zh-en' | 'en-zh' };
  const q = (text ?? '').trim().slice(0, 500);
  if (!q || (dir !== 'zh-en' && dir !== 'en-zh')) return json({ error: 'Bad request' }, 400);

  // English → Chinese also asks for the pinyin (Latin script) of the result.
  const params = dir === 'zh-en' ? 'from=zh-Hans&to=en' : 'from=en&to=zh-Hans&toScript=Latn';
  const res = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&${params}`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Ocp-Apim-Subscription-Region': region, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ Text: q }]),
  });
  if (!res.ok) return json({ error: `Azure ${res.status}` }, res.status === 429 ? 429 : 502);
  const out = (await res.json()) as Array<{ translations: Array<{ text: string; transliteration?: { text: string } }> }>;
  const t = out[0]?.translations?.[0];
  if (!t?.text) return json({ error: 'No translation' }, 502);
  return json({ text: t.text, pinyin: t.transliteration?.text });
});
