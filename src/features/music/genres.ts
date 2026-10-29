/**
 * Mandarin music scenes: the filter on the Music page, and the starting artists
 * for the song catalogue (scripts/build-songs.ts adds many more from MusicBrainz).
 */
export interface Scene {
  id: string;
  label: string;
  hanzi: string;
  note: string;
  artists: string[];
}

export const SCENES: Scene[] = [
  {
    id: 'easy',
    label: 'Easy songs',
    hanzi: '儿歌',
    note: "Children's songs: slow, clear and simple. The best start at HSK 1 and 2.",
    artists: [],
  },
  {
    id: 'pop',
    label: 'Mandopop',
    hanzi: '流行',
    note: 'Big Mandarin pop hits.',
    artists: ['周杰伦', '林俊杰', '邓紫棋', '王力宏', '蔡依林', '孙燕姿', '李荣浩', '毛不易'],
  },
  {
    id: 'ballad',
    label: 'Ballads',
    hanzi: '情歌',
    note: 'Slow love songs. Clear singing, so good for listening.',
    artists: ['梁静茹', '王菲', '邓丽君', '莫文蔚', '田馥甄', '李健', '张学友'],
  },
  {
    id: 'rock',
    label: 'Rock',
    hanzi: '摇滚',
    note: 'Including Beijing rock: 崔健, 新裤子, 痛仰.',
    artists: ['五月天', '新裤子', '痛仰乐队', '崔健', '朴树', '逃跑计划'],
  },
  {
    id: 'indie',
    label: 'Indie',
    hanzi: '独立',
    note: 'Indie bands from Beijing, Taipei and beyond.',
    artists: ['草东没有派对', '万能青年旅店', '告五人', '陈粒', 'deca joins', '回春丹'],
  },
  {
    id: 'folk',
    label: 'Folk',
    hanzi: '民谣',
    note: 'Gentle and wordy. Beijing folk singers like 宋冬野 and 马頔 sing about the city.',
    artists: ['宋冬野', '马頔', '赵雷', '好妹妹乐队', '陈鸿宇', '房东的猫'],
  },
  {
    id: 'rnb',
    label: 'R&B',
    hanzi: '节奏布鲁斯',
    note: 'Smooth Mandarin R&B and soul.',
    artists: ['陶喆', '方大同', '袁娅维', '王力宏'],
  },
  {
    id: 'hiphop',
    label: 'Hip hop',
    hanzi: '说唱',
    note: 'Fast and full of slang: hard, but great for the ear.',
    artists: ['法老', '艾热', '蛋堡', '王以太', '马思唯', '热狗'],
  },
];

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
