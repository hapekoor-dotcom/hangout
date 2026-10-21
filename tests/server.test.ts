import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {search} from '../src/server/search/search.ts'
import {health} from '../src/server/health.ts'
import {supabase} from '../src/server/db/supabase.ts'
const originalFetch=globalThis.fetch
const originalEnv={...process.env}
afterEach(()=>{globalThis.fetch=originalFetch;process.env={...originalEnv}})
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
function setup(){process.env.OPENAI_API_KEY='test-openai-secret';process.env.SUPABASE_URL='https://unit.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-secret'}
test('health reports presence only when variables are missing',async()=>{
 for(const key of ['OPENAI_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])delete process.env[key]
 const result=await health();assert.equal(result.ready,false);assert.deepEqual(Object.values(result.environment),[false,false,false])
})
test('database failures never include provider body or credentials',async()=>{
 setup();globalThis.fetch=async()=>json({code:'42P01',message:'test-service-secret'},404)
 await assert.rejects(()=>supabase().request('events'),error=>!String(error).includes('test-service-secret'))
})
test('real pipeline contract: Fienta normalization, Supabase persistence, enrichment, vector RPC and reranking',async()=>{
 setup()
 const rows:any[]=[];let vectorCalled=false;let rerankIDs:string[]=[]
 const intent={date:null,time:null,startTime:null,endTime:null,categories:['techno'],excludedCategories:[],budgetMin:null,budgetMax:null,noiseLevel:null,noiseMax:null,kidFriendly:null,soloFriendly:null,socialContext:null,durationHours:null,nearby:false,maxDistanceKm:null,keywords:[],requiredTerms:[],excludeKids:false}
 globalThis.fetch=async(input,options)=>{
  const url=new URL(String(input)),method=options?.method||'GET',body=options?.body?JSON.parse(String(options.body)):{}
  if(url.hostname==='fienta.com'){
   if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /private')
   return json({events:[{id:1,is_public:true,title:'Techno night',description:'Techno DJ set in Tallinn.',starts_at:'2099-11-13 21:00:00',url:'https://fienta.com/en/techno',city:'Tallinn',venue:'Test venue'},{id:2,is_public:true,title:'Kohv morning',description:'Coffee tasting',starts_at:'2099-11-13 10:00:00',url:'https://fienta.com/en/kohv',city:'Tallinn'}]})
  }
  if(url.hostname==='api.openai.com'){
   assert.equal((options?.headers as any).Authorization,'Bearer test-openai-secret')
   if(url.pathname.endsWith('/embeddings'))return json({data:[{embedding:Array(1536).fill(.01)}]})
   let output:any
   switch(body.text.format.name){
    case 'search_intent':output=intent;break
    case 'event_enrichment':output={categories:['techno','music'],tags:['techno'],vibe:['energetic'],goodFor:[],noiseLevel:'high',kidFriendly:false,soloFriendly:null,alcoholFocus:null,aiSummary:'A techno DJ evening. The music is loud.'};break
    case 'event_ranking':rerankIDs=body.input?JSON.parse(body.input).candidates.map((r:any)=>r.id):[];output={results:[{eventId:'fienta-1',relevance:.95,reason:'Techno DJ set.'},{eventId:'fienta-2',relevance:.99,reason:'Injected coffee result.'}]};break
    default:output={ok:true}
   }
   return json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})
  }
  assert.equal(url.hostname,'unit.supabase.co');assert.equal((options?.headers as any).apikey,'test-service-secret')
  if(url.pathname.includes('/rpc/hangout_claim_job'))return json(true)
  if(url.pathname.includes('/rpc/hangout_match_events')){vectorCalled=true;assert.equal(body.query_embedding.length,1536);assert.deepEqual(body.eligible_ids,['fienta-1']);return json(rows.filter(r=>r.id==='fienta-1').map(r=>({data:r.data})))}
  if(url.pathname.endsWith('/search_cache'))return method==='GET'?json([]):new Response(null,{status:204})
  if(url.pathname.endsWith('/ingestion_jobs'))return new Response(null,{status:204})
  if(url.pathname.endsWith('/events')){
   if(method==='GET')return json(rows)
   if(method==='POST'){rows.push(...body);return new Response(null,{status:204})}
   if(method==='PATCH'){Object.assign(rows.find(r=>r.id===url.searchParams.get('id')?.slice(3)),body);return new Response(null,{status:204})}
  }
  throw Error('Unexpected HTTP request')
 }
 const result=await search('techno',{latitude:59.437,longitude:24.7536})
 assert.equal(rows.length,2);assert.equal(vectorCalled,true);assert.deepEqual(rerankIDs,['fienta-1']);assert.deepEqual(result.results.map(r=>r.event.id),['fienta-1']);assert.ok(result.results[0].summary);assert.equal('embedding' in result.results[0].event,false)
 assert.equal(JSON.stringify(result).includes('test-service-secret'),false)
})
test('Fienta 403 preserves existing database and stops without retries',async()=>{
 setup();let attempts=0
 globalThis.fetch=async(input)=>{const url=String(input);if(url.includes('search_cache'))return json([]);if(url.includes('hangout_claim_job'))return json(true);if(url.includes('ingestion_jobs'))return new Response(null,{status:204});if(url.includes('fienta.com')){attempts++;return json({},403)};throw Error('Unexpected mutation')}
 const {ingest}=await import('../src/server/events/ingest.ts');await assert.rejects(()=>ingest());assert.equal(attempts,1)
})
