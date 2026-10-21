import {ingest} from '../src/server/events/ingest.ts'
import {closeDatabase} from '../src/server/db/client.ts'
try{console.log(JSON.stringify(await ingest()))}finally{await closeDatabase()}
