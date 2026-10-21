import {configured} from '../src/server/env.ts'
import {ingest,indexEvents,type StoredEvent} from '../src/server/events/ingest.ts'
import {supabase} from '../src/server/db/supabase.ts'
import {embeddingModel} from '../src/server/ai/client.ts'
import {ENRICHMENT_VERSION} from '../src/server/events/enrichEvent.ts'
if(!configured()){
 if(process.env.VERCEL)throw Error('Catalog indexing requires the three server environment variables')
 console.info('Catalog indexing skipped: server environment is not configured locally.')
}else{
 await ingest()
 const db=supabase()
 const rows:StoredEvent[]=[]
 for(let offset=0;;offset+=500){
  const page=await db.request<StoredEvent[]>('hangout_events?active=eq.true&select=id,data,content_hash,embedding_model,enrichment_version&order=id.asc&limit=500&offset='+offset)
  rows.push(...page);if(page.length<500)break
 }
 let last=0
 const result=await indexEvents(rows,rows.length,progress=>{const done=progress.updated+progress.failed+progress.skipped;if(done-last>=10||done===progress.total){console.info('Catalog indexing:',JSON.stringify(progress));last=done}})
 // Check the persisted vectors, not merely successful provider requests.
 const ids:string[]=[]
 for(let offset=0;;offset+=500){
  const page=await db.request<{id:string}[]>('hangout_events?active=eq.true&embedding=not.is.null&embedding_model=eq.'+encodeURIComponent(embeddingModel())+'&enrichment_version=eq.'+encodeURIComponent(ENRICHMENT_VERSION)+'&select=id&order=id.asc&limit=500&offset='+offset)
  ids.push(...page.map(row=>row.id));if(page.length<500)break
 }
 const indexed=new Set(ids),remaining=rows.filter(row=>!indexed.has(row.id)).length
 console.info('Catalog indexing complete:',JSON.stringify({...result,total:rows.length,indexed:rows.length-remaining,remaining}))
 if(remaining)throw Error('Catalog indexing incomplete; retry the build to resume safely')
}
