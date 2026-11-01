/** The grammar topics, bundled with the app (content/grammar/*.json). */
import { topicsOf, type Topic, type TopicFile } from './grammarTopics';

const files = import.meta.glob('../../content/grammar/*.json', { eager: true, import: 'default' }) as Record<string, TopicFile>;

export const TOPICS: Topic[] = topicsOf(
  Object.keys(files)
    .sort()
    .map((k) => files[k]),
);
export const topicById = new Map(TOPICS.map((t) => [t.id, t]));
