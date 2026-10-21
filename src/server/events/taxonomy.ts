// Persisted AI metadata from older runs may use title case. Filters use canonical keys.
export function canonicalTaxonomy<T extends {categories:string[];tags:string[]}>(event:T):T{
 const canonical=(values:string[])=>[...new Set(values.map(value=>value.trim().toLowerCase()).filter(Boolean))]
 return {...event,categories:canonical(event.categories),tags:canonical(event.tags)}
}
