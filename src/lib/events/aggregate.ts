import fienta from './sources/fienta.ts'
import {normalizeEvents} from './normalize.ts'
import {readCache,writeCache} from './cache.ts'
import type {EventSourceAdapter,EventSnapshot,NormalizedEvent} from './types.ts'
export async function collectEvents(adapters:EventSourceAdapter[],fallback:NormalizedEvent[]=[],now=new Date()):Promise<EventSnapshot>{
 const output=await Promise.allSettled(adapters.map(a=>a.fetchEvents())),live=output.flatMap(r=>r.status==='fulfilled'?r.value:[])
 return {events:normalizeEvents(live.length?live:fallback,now),fetchedAt:now.toISOString(),mode:live.length?'live':'fallback',failures:output.flatMap(r=>r.status==='rejected'?[String(r.reason)]:[])}
}
export async function buildEventSnapshot(options:{force?:boolean}={}){const cache=await readCache();if(!options.force&&process.env.FIENTA_REFRESH!=='1'&&cache&&cache.mode==='live'&&Date.now()-Date.parse(cache.fetchedAt)<6*3600000)return {...cache,events:normalizeEvents(cache.events),mode:'cache' as const};const snapshot=await collectEvents([fienta],cache?.events||[]);if(snapshot.mode!=='live'&&cache)snapshot.fetchedAt=cache.fetchedAt;await writeCache(snapshot);return snapshot}
