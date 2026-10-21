import {runIngestion} from '../src/server/events/daily.ts'
console.info(JSON.stringify(await runIngestion()))
