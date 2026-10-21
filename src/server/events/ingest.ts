import {createHash} from 'node:crypto'
import {database,vector} from '../db/client.ts'
import {buildEventSnapshot} from '../../lib/events/aggregate.ts'
import {enrichEvent,ENRICHMENT_VERSION} from './enrichEvent.ts'
import {embeddingText} from './embedding.ts'
import {geocode} from './geocode.ts'
import {embed} from '../ai/client.ts'
export async function ingest(){
 if(!process.env.OPENAI_API_KEY||!process.env.DATABASE_URL)throw Error('Configure server credentials before ingestion')
 const db=database(),lock=await db.connect()
 try{
  const acquired=await lock.query('SELECT pg_try_advisory_lock(842617) AS locked');if(!acquired.rows[0].locked)throw Error('Ingestion already running')
  const snapshot=await buildEventSnapshot({force:true});if(snapshot.failures.length)throw Error('Fienta unavailable; existing database preserved')
  let updated=0,unchanged=0,failed=0
  for(const source of snapshot.events){
   try{
    const hash=createHash('sha256').update(JSON.stringify({source,version:ENRICHMENT_VERSION,textModel:process.env.OPENAI_TEXT_MODEL})).digest('hex')
    const old=await db.query('SELECT content_hash,enrichment_version,embedding_model FROM events WHERE id=$1',[source.id])
    if(old.rows[0]?.content_hash===hash&&old.rows[0]?.enrichment_version===ENRICHMENT_VERSION&&old.rows[0]?.embedding_model===process.env.OPENAI_EMBEDDING_MODEL){await db.query('UPDATE events SET last_seen_at=now(),active=true WHERE id=$1',[source.id]);unchanged++;continue}
    let enriched=await enrichEvent(source)
    if(enriched.latitude===undefined&&enriched.address){const coordinates=await geocode(enriched.address+', Tallinn, Estonia');if(coordinates)enriched={...enriched,...coordinates}}
    enriched.embeddingText=embeddingText(enriched);const embedding=await embed(enriched.embeddingText)
    await db.query(`INSERT INTO events(id,source,source_url,data,content_hash,enrichment_version,embedding,embedding_model,enriched_at) VALUES($1,$2,$3,$4,$5,$6,$7::vector,$8,now()) ON CONFLICT(id) DO UPDATE SET data=$4,content_hash=$5,enrichment_version=$6,embedding=$7::vector,embedding_model=$8,enriched_at=now(),last_seen_at=now(),active=true`,[enriched.id,enriched.source,enriched.sourceUrl,JSON.stringify(enriched),hash,ENRICHMENT_VERSION,vector(embedding),process.env.OPENAI_EMBEDDING_MODEL]);updated++
   }catch{failed++}
  }
  // Never expire unseen future events: ingestion intentionally fetches a bounded horizon.
  await db.query("UPDATE events SET active=false WHERE data->>'date'<to_char(now() AT TIME ZONE 'Europe/Tallinn','YYYY-MM-DD')")
  await db.query("DELETE FROM search_cache WHERE expires_at<now()")
  return {updated,unchanged,failed,total:snapshot.events.length}
 }finally{await lock.query('SELECT pg_advisory_unlock(842617)');lock.release()}
}
