import assert from 'node:assert/strict'
import {parseFienta} from '../src/lib/events/sources/fienta.ts'
import {normalizeEvents} from '../src/lib/events/normalize.ts'
import {collectEvents} from '../src/lib/events/aggregate.ts'
import {rankEvents} from '../src/lib/search/rankEvents.ts'
import {parseIntent} from '../src/lib/search/parseIntent.ts'
import {friendlyDate,MOCK_POSITION} from '../src/lib/search/distance.ts'
const now=new Date('2026-10-21T12:00:00Z')
const base={id:1,title:'Techno test fixture',is_public:true,starts_at:'2026-10-21 23:00:00',ends_at:'2026-10-22 04:00:00',venue:'Test Tallinn venue',address:'Test street, Tallinn',description:'<p>Techno DJ set. Age 18+.</p>',price_from_string:'From 12 EUR',url:'https://fienta.com/test-fixture',image_url:'https://fienta.com/test.jpg',categories:[]}
const parsed=parseFienta({events:[base]});assert.equal(parsed.length,1);assert.equal(parsed[0].description,'Techno DJ set. Age 18+.');assert.equal(parsed[0].price,12);assert.equal(parsed[0].latitude,undefined)
const item=normalizeEvents(parsed,now)[0];assert(item.categories.includes('techno'));assert.equal(item.kidFriendly,false);assert.equal(item.noiseLevel,'high');assert.equal(item.soloFriendly,undefined)
const unknown=parseFienta({events:[{...base,title:'Exhibition',description:'Pictures on a wall.',price_from_string:undefined}]})[0];assert.equal(unknown.price,undefined);assert.equal(normalizeEvents([unknown],now)[0].noiseLevel,undefined)
assert.equal(friendlyDate('2026-10-21',now),'Today');assert.equal(friendlyDate('2026-10-22',now),'Tomorrow')
const input={...item,venue:item.venue||''};assert.equal(rankEvents([input],parseIntent('techno'),MOCK_POSITION,now).length,1);assert.equal(rankEvents([input],parseIntent('beer'),MOCK_POSITION,now).length,0);assert.equal(rankEvents([input],parseIntent('nearby'),MOCK_POSITION,now).length,0)
const failed=await collectEvents([{id:'fienta',async fetchEvents(){throw new Error('HTTP 403')}}],[],now);assert.equal(failed.mode,'fallback');assert.deepEqual(failed.events,[])
assert.equal(normalizeEvents([...parsed,...parsed],now).length,1)
console.log('PASS: official API parsing, plain descriptions, prices, unknown metadata, conservative inference, dates, category relevance, no invented coordinates, failure fallback')
const contaminated={...item,title:'Hommikukohvi - Inimene, tehnoloogia ja tuleviku tööelu',description:'Technology and Tehnopol at a business conference.',categories:['business','conference','coffee','techno','electronic','music'],noiseLevel:'high' as const}
const healed=normalizeEvents([contaminated],now)[0];assert(!healed.categories.includes('techno'));assert(!healed.categories.includes('music'));assert.equal(healed.noiseLevel,undefined)
assert.equal(rankEvents([{...healed,venue:healed.venue||''}],parseIntent('techno'),MOCK_POSITION,now).length,0)
console.log('PASS: technology / tehnoloogia / Tehnopol never imply techno; old cache categories repaired')
