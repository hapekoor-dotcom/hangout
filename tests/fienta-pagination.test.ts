import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import fienta from '../src/lib/events/sources/fienta.ts'
import {canonicalTaxonomy} from '../src/server/events/taxonomy.ts'
const original=globalThis.fetch
afterEach(()=>{globalThis.fetch=original})
test('Fienta follows every declared page, including events beyond the former 300-record cap',async()=>{
 const pages:number[]=[]
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /private')
  assert.equal(url.searchParams.get('per_page'),'1000');const page=Number(url.searchParams.get('page'));pages.push(page)
  return new Response(JSON.stringify({pagination:{page,last_page:4,next_page_url:page<4?'https://fienta.com/api/v1/public/events?page='+(page+1):null},events:[{id:page,is_public:true,title:'Event '+page,description:'Techno night',city:'Tallinn',starts_at:'2099-11-13 21:00:00',url:'https://fienta.com/event-'+page}]}),{headers:{'content-type':'application/json'}})
 }
 const events=await fienta.fetchEvents();assert.deepEqual(pages,[1,2,3,4]);assert.equal(events.length,4);assert.equal(events[3].id,'fienta-4')
})
test('pagination failure rejects the incomplete snapshot rather than silently truncating it',async()=>{
 globalThis.fetch=async(input)=>String(input).includes('robots.txt')?new Response('User-agent: *'):new Response(JSON.stringify({pagination:{page:1,next_page_url:'https://fienta.com/api/v1/public/events?page=2'},events:[]}),{headers:{'content-type':'application/json'}})
 await assert.rejects(()=>fienta.fetchEvents(),/unexpected page/)
})
test('explicit techno subgenres and AI tags inherit techno, generic electronic music does not',()=>{
 assert.ok(canonicalTaxonomy({categories:['Melodic Techno'],tags:[]}).categories.includes('techno'))
 assert.ok(canonicalTaxonomy({categories:['Electronic'],tags:['Techno']}).categories.includes('techno'))
 assert.equal(canonicalTaxonomy({categories:['Electronic','House'],tags:[]}).categories.includes('techno'),false)
})

test('numeric last_page stops ingestion even when Fienta appends query parameters to an empty next-page URL',async()=>{
 let calls=0
 globalThis.fetch=async(input)=>{
  if(String(input).includes('robots.txt'))return new Response('User-agent: *')
  calls++
  return new Response(JSON.stringify({pagination:{page:1,last_page:1,next_page_url:'&per_page=1000'},events:[]}),{headers:{'content-type':'application/json'}})
 }
 await fienta.fetchEvents();assert.equal(calls,1)
})
