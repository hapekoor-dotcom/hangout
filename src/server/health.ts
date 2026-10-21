import {configured,environmentStatus} from './env.ts'
import {supabase,SupabaseError} from './db/supabase.ts'
import {checkOpenAI} from './ai/client.ts'
let probe:Promise<boolean>|undefined,probeUntil=0
async function localProbe(){if(!probe||Date.now()>probeUntil){probeUntil=Date.now()+300000;probe=checkOpenAI()}return probe}
export async function health(){
 const environment=environmentStatus()
 if(!configured())return {configured:false,environment,supabase:'not_checked',openai:'not_checked',ready:false}
 let database='unavailable',openai='not_checked',schemaReady=false
 try{await supabase().request('hangout_events?select=id&limit=1');await supabase().rpc('hangout_schema_ready');database='connected';schemaReady=true}catch(error){database=error instanceof SupabaseError&&['42P01','PGRST205','PGRST202'].includes(error.code)?'migration_required':'unavailable'}
 try{
  if(!schemaReady){await localProbe();openai='connected'}
  else {
  const db=supabase(),cached=await db.request<any[]>('hangout_search_cache?cache_key=eq.openai_health&select=expires_at')
  if(cached[0]&&Date.parse(cached[0].expires_at)>Date.now())openai='connected'
  else if(await db.rpc<boolean>('hangout_claim_job',{job_name:'openai_health',job_owner:'health',lease_seconds:300})){
   await checkOpenAI();openai='connected'
   await db.request('hangout_search_cache?on_conflict=cache_key','POST',{cache_key:'openai_health',payload:{ok:true},expires_at:new Date(Date.now()+300000).toISOString()},'resolution=merge-duplicates,return=minimal')
  }else openai='check_pending'
  }
 }catch{openai='unavailable'}
 let events:unknown=undefined
 if(schemaReady){try{const rows=await supabase().request<any[]>('hangout_events?select=data,embedding_model&limit=1000');const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn'}).format(new Date());events={stored:rows.length,indexed:rows.filter(r=>r.embedding_model).length,upcoming:rows.filter(r=>r.data?.date>=today).length,techno:rows.filter(r=>r.data?.categories?.some((v:string)=>v.toLowerCase()==='techno')).length,beer:rows.filter(r=>r.data?.categories?.some((v:string)=>v.toLowerCase()==='beer')).length,serverDate:today}}catch{events={status:'unavailable'}}}
 return {configured:true,environment,supabase:database,openai,schemaReady,ready:schemaReady&&openai==='connected',events}
}
