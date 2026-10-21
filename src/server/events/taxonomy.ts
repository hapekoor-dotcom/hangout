// Persisted AI metadata from older runs may use title case. Filters use canonical keys.
export function canonicalTaxonomy<T extends {categories:string[];tags:string[]}>(event:T):T{
 const canonical=(values:string[])=>[...new Set(values.map(value=>value.trim().toLowerCase()).filter(Boolean))]
 const categories=canonical(event.categories),tags=canonical(event.tags)
 // Preserve explicit techno/subgenre classifications, including AI tags. Generic electronic music stays distinct.
 if([...categories,...tags].some(value=>/(?:^|[\s/-])techno(?:$|[\s/-])/.test(value))&&!categories.includes('techno'))categories.push('techno')
 return {...event,categories,tags}
}
