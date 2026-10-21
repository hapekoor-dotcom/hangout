import DOMPurify from 'dompurify'
export function sanitizeDescription(source:string){
 const html=/<[a-z][\s\S]*>/i.test(source)?source:source.split(/\n\s*\n/).map(p=>'<p>'+p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')+'</p>').join('')
 const clean=DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','strong','b','em','i','h2','h3','h4','ul','ol','li','a','br','blockquote'],ALLOWED_ATTR:['href','title'],FORBID_TAGS:['script','style','iframe','form','input','button','svg','math'],ALLOW_DATA_ATTR:false})
 const document=new DOMParser().parseFromString(clean,'text/html')
 for(const anchor of document.querySelectorAll('a')){
  try{const url=new URL(anchor.getAttribute('href')||'','https://fienta.com');if(!['https:','http:','mailto:'].includes(url.protocol)){anchor.removeAttribute('href');continue}for(const key of [...url.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/.test(key))url.searchParams.delete(key);anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener noreferrer'}catch{anchor.removeAttribute('href')}
 }
 return document.body.innerHTML
}
