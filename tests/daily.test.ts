import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {runIngestion,localClock,hasPassed} from '../src/server/events/daily.ts'
import {handler} from '../src/server/handler.ts'
import type {NormalizedEvent} from '../src/lib/events/types.ts'
const originalFetch=globalThis.fetch,originalEnv={...process.env}
afterEach(()=>{globalThis.fetch=originalFetch;process.env={...originalEnv}})
const now=new Date('2026-10-21T00:15:00Z')
const event=(id='1'):NormalizedEvent=>({id:'fienta-'+id,title:'Techno '+id,description:'A techno DJ set.',date:'2099-11-13',startTime:'21:00',venue:'Tallinn venue',categories:['techno'],tags:[],source:'fienta',sourceUrl:'https://fienta.com/event-'+id})
const response=(body:any)=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}})
function fixture(){
 process.env.OPENAI_API_KEY='unit-openai';process.env.SUPABASE_URL='https://unit.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='unit-service';process.env.CRON_SECRET='unit-cron-secret'
 const rows=new Map<string,any>(),cache=new Map<string,any>(),jobs=new Map<string,string>();let enrichCalls=0,embedCalls=0,failEnrich=false,failEmbed=false
 const api={rows,cache,jobs,get enrichCalls(){return enrichCalls},get embedCalls(){return embedCalls},set failEnrich(v:boolean){failEnrich=v},set failEmbed(v:boolean){failEmbed=v}}
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input)),method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):undefined
  if(url.hostname==='fienta.com')return url.pathname==='/robots.txt'?new Response('User-agent: *\nDisallow: /private'):response({events:[{id:1,title:'Techno 1',description:'A techno DJ set.',is_public:true,city:'Tallinn',starts_at:'2099-11-13 21:00:00',url:'https://fienta.com/event-1'}]})
  if(url.hostname==='api.openai.com'){
   if(url.pathname.endsWith('embeddings')){embedCalls++;if(failEmbed)return new Response('{}',{status:429});return response({data:[{embedding:Array(1536).fill(.01)}]})}
   enrichCalls++;if(failEnrich||JSON.parse(body.input).title.includes('FAIL'))return new Response('{}',{status:503})
   const output={categories:['techno'],tags:['techno'],vibe:['energetic'],goodFor:[],noiseLevel:'high',kidFriendly:false,soloFriendly:null,alcoholFocus:null,aiSummary:'A techno evening with a DJ set.'}
   return response({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})
  }
  const route=url.pathname.split('/').pop()
  if(route==='hangout_claim_job'){if(jobs.has(body.job_name))return response(false);jobs.set(body.job_name,body.job_owner);return response(true)}
  if(route==='hangout_ingestion_jobs'){if(jobs.get('catalog_ingestion')===url.searchParams.get('owner')?.slice(3))jobs.delete('catalog_ingestion');return new Response(null,{status:204})}
  if(route==='hangout_search_cache'){
   const key=url.searchParams.get('cache_key')?.slice(3)
   if(method==='GET')return response(key&&cache.has(key)?[cache.get(key)]:[])
   if(method==='DELETE'){cache.delete(key!);return new Response(null,{status:204})}
   cache.set(body.cache_key,body);return new Response(null,{status:204})
  }
  if(route==='hangout_events'){
   if(method==='GET'){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||500);return response([...rows.values()].slice(offset,offset+limit))}
   if(method==='POST'){for(const row of Array.isArray(body)?body:[body])if(!rows.has(row.id))rows.set(row.id,{embedding_model:null,enrichment_version:null,...row});return new Response(null,{status:204})}
   const filter=url.searchParams.get('id')!,ids=filter.startsWith('in.')?JSON.parse('['+filter.slice(4,-1)+']'):[filter.slice(3)]
   for(const id of ids)if(rows.has(id))Object.assign(rows.get(id),body)
   return new Response(null,{status:204})
  }
  throw Error('Unexpected provider path '+url.pathname)
 }
 return api
}
test('new, unchanged, metadata-only and searchable changes are incremental; duplicates merge by source URL',async()=>{
 const f=fixture();let source=event()
 let r=await runIngestion({now,fetchEvents:async()=>[source]});assert.equal(r.new,1);assert.equal(f.enrichCalls,1);assert.equal(f.embedCalls,1)
 const originalVector=f.rows.get(source.id).embedding
 r=await runIngestion({now,fetchEvents:async()=>[source]});assert.equal(r.unchanged,1);assert.equal(f.enrichCalls,1);assert.equal(f.embedCalls,1);assert.equal(f.rows.size,1);assert.equal(f.rows.get(source.id).last_seen_at,now.toISOString())
 source={...source,price:15,image:'https://fienta.com/new-image.jpg'}
 r=await runIngestion({now,fetchEvents:async()=>[source]});assert.equal(r.changed,1);assert.equal(r.enriched,0);assert.equal(r.embeddings,0);assert.equal(f.rows.get(source.id).data.price,15);assert.equal(f.rows.get(source.id).embedding,originalVector)
 source={...source,description:'A different techno set with a live performance.'}
 r=await runIngestion({now,fetchEvents:async()=>[source]});assert.equal(r.enriched,1);assert.equal(r.embeddings,1)
 await runIngestion({now,fetchEvents:async()=>[{...source,id:'fienta-replacement-id'}]});assert.equal(f.rows.size,1)
})
test('embedding failure keeps previous searchable record and retries without repeating successful enrichment',async()=>{
 const f=fixture();await runIngestion({now,fetchEvents:async()=>[event()]});const previous=structuredClone(f.rows.get('fienta-1'))
 f.failEmbed=true
 let r=await runIngestion({now,fetchEvents:async()=>[{...event(),description:'Changed searchable content.'}]})
 assert.equal(r.status,'partial');assert.equal(r.pending,1);assert.deepEqual(f.rows.get('fienta-1').data,previous.data);assert.equal(f.rows.get('fienta-1').embedding,previous.embedding)
 const enriched=f.enrichCalls;f.failEmbed=false
 r=await runIngestion({now,fetchEvents:async()=>[{...event(),description:'Changed searchable content.'}]})
 assert.equal(r.status,'completed');assert.equal(f.enrichCalls,enriched);assert.equal(f.rows.get('fienta-1').data.description,'Changed searchable content.')
})
test('one failed event preserves raw data while others publish; failed source never wipes records',async()=>{
 const f=fixture();const bad={...event('2'),title:'FAIL event'}
 let r=await runIngestion({now,fetchEvents:async()=>[event(),bad]});assert.equal(r.pending,1);assert.equal(r.published,1);assert.equal(f.rows.size,2);assert.equal(f.rows.get(bad.id).data.title,'FAIL event');assert.equal(f.rows.get(bad.id).embedding_model,null)
 const before=structuredClone([...f.rows.values()]);r=await runIngestion({now,fetchEvents:async()=>{throw Error('source down')}})
 assert.equal(r.status,'source_unavailable');assert.deepEqual([...f.rows.values()],before)
})
test('past events deactivate; missing future events remain intact; daily execution is idempotent',async()=>{
 const f=fixture();await runIngestion({now,fetchEvents:async()=>[event(),event('2')]})
 f.rows.get('fienta-2').data={...event('2'),date:'2026-10-19'}
 f.rows.set('fienta-missing',{...structuredClone(f.rows.get('fienta-1')),id:'fienta-missing',source_url:'https://fienta.com/missing'})
 let r=await runIngestion({now,daily:true,fetchEvents:async()=>[event()]});assert.equal(r.inactive,1);assert.equal(f.rows.get('fienta-2').active,false);assert.equal(f.rows.get('fienta-missing').active,true)
 r=await runIngestion({now,daily:true,fetchEvents:async()=>{throw Error('must not fetch twice')}});assert.equal(r.status,'already_completed')
})
test('global job lease prevents overlapping ingestion',async()=>{
 fixture();let release!:(events:NormalizedEvent[])=>void;const wait=new Promise<NormalizedEvent[]>(resolve=>{release=resolve})
 const first=runIngestion({now,fetchEvents:()=>wait});await new Promise(resolve=>setTimeout(resolve,10))
 const second=await runIngestion({now,fetchEvents:async()=>[event()]});assert.equal(second.status,'already_running')
 release([event()]);assert.equal((await first).status,'completed')
})
test('manual and cron routes require secret; authenticated manual invocation succeeds',async()=>{
 fixture()
 async function call(path:string,auth?:string){let status=0,text='';const req:any={url:path,method:path==='/api/cron'?'GET':'POST',headers:{authorization:auth},socket:{}};const res:any={setHeader(){},writeHead(n:number){status=n},end(s:string){text=s}};await handler(req,res);return {status,body:JSON.parse(text)}}
 assert.equal((await call('/api/ingest')).status,401);assert.equal((await call('/api/cron','Bearer wrong')).status,401)
 const result=await call('/api/ingest','Bearer unit-cron-secret');assert.equal(result.status,200);assert.equal(result.body.status,'completed');assert.equal(result.body.new,1)
})
test('Tallinn dates and event expiry work across daylight-saving transitions',()=>{
 assert.equal(localClock(new Date('2026-10-26T01:15:00Z')).time,'03:15')
 assert.equal(localClock(new Date('2026-07-01T01:15:00Z')).time,'04:15')
 assert.equal(hasPassed({...event(),date:'2026-10-21',endTime:'23:00'},now),false)
 assert.equal(hasPassed({...event(),date:'2026-10-20',startTime:'23:00',endTime:'06:00'},now),false)
})
test('500 existing events plus 20 new and 5 changed require only 25 enrichment/embedding operations',async()=>{
 const f=fixture(),{normalizeEvents}=await import('../src/lib/events/normalize.ts'),{stableContentHash}=await import('../src/server/events/hash.ts')
 const existing=normalizeEvents(Array.from({length:500},(_,i)=>event(String(i))),now)
 for(const source of existing)f.rows.set(source.id,{id:source.id,source:'fienta',source_url:source.sourceUrl,data:{...source,aiSummary:'Already enriched.'},content_hash:stableContentHash(source),embedding_model:'text-embedding-3-small',enrichment_version:'hangout-v1',active:true,embedding:'saved-vector'})
 const input=[...existing.map((source,i)=>i<5?{...source,description:'New searchable description.'}:source),...Array.from({length:20},(_,i)=>event(String(500+i)))]
 const result=await runIngestion({now,fetchEvents:async()=>input})
 assert.equal(result.new,20);assert.equal(result.changed,5);assert.equal(result.unchanged,495);assert.equal(result.enriched,25);assert.equal(result.embeddings,25);assert.equal(f.enrichCalls,25);assert.equal(f.embedCalls,25);assert.equal(f.rows.size,520)
 const again=await runIngestion({now,fetchEvents:async()=>input.map(source=>Object.fromEntries(Object.entries(source).reverse()) as NormalizedEvent)})
 assert.equal(again.unchanged,520);assert.equal(again.enriched,0);assert.equal(again.embeddings,0);assert.equal(f.enrichCalls,25)
})
test('already indexed legacy hashes remain compatible without enrichment or embedding calls',async()=>{
 const f=fixture(),{normalizeEvents}=await import('../src/lib/events/normalize.ts'),{legacyContentHash}=await import('../src/server/events/hash.ts')
 const source=normalizeEvents([event()],now)[0]
 f.rows.set(source.id,{id:source.id,source:'fienta',source_url:source.sourceUrl,data:{...source,aiSummary:'Already enriched.'},content_hash:legacyContentHash(source),embedding_model:'text-embedding-3-small',enrichment_version:'hangout-v1',active:true,embedding:'saved-vector'})
 const result=await runIngestion({now,fetchEvents:async()=>[source]})
 assert.equal(result.unchanged,1);assert.equal(result.enriched,0);assert.equal(result.embeddings,0);assert.equal(f.enrichCalls,0);assert.equal(f.embedCalls,0)
})
