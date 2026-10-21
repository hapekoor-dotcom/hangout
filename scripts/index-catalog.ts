import {configured} from '../src/server/env.ts'
import {runIngestion} from '../src/server/events/daily.ts'
if(!configured()){
 if(process.env.VERCEL)throw Error('Catalog indexing requires the three server environment variables')
 console.info('Catalog indexing skipped: server environment is not configured locally.')
}else{
 const result=await runIngestion()
 console.info('Catalog build refresh:',JSON.stringify(result))
 // Provider failures leave the previous indexed catalog available. Cron retries pending work.
 if(result.status==='failed')throw Error('Catalog refresh failed')
}
