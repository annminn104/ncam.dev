import { estimateReadingTime } from '../../../../lib/reading-time';

interface ArticleEvent {
  params: { data?: { body?: unknown; readingTime?: number } };
}

/** Recompute `readingTime` whenever a payload carries `body` (create, update, publish). */
function applyReadingTime(event: ArticleEvent): void {
  const data = event.params.data;
  if (!data || !('body' in data)) return;
  data.readingTime = estimateReadingTime(data.body);
}

export default {
  beforeCreate: applyReadingTime,
  beforeUpdate: applyReadingTime,
};
