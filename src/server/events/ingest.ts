import {createHash,randomUUID} from 'node:crypto'
import {supabase} from '../db/supabase.ts'
import fienta from '../../lib/events/sources/fienta.ts'
import {normalizeEvents} from '../../lib/events/normalize.ts'
import {enrichEvent,ENRICHMENT_VERSION} from './enrichEvent.ts'
import {embeddingText} from './embedding.ts'
import {embed,embeddingModel} from '../ai/client.ts'
import type {NormalizedEvent} from '../../lib/events/types.ts'
export type StoredEvent={id:string;data:NormalizedEvent;content_hash:string;embedding_model:string|null;enrichment_version:string|null}
export async function ingest(force=false){
 const db=supabase(),owner=randomUUID()
 const state=await db.request<any[]>('hangout_search_cache?cache_key=eq.fienta_refresh&select=expires_at')
 if(!force&&state[0]&&Date.parse(state[0].expires_at)>Date.now())return {mode:'cached'}
 if(!await db.rpc<boolean>('hangout_claim_job',{job_name:'fienta_refresh',job_owner:owner,lease_seconds:120}))return {mode:'busy'}
 try{
  const events=normalizeEvents(await fienta.fetchEvents())
  if(!events.length)throw Error('Fienta returned no upcoming Tallinn events; existing records preserved')
  const old=await db.request<StoredEvent[]>('hangout_events?select=id,content_hash&limit=1000'),hashes=new Map(old.map(e=>[e.id,e.content_hash]))
  const rows=events.map(event=>{const hash=createHash('sha256').update(JSON.stringify(event)).digest('hex');return hashes.get(event.id)===hash?{id:event.id,last_seen_at:new Date().toISOString(),active:true}:{id:event.id,source:'fienta',source_url:event.sourceUrl,data:event,content_hash:hash,embedding:null,embedding_model:null,enrichment_version:null,enriched_at:null,active:true,last_seen_at:new Date().toISOString()}})
  // Separate changed records from touches so PostgREST receives uniform columns.
  const changed=rows.filter(r=>'data' in r)
  if(changed.length)await db.request('hangout_events?on_conflict=id','POST',changed,'resolution=merge-duplicates,return=minimal')
  await db.request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:'fienta_refresh',payload:{count:events.length},expires_at:new Date(Date.now()+6*3600000).toISOString()},'resolution=merge-duplicates,return=minimal')
  return {mode:'live',total:events.length}
 }finally{await db.request('hangout_ingestion_jobs?name=eq.fienta_refresh&owner=eq.'+owner,'DELETE')}
}
export async function indexEvents(rows:StoredEvent[],limit=5){
 const db=supabase();let updated=0
 await Promise.all(rows.filter(r=>r.embedding_model!==embeddingModel()||r.enrichment_version!==ENRICHMENT_VERSION).slice(0,limit).map(async row=>{
  const owner=randomUUID(),name='index:'+row.id
  if(!await db.rpc<boolean>('hangout_claim_job',{job_name:name,job_owner:owner,lease_seconds:180}))return
  try{
   const event=await enrichEvent(row.data),text=embeddingText(event),embedding=await embed(text)
   // An event changed during enrichment must not receive a stale vector.
   await db.request('hangout_events?id=eq.'+encodeURIComponent(row.id)+'&content_hash=eq.'+row.content_hash,'PATCH',{data:event,embedding:JSON.stringify(embedding),embedding_model:embeddingModel(),enrichment_version:ENRICHMENT_VERSION,enriched_at:new Date().toISOString()},'return=minimal');updated++
  }finally{await db.request('hangout_ingestion_jobs?name=eq.'+encodeURIComponent(name)+'&owner=eq.'+owner,'DELETE')}
 }))
 return {updated}
}
