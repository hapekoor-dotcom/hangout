import {buildEventSnapshot} from '../src/lib/events/aggregate.ts'
const snapshot=await buildEventSnapshot({force:true})
console.log(JSON.stringify({count:snapshot.events.length,mode:snapshot.mode,updated:snapshot.fetchedAt,failures:snapshot.failures}))
if(snapshot.mode!=='live')process.exitCode=1
