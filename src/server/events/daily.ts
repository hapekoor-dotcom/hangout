import {createHash,randomUUID} from 'node:crypto'
import {supabase} from '../db/supabase.ts'
import fienta from '../../lib/events/sources/fienta.ts'
import {normalizeEvents} from '../../lib/events/normalize.ts'
import type {NormalizedEvent} from '../../lib/events/types.ts'
import {enrichEvent,ENRICHMENT_VERSION} from './enrichEvent.ts'
import {embeddingText} from './embedding.ts'
import {embed,embeddingModel} from '../ai/client.ts'
import {canonicalTaxonomy} from './taxonomy.ts'
export type Published={id:string;source:string;source_url:string;data:NormalizedEvent;content_hash:string;embedding_model:string|null;enrichment_version:string|null;active:boolean}
type Checkpoint={source:NormalizedEvent;hash:string;prepared?:NormalizedEvent;preparedHash?:string;version?:string}
export type JobStats={status:string;fetched:number;new:number;changed:number;unchanged:number;enriched:number;embeddings:number;published:number;inactive:number;failures:number;pending:number}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const permanent='2100-01-01T00:00:00Z'
export function localClock(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now)
 const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}
}
export function hasPassed(event:NormalizedEvent,now=new Date()){
 const clock=localClock(now),endDate=event.endDate||(event.endTime&&event.endTime<event.startTime?new Date(Date.parse(event.date+'T12:00:00Z')+86400000).toISOString().slice(0,10):event.date)
 if(endDate!==clock.date)return endDate<clock.date
 // Without an end time only the calendar date can establish that an event has passed.
 return Boolean(event.endTime&&event.endTime<=clock.time)
}
export const enrichmentInputHash=(e:NormalizedEvent)=>hash([e.title,e.description,e.venue??null,e.age??null])
export function reuseEnrichment(source:NormalizedEvent,previous:NormalizedEvent){
 const result={...source}
 for(const key of ['categories','tags','vibe','goodFor','noiseLevel','kidFriendly','soloFriendly','alcoholFocus','aiSummary'] as const){if(previous[key]!==undefined)(result as any)[key]=previous[key]}
 if(source.kidFriendly===false||Number.parseInt(source.age||'0')>=18)result.kidFriendly=false
 return canonicalTaxonomy(result)
}
export async function allPublished(){
 const rows:Published[]=[]
 for(let offset=0;;offset+=500){const page=await supabase().request<Published[]>('hangout_events?select=id,source,source_url,data,content_hash,embedding_model,enrichment_version,active&order=id.asc&limit=500&offset='+offset);rows.push(...page);if(page.length<500)break}
 return rows
}
async function checkpoint(id:string,value:Checkpoint){await supabase().request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:'ingest:pending:'+id,payload:value,expires_at:permanent},'resolution=merge-duplicates,return=minimal')}
async function revision(){await supabase().request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:'catalog_revision',payload:{value:randomUUID()},expires_at:permanent},'resolution=merge-duplicates,return=minimal')}
export async function runIngestion(options:{daily?:boolean;now?:Date;budgetMs?:number;fetchEvents?:()=>Promise<NormalizedEvent[]>}={}){
 const now=options.now||new Date(),started=Date.now(),stopStarting=started+Math.max(0,(options.budgetMs??240000)-110000),owner=randomUUID(),db=supabase(),day=localClock(now).date
 const stats:JobStats={status:'completed',fetched:0,new:0,changed:0,unchanged:0,enriched:0,embeddings:0,published:0,inactive:0,failures:0,pending:0}
 if(!await db.rpc<boolean>('hangout_claim_job',{job_name:'catalog_ingestion',job_owner:owner,lease_seconds:300}))return {...stats,status:'already_running'}
 const logFailure=(phase:string,id?:string)=>{stats.failures++;console.warn('Hangout ingestion failure',JSON.stringify({phase,eventId:id}))}
 try{
  if(options.daily){const done=await db.request<any[]>('hangout_search_cache?cache_key=eq.ingest:day:'+day+'&select=payload');if(done.length){stats.status='already_completed';return stats}}
  const rows=await allPublished(),byId=new Map(rows.map(row=>[row.id,row])),byUrl=new Map(rows.map(row=>[row.source+'|'+row.source_url,row]))
  let fetched:NormalizedEvent[]
  try{fetched=normalizeEvents(await (options.fetchEvents||(()=>fienta.fetchEvents()))(),now);if(!fetched.length)throw Error('Empty source response')}
  catch{logFailure('source_fetch');stats.status='source_unavailable';return stats}
  stats.fetched=fetched.length
  const pending:{source:NormalizedEvent;old?:Published;hash:string}[]=[],seen=new Set<string>(),seenSources=new Map<string,NormalizedEvent>()
  for(let source of fetched){
   const old=byId.get(source.id)||byUrl.get(source.source+'|'+source.sourceUrl)
   if(old&&old.source!==source.source)continue
   if(old&&old.id!==source.id)source={...source,id:old.id}
   if(seen.has(source.id))continue;seen.add(source.id);seenSources.set(source.id,source)
   const contentHash=hash(source)
   if(!old)stats.new++;else if(old.content_hash!==contentHash)stats.changed++;else stats.unchanged++
   try{
    if(!old){await db.request('hangout_events?on_conflict=id','POST',{id:source.id,source:source.source,source_url:source.sourceUrl,data:source,content_hash:contentHash,active:!hasPassed(source,now),last_seen_at:now.toISOString()},'resolution=ignore-duplicates,return=minimal')}
    if(!hasPassed(source,now)&&(!old||old.content_hash!==contentHash||old.embedding_model!==embeddingModel()||old.enrichment_version!==ENRICHMENT_VERSION))pending.push({source,old,hash:contentHash})
   }catch{logFailure('source_save',source.id)}
  }
  const touched=[...seenSources.values()].filter(source=>!hasPassed(source,now)).map(source=>source.id)
  for(let i=0;i<touched.length;i+=100){try{await db.request('hangout_events?id=in.'+encodeURIComponent('('+touched.slice(i,i+100).map(id=>JSON.stringify(id)).join(',')+')'),'PATCH',{last_seen_at:now.toISOString(),active:true},'return=minimal')}catch{logFailure('last_seen')}}
  // Published rows retain their last working data/vector while replacement data is staged.
  let cursor=0
  async function worker(){while(cursor<pending.length){
   const item=pending[cursor++],source=item.source,old=item.old;let phase='checkpoint'
   try{
    const saved=await db.request<any[]>('hangout_search_cache?cache_key=eq.'+encodeURIComponent('ingest:pending:'+source.id)+'&select=payload')
    let state:Checkpoint=saved[0]?.payload||{source,hash:item.hash}
    state={...state,source,hash:item.hash};await checkpoint(source.id,state)
    if(Date.now()>stopStarting){stats.pending++;continue}
    const relevantHash=enrichmentInputHash(source)
    let prepared:NormalizedEvent
    if(state.prepared&&state.preparedHash===relevantHash&&state.version===ENRICHMENT_VERSION)prepared=reuseEnrichment(source,state.prepared)
    else if(old?.enrichment_version===ENRICHMENT_VERSION&&old.data.aiSummary&&enrichmentInputHash(old.data)===relevantHash)prepared=reuseEnrichment(source,old.data)
    else{phase='enrichment';prepared=await enrichEvent(source);stats.enriched++}
    state={source,hash:item.hash,prepared,preparedHash:relevantHash,version:ENRICHMENT_VERSION};phase='checkpoint';await checkpoint(source.id,state)
    const update:any={source:source.source,source_url:source.sourceUrl,data:prepared,content_hash:item.hash,enrichment_version:ENRICHMENT_VERSION,enriched_at:now.toISOString(),last_seen_at:now.toISOString(),active:true}
    if(!old||old.embedding_model!==embeddingModel()||hash(embeddingText(old.data))!==hash(embeddingText(prepared))){phase='embedding';update.embedding=JSON.stringify(await embed(embeddingText(prepared)));update.embedding_model=embeddingModel();stats.embeddings++}
    phase='publish'
    await db.request('hangout_events?id=eq.'+encodeURIComponent(source.id),'PATCH',update,'return=minimal');stats.published++
    await db.request('hangout_search_cache?cache_key=eq.'+encodeURIComponent('ingest:pending:'+source.id),'DELETE')
   }catch{stats.pending++;logFailure(phase,source.id)}
  }}
  await Promise.all(Array.from({length:Math.min(5,pending.length)},worker))
  // Missing future events are retained; only factual passage of time deactivates records.
  for(const row of rows)if(row.active&&hasPassed(seenSources.get(row.id)||row.data,now)){
   try{const id=row.id;await db.request('hangout_events?id=eq.'+encodeURIComponent(id),'PATCH',{active:false},'return=minimal');stats.inactive++}catch{logFailure('deactivate',row.id)}
  }
  if(stats.published||stats.inactive)await revision()
  if(stats.failures||stats.pending)stats.status='partial'
  if(stats.status==='completed'&&options.daily)await db.request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:'ingest:day:'+day,payload:stats,expires_at:new Date(now.getTime()+7*86400000).toISOString()},'resolution=merge-duplicates,return=minimal')
  return stats
 }catch{logFailure('job');stats.status='failed';return stats}
 finally{console.info('Hangout ingestion result',JSON.stringify(stats));if(stats.status!=='already_completed'){try{await db.request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:'ingest:last',payload:{...stats,at:new Date().toISOString()},expires_at:permanent},'resolution=merge-duplicates,return=minimal')}catch{console.warn('Hangout ingestion summary persistence unavailable')}}try{await db.request('hangout_ingestion_jobs?name=eq.catalog_ingestion&owner=eq.'+owner,'DELETE')}catch{console.warn('Hangout ingestion lock cleanup deferred to lease expiry')}}
}
