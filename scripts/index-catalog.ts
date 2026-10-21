import {configured} from '../src/server/env.ts'
import {runIngestion} from '../src/server/events/daily.ts'
if(!configured()){
 if(process.env.VERCEL)throw Error('Catalog indexing requires the three server environment variables')
 console.info('Catalog indexing skipped: server environment is not configured locally.')
}else{
 // Build-time backfill can cover many source pages. Each bounded pass releases its lease.
 // Runtime cron remains one bounded incremental pass, with no queue or public indexing action.
 let complete=false,failures=0
 for(let pass=1;pass<=20;pass++){
  const result=await runIngestion()
  console.info('Catalog build refresh:',JSON.stringify({pass,...result}))
  if(result.status==='completed'){complete=true;break}
  if(result.status==='source_unavailable'||result.status==='failed')throw Error('Catalog source unavailable; existing published records preserved')
  if(result.status==='already_running'){await new Promise(resolve=>setTimeout(resolve,15000));continue}
  if(result.failures&&++failures>1)throw Error('Catalog has retryable failures; incomplete backfill was not published')
 }
 if(!complete)throw Error('Catalog backfill incomplete; rerun deployment to resume')
}
