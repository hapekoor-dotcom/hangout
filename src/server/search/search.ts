import {createHash} from 'node:crypto'
import {supabase} from '../db/supabase.ts'
import {embed} from '../ai/client.ts'
import type {StoredEvent} from '../events/ingest.ts'
import {parseAIIntent} from './parseIntent.ts'
import {hardFilters} from './hardFilters.ts'
import {retrieveCandidates} from './retrieveCandidates.ts'
import {rerank} from './rerank.ts'
import type {Position,Bounds,EventItem} from '../../lib/search/types.ts'
export async function search(query:string,position:Position,bounds?:Bounds){
 const db=supabase(),key=createHash('sha256').update(JSON.stringify({version:'preindexed-catalog-v4',query:query.trim().toLowerCase(),position,bounds,bucket:Math.floor(Date.now()/300000)})).digest('hex')
 const cached=await db.request<any[]>('hangout_search_cache?cache_key=eq.'+key+'&select=payload,expires_at')
 if(cached[0]&&Date.parse(cached[0].expires_at)>Date.now())return cached[0].payload
 const intent=await parseAIIntent(query)
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn'}).format(new Date())
 const stored=await db.request<StoredEvent[]>('hangout_events?active=eq.true&data->>date=gte.'+today+'&select=id,data,content_hash,embedding_model,enrichment_version&order=data->>date.asc&limit=1000')
 if(!stored.length)throw Error('Indexed catalog unavailable')
 const records:EventItem[]=stored.map(row=>({...row.data,venue:row.data.venue||'Venue on Fienta'}))
 const eligible=hardFilters(records,intent,position,new Date(),bounds)
 const candidates=eligible.length?await retrieveCandidates(eligible,await embed(query)):[]
 const approvedCandidates=hardFilters(candidates,intent,position,new Date(),bounds)
 const reranked=await rerank(query,intent,approvedCandidates,position)
 const approved=new Set(hardFilters(approvedCandidates,intent,position,new Date(),bounds).map(e=>e.id))
 const payload={intent,results:reranked.filter(r=>approved.has(r.event.id)),mode:'ai'}
 await db.request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:key,payload,expires_at:new Date(Date.now()+300000).toISOString()},'resolution=merge-duplicates,return=minimal')
 return payload
}
