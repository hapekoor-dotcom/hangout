import type {EventSnapshot} from './types'
let pending:Promise<EventSnapshot>|undefined
export function getEventFeed(){return pending??=fetch(new URL('fienta-events.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('No snapshot');return r.json() as Promise<EventSnapshot>}).catch(()=>({events:[],fetchedAt:'',mode:'fallback' as const,failures:['Feed unavailable']}))}
export async function getUpcomingEvents(){return (await getEventFeed()).events}
