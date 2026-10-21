import {readFile} from 'node:fs/promises'
import {database,closeDatabase} from '../src/server/db/client.ts'
try{await database().query(await readFile(new URL('../db/migrations/001_search.sql',import.meta.url),'utf8'));console.log('Database schema ready')}finally{await closeDatabase()}
