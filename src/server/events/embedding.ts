import type {NormalizedEvent} from '../../lib/events/types.ts'
export function embeddingText(event:NormalizedEvent){return [event.title,event.categories.join(', '),event.aiSummary,event.description,event.venue,event.tags.join(', '),event.vibe?.join(', '),event.goodFor?.join(', ')].filter(Boolean).join('\n').slice(0,22000)}
