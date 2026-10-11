import { exchanges } from '../../content';
import type { Exercise } from '../lesson/types';
import { BuildSentence, EnToPinyin, FillGap, ListenTiles } from './Building';
import { Dictation, ListenMeaning, ListenSentence, MinimalPair, ReplyType, ToneId, WhatWouldYouSay } from './Listening';
import { Intro, MatchPairs, PickCharacter, ReadSentence } from './Recognition';

export function ExerciseView({ ex }: { ex: Exercise }) {
  switch (ex.kind) {
    case 'intro':
      return <Intro ex={ex} />;
    case 'listen-meaning':
      return <ListenMeaning ex={ex} />;
    case 'listen-sentence':
      return <ListenSentence ex={ex} />;
    case 'listen-tiles':
      return <ListenTiles ex={ex} />;
    case 'dictation':
      return <Dictation ex={ex} />;
    case 'tone-id':
      return <ToneId ex={ex} />;
    case 'minimal-pair':
      return <MinimalPair ex={ex} />;
    case 'what-would-you-say':
      return <WhatWouldYouSay ex={ex} />;
    case 'reply-type':
      return <ReplyType ex={ex} />;
    case 'en-to-pinyin':
      return <EnToPinyin ex={ex} />;
    case 'fill-gap':
      return <FillGap ex={ex} />;
    case 'build-sentence':
      return <BuildSentence ex={ex} />;
    case 'match-pairs':
      return <MatchPairs ex={ex} />;
    case 'pick-character':
      return <PickCharacter ex={ex} />;
    case 'read-sentence':
      return <ReadSentence ex={ex} />;
    default:
      return null;
  }
}

/** Items an exercise practises (for review scheduling), unless the outcome says otherwise. */
export function itemsOf(ex: Exercise): string[] {
  switch (ex.kind) {
    case 'listen-meaning':
    case 'listen-sentence':
    case 'dictation':
    case 'tone-id':
    case 'en-to-pinyin':
      return [ex.itemId];
    case 'listen-tiles':
    case 'build-sentence':
    case 'read-sentence':
    case 'fill-gap':
      return [ex.sentenceId];
    case 'pick-character':
      return [ex.wordId];
    case 'what-would-you-say':
    case 'reply-type':
      return [exchanges.get(ex.exchangeId)!.reply];
    case 'match-pairs':
      return ex.wordIds;
    default:
      return [];
  }
}

/** Ids whose audio this exercise will play first (for preloading). */
export function audioOf(ex: Exercise): string[] {
  switch (ex.kind) {
    case 'intro':
      return [ex.wordId];
    case 'listen-meaning':
    case 'listen-sentence':
    case 'dictation':
    case 'tone-id':
      return [ex.itemId];
    case 'listen-tiles':
      return [ex.sentenceId];
    case 'minimal-pair':
      return [ex.answer === 0 ? ex.a : ex.b];
    case 'what-would-you-say':
    case 'reply-type':
      return [exchanges.get(ex.exchangeId)!.prompt];
    default:
      return [];
  }
}
