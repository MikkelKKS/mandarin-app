# Mandarin practice pack: prompt for Claude

You are writing a **practice pack** for my Mandarin learning app. Below this prompt is a JSON export of my weak spots: the words I keep missing, tone pairs I confuse, grammar I get wrong, sentences I missed recently, and every word I already know (`knownVocabulary`).

Write a pack that drills those weak spots in natural, everyday **Mainland Mandarin** (simplified characters), the kind I'd use with my girlfriend's family. Write original sentences; don't copy textbook dialogues.

## Output
Reply with **one JSON code block only**, following this format exactly. No comments inside the JSON.

```
{
  "format": "mandarin-practice-pack/1",
  "title": "short title, max 80 characters",
  "focus": "one line on what this pack trains",
  "words":     [ Word, ... ],      // only NEW words; may be empty
  "sentences": [ Sentence, ... ],  // 8–15
  "exchanges": [ Exchange, ... ],  // 3–6 "what would you say?" items
  "notes":     [ Note, ... ],      // 0–2 short tips
  "dialogue":  Dialogue            // optional, 4–8 lines
}
Word     = { "id", "hanzi", "pinyin", "english": [..], "hsk": 0-6, "pos" }
Sentence = { "id", "hanzi", "pinyin", "english", "words": [word ids in order], "alt"?: { "english"?: [..], "pinyin"?: [..] } }
Exchange = { "id", "prompt": sentence id, "reply": sentence id, "wrong": [2+ sentence ids], "context": "one line" }
Note     = { "id", "title", "body", "examples": [sentence ids] }
Dialogue = { "id", "title", "setting", "speakers": [{ "id", "name", "voice": "f"|"m" }],
             "lines": [{ "speaker", "sentence": sentence id }],
             "questions": [{ "q", "options": [2-4 strings], "answer": index of correct option }] }
pos is one of: noun pronoun verb adjective adverb number measure particle preposition conjunction phrase name time question interjection
```

## Rules (the app rejects packs that break them)
1. **IDs:** every id you create starts with `p-` plus a short slug for this pack, e.g. `p-tones2-s1`, `p-tones2-tang`. Lowercase letters, digits and dashes only. Make the slug different from earlier packs.
2. **Sentence `words`:** list word ids in order. Each id must be either from `knownVocabulary` or a new word in this pack's `words`. **Their characters joined together must spell the sentence exactly**, ignoring punctuation.
3. **Pinyin:** use tone marks, one syllable per character, syllables of a word joined (`péngyou`), neutral tone unmarked. Write 不 and 一 with their spoken tone (`bú shì`, `yí ge`); leave 3rd-tone sandhi unmarked (`nǐ hǎo`). No erhua (儿).
4. **Mostly known words:** at most 6 new words. Build the rest from `knownVocabulary`.
5. Exchanges and dialogue lines refer to sentences by id. They can be this pack's sentences or ids listed in my export.
6. In each exchange, the `wrong` replies must be clearly wrong in context, not just less polite.
7. Keep English text short and plain. Never use em dashes (—).
8. Aim at my weak spots: reuse weak words in new sentences, contrast confused tones (e.g. pair words with tones 2 and 3), and give 2–3 sentences per hard grammar point.

## Example (for format only; write different content)
```json
{
  "format": "mandarin-practice-pack/1",
  "title": "Third tones at the dinner table",
  "focus": "Third-tone words (我, 很, 好, 饱) and offering food",
  "words": [
    { "id": "p-dinner-tang", "hanzi": "汤", "pinyin": "tāng", "english": ["soup"], "hsk": 0, "pos": "noun" }
  ],
  "sentences": [
    { "id": "p-dinner-s1", "hanzi": "我很饱。", "pinyin": "Wǒ hěn bǎo.", "english": "I'm very full.", "words": ["w-wo", "w-hen", "w-bao"] },
    { "id": "p-dinner-s2", "hanzi": "你要喝汤吗？", "pinyin": "Nǐ yào hē tāng ma?", "english": "Would you like some soup?", "words": ["w-ni", "w-yao", "w-he-drink", "p-dinner-tang", "w-ma"] },
    { "id": "p-dinner-s3", "hanzi": "好啊，谢谢！", "pinyin": "Hǎo a, xièxie!", "english": "Sure, thanks!", "words": ["w-hao", "w-a", "w-xiexie"] },
    { "id": "p-dinner-s4", "hanzi": "汤很好喝！", "pinyin": "Tāng hěn hǎohē!", "english": "The soup is delicious!", "words": ["p-dinner-tang", "w-hen", "w-hao", "w-he-drink"] }
  ],
  "exchanges": [
    { "id": "p-dinner-x1", "prompt": "p-dinner-s2", "reply": "p-dinner-s3", "wrong": ["s-zheshishei", "s-nijiaoshenmemingzi"], "context": "You're offered soup." }
  ],
  "notes": [
    { "id": "p-dinner-g1", "title": "Two 3rd tones in a row", "body": "When two 3rd tones meet, the first is said as a 2nd tone: 很饱 sounds like hén bǎo. It's still written hěn bǎo.", "examples": ["p-dinner-s1"] }
  ],
  "dialogue": {
    "id": "p-dinner-d1",
    "title": "Soup?",
    "setting": "Her mother brings soup to the table.",
    "speakers": [{ "id": "M", "name": "Her mother", "voice": "f" }, { "id": "K", "name": "Mikkel", "voice": "m" }],
    "lines": [
      { "speaker": "M", "sentence": "p-dinner-s2" },
      { "speaker": "K", "sentence": "p-dinner-s3" },
      { "speaker": "K", "sentence": "p-dinner-s4" }
    ],
    "questions": [{ "q": "What does Mikkel think of the soup?", "options": ["It's delicious", "It's too spicy", "He's too full"], "answer": 0 }]
  }
}
```

## My weak spots
