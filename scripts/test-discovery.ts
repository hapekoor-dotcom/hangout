import assert from 'node:assert/strict'
import {parseIntent} from '../src/lib/search/parseIntent.ts'
import {rankEvents} from '../src/lib/search/rankEvents.ts'
import {MOCK_POSITION,friendlyDate,formatDistance} from '../src/lib/search/distance.ts'
import type {EventItem} from '../src/lib/search/types.ts'
// Unit fixtures only. Never imported into the application or bundled dataset.
const now=new Date('2026-10-21T12:00:00Z'),base:EventItem={id:'fixture',title:'Fixture',description:'A source description.',date:'2026-10-21',startTime:'19:00',endTime:'21:00',venue:'Tallinn',categories:[],tags:[],price:5,currency:'EUR',latitude:59.437,longitude:24.7453}
const events=[{...base,id:'beer',categories:['beer'],tags:['friends']},{...base,id:'coffee',title:'Coffee',categories:['coffee'],tags:['coffee']},{...base,id:'techno',title:'Techno',description:'Techno dance floor.',categories:['techno','music'],noiseLevel:'high' as const}]
const search=(q:string)=>rankEvents(events,parseIntent(q),MOCK_POSITION,now)
assert.deepEqual(search('beer with friends, not coffee').map(i=>i.event.id),['beer'])
assert.deepEqual(search('techno').map(i=>i.event.id),['techno'])
assert.equal(search('tea').length,0);assert.equal(search('sushi').length,0)
assert.equal(search('with kids').length,0);assert.equal(search('under €1').length,0)
assert.equal(friendlyDate('2026-10-21',now),'Today');assert.equal(friendlyDate('2026-10-22',now),'Tomorrow');assert.equal(formatDistance(.25),'250 m')
assert(!search('techno').some(i=>'score'in i))
console.log('PASS: real-only search code, strict positive/negative intent, missing evidence, human dates, hidden scores')
