import {ingest,indexEvents,type StoredEvent} from '../src/server/events/ingest.ts'
import {supabase} from '../src/server/db/supabase.ts'
const result=await ingest(true)
const rows=await supabase().request<StoredEvent[]>('events?active=eq.true&select=id,data,content_hash,embedding_model,enrichment_version&limit=1000')
console.log(JSON.stringify({...result,...await indexEvents(rows,1000)}))
