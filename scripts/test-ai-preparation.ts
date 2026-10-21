import assert from 'node:assert/strict'
import {validate} from '../src/server/ai/client.ts'
import {enrichmentSchema} from '../src/server/events/enrichEvent.ts'
import {intentSchema} from '../src/server/search/parseIntent.ts'
import {hardFilters} from '../src/server/search/hardFilters.ts'
import {acceptReranking} from '../src/server/search/rerank.ts'
import {parseIntent} from '../src/lib/search/parseIntent.ts'
import {MOCK_POSITION} from '../src/lib/search/distance.ts'
import type {EventItem} from '../src/lib/search/types.ts'
assert(!validate({},enrichmentSchema));assert(!validate({unexpected:true},intentSchema))
const now=new Date('2026-10-21T12:00:00Z'),base:EventItem={id:'fixture',title:'Fixture',description:'Only a test.',date:'2026-10-21',startTime:'19:00',endTime:'21:00',venue:'Tallinn',price:10,categories:['beer'],tags:[],kidFriendly:false,latitude:59.437,longitude:24.7453}
const intent={...parseIntent('beer tonight not coffee'),excludeKids:false};const coffee={...base,id:'coffee',categories:['coffee']}
assert.deepEqual(hardFilters([base,coffee],intent,MOCK_POSITION,now).map(e=>e.id),['fixture'])
assert.equal(hardFilters([{...base,price:30}],{...intent,budgetMax:15},MOCK_POSITION,now).length,0)
assert.equal(hardFilters([base],{...intent,kidFriendly:true},MOCK_POSITION,now).length,0)
assert.equal(hardFilters([{...base,endTime:undefined}],{...intent,endTime:'23:00'},MOCK_POSITION,now).length,0)
const reranked=acceptReranking([base],[{eventId:'not-a-candidate',relevance:1,reason:'Invented'},{eventId:'fixture',relevance:.95,reason:'Beer as requested'},{eventId:'fixture',relevance:.99,reason:'Duplicate'}],MOCK_POSITION)
assert.equal(reranked.length,1);assert.equal(reranked[0].event.id,'fixture')
assert.equal(acceptReranking([base],[{eventId:'fixture',relevance:.6,reason:'Weak'}],MOCK_POSITION).length,0)
console.log('PASS: strict schemas, hard constraints, candidate allowlist, duplicate rejection, relevance threshold. No live model/database calls made.')
