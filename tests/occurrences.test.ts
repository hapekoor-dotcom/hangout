import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizedTitle,nearestOccurrences,wantsOccurrences,filterOccurrenceDates} from '../src/lib/search/occurrences.ts'
import {stableContentHash} from '../src/server/events/hash.ts'
const quiz=(id:string,date:string,title='Quiz Night',startTime='18:00')=>({id,date,title,startTime})
test('normal search keeps only the nearest date/time despite shuffled input and harmless title formatting',()=>{
 const input=[quiz('nov14','2026-11-14'),quiz('oct31','2026-10-31','  QUIZ—Night! '),quiz('oct24late','2026-10-24','Quiz: Night','20:00'),quiz('nov7','2026-11-07'),quiz('oct24','2026-10-24')]
 const original=structuredClone(input)
 assert.deepEqual(nearestOccurrences(input,'quiz').map(e=>e.id),['oct24']);assert.deepEqual(input,original)
})
test('exact normalized-title grouping preserves different titles and editions',()=>{
 assert.equal(normalizedTitle(' Joe’s\u00a0 Quiz! '),'joes quiz')
 const events=[quiz('a','2026-10-24','Quiz Night 1'),quiz('b','2026-10-31','Quiz Night 2'),quiz('c','2026-11-07','Music Night'),quiz('d','2026-11-14','Music Nights')]
 assert.equal(nearestOccurrences(events).length,4)
 assert.notEqual(normalizedTitle('C++ Workshop'),normalizedTitle('C Workshop'))
 assert.notEqual(normalizedTitle('C# Workshop'),normalizedTitle('C Workshop'))
})
test('explicit recurrence/date requests retain future instances in chronological order',()=>{
 const events=[quiz('later','2026-11-07'),quiz('near','2026-10-24')]
 for(const query of ['next week','every Friday','dates for this event','all upcoming occurrences']){
  assert.equal(wantsOccurrences(query),true);assert.deepEqual(nearestOccurrences(events,query).map(e=>e.id),['near','later'])
 }
 assert.equal(wantsOccurrences('weekly quiz'),false);assert.equal(wantsOccurrences('something to do with friends'),false)
})
test('next week and every Friday constrain dates before recurrence handling',()=>{
 const events=[quiz('oct23','2026-10-23'),quiz('oct24','2026-10-24'),quiz('oct30','2026-10-30'),quiz('oct31','2026-10-31'),quiz('nov7','2026-11-07')]
 const now=new Date('2026-10-21T10:00:00Z')
 assert.deepEqual(filterOccurrenceDates(events,'next week',now).map(e=>e.id),['oct30','oct31'])
 assert.deepEqual(filterOccurrenceDates(events,'every Friday',now).map(e=>e.id),['oct23','oct30'])
})
test('stable content hashes ignore object property order but preserve meaningful changes',()=>{
 assert.equal(stableContentHash({title:'Quiz',venue:{name:'Tallinn',address:'Street'},date:'2026-10-24'}),stableContentHash({date:'2026-10-24',venue:{address:'Street',name:'Tallinn'},title:'Quiz'}))
 assert.notEqual(stableContentHash({title:'Quiz',date:'2026-10-24'}),stableContentHash({title:'Quiz',date:'2026-10-31'}))
})
