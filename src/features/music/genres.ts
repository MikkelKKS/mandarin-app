/**
 * Mandarin music scenes, each with a few well-known artists to search for,
 * Spotify genre names, and the Western genres that point a listener towards it.
 */
export interface Scene {
  id: string;
  label: string;
  hanzi: string;
  note: string;
  artists: string[];
  spotifyGenres: string[];
  /** Plain searches, used when a scene has no artist list. */
  queries?: string[];
  /** Substrings of Western Spotify genres that suggest this scene. */
  western: string[];
}

export const SCENES: Scene[] = [
  {
    id: 'easy',
    label: 'Easy songs',
    hanzi: '儿歌',
    note: "Children's songs: slow, clear and simple. The best start at HSK 1 and 2.",
    artists: [],
    spotifyGenres: [],
    queries: ['儿歌', '中文儿歌'],
    western: [],
  },
  {
    id: 'pop',
    label: 'Mandopop',
    hanzi: '流行',
    note: 'Big Mandarin pop hits.',
    artists: ['周杰伦', '林俊杰', '邓紫棋', '王力宏', '蔡依林', '孙燕姿', '李荣浩', '毛不易'],
    spotifyGenres: ['mandopop', 'c-pop', 'taiwan pop'],
    western: ['pop', 'dance', 'k-pop', 'j-pop', 'electro', 'edm', 'house'],
  },
  {
    id: 'ballad',
    label: 'Ballads',
    hanzi: '情歌',
    note: 'Slow love songs. Clear singing, so good for listening.',
    artists: ['梁静茹', '王菲', '邓丽君', '莫文蔚', '田馥甄', '李健', '张学友'],
    spotifyGenres: ['chinese ballad'],
    western: ['singer-songwriter', 'soft rock', 'ballad', 'adult standards', 'piano', 'acoustic pop'],
  },
  {
    id: 'rock',
    label: 'Rock',
    hanzi: '摇滚',
    note: 'Including Beijing rock: 崔健, 新裤子, 痛仰.',
    artists: ['五月天', '新裤子', '痛仰乐队', '崔健', '朴树', '逃跑计划'],
    spotifyGenres: ['chinese rock', 'taiwan rock', 'mandarin rock'],
    western: ['rock', 'punk', 'metal', 'grunge', 'emo', 'alternative'],
  },
  {
    id: 'indie',
    label: 'Indie',
    hanzi: '独立',
    note: 'Indie bands from Beijing, Taipei and beyond.',
    artists: ['草东没有派对', '万能青年旅店', '告五人', '陈粒', 'deca joins', '回春丹'],
    spotifyGenres: ['chinese indie', 'taiwan indie', 'mandarin indie'],
    western: ['indie', 'dream pop', 'shoegaze', 'lo-fi', 'bedroom pop', 'post-punk'],
  },
  {
    id: 'folk',
    label: 'Folk',
    hanzi: '民谣',
    note: 'Gentle and wordy. Beijing folk singers like 宋冬野 and 马頔 sing about the city.',
    artists: ['宋冬野', '马頔', '赵雷', '好妹妹乐队', '陈鸿宇', '房东的猫'],
    spotifyGenres: ['chinese folk', 'mandarin folk'],
    western: ['folk', 'acoustic', 'country', 'americana', 'bluegrass'],
  },
  {
    id: 'rnb',
    label: 'R&B',
    hanzi: '节奏布鲁斯',
    note: 'Smooth Mandarin R&B and soul.',
    artists: ['陶喆', '方大同', '袁娅维', '王力宏'],
    spotifyGenres: ['chinese r&b'],
    western: ['r&b', 'soul', 'funk', 'neo soul'],
  },
  {
    id: 'hiphop',
    label: 'Hip hop',
    hanzi: '说唱',
    note: 'Fast and full of slang: hard, but great for the ear.',
    artists: ['法老', '艾热', '蛋堡', '王以太', '马思唯', '热狗'],
    spotifyGenres: ['chinese hip hop', 'c-rap', 'taiwan hip hop'],
    western: ['hip hop', 'rap', 'trap', 'grime', 'drill'],
  },
];

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/**
 * Suggest scenes from a listener's top artists: Chinese genres count
 * directly, Western genres map to the closest Mandarin scene.
 */
export function suggestScenes(artists: Array<{ name: string; genres: string[] }>): { scenes: string[]; chineseArtists: string[] } {
  const score = new Map<string, number>();
  const chineseArtists: string[] = [];
  artists.forEach((a, rank) => {
    const weight = 1 + (artists.length - rank) / artists.length; // favourites count more
    for (const g of a.genres) {
      const genre = g.toLowerCase();
      const direct = SCENES.find((s) => s.spotifyGenres.includes(genre));
      if (direct) {
        score.set(direct.id, (score.get(direct.id) ?? 0) + 3 * weight);
        if (!chineseArtists.includes(a.name)) chineseArtists.push(a.name);
        continue;
      }
      for (const s of SCENES) if (s.western.some((w) => genre.includes(w))) score.set(s.id, (score.get(s.id) ?? 0) + weight);
    }
  });
  const scenes = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
  return { scenes: scenes.length ? scenes : ['pop', 'ballad'], chineseArtists };
}
