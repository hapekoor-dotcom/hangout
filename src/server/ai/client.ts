import {serverOnly} from '../env.ts'
serverOnly()
export type Schema={type?:string|string[];properties?:Record<string,Schema>;items?:Schema;required?:string[];enum?:unknown[];additionalProperties?:boolean;minimum?:number;maximum?:number}
export function validate(value:any,schema:Schema):boolean{
 if(schema.enum&&!schema.enum.includes(value))return false
 if(value===null)return schema.type==='null'||Array.isArray(schema.type)&&schema.type.includes('null')
 const expected=Array.isArray(schema.type)?schema.type.filter(t=>t!=='null'):schema.type?[schema.type]:[]
 const kind=Array.isArray(value)?'array':typeof value==='number'?'number':typeof value
 if(expected.length&&!expected.includes(kind))return false
 if(kind==='number'&&(!Number.isFinite(value)||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum)))return false
 if(kind==='array'&&schema.items&&!value.every((v:any)=>validate(v,schema.items!)))return false
 if(kind==='object'){
  if(!value||Array.isArray(value))return false
  if(schema.required?.some(k=>!(k in value)))return false
  if(schema.additionalProperties===false&&Object.keys(value).some(k=>!schema.properties?.[k]))return false
  if(Object.entries(schema.properties||{}).some(([k,s])=>k in value&&!validate(value[k],s)))return false
 }
 return true
}
async function request(path:string,body:unknown){
 if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY is not configured')
 const r=await fetch('https://api.openai.com/v1/'+path,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)})
 if(!r.ok)throw Error(`AI provider returned HTTP ${r.status}`)
 return r.json()
}
export async function structured<T>(name:string,schema:Schema,instructions:string,payload:unknown):Promise<T>{
 const model=process.env.OPENAI_TEXT_MODEL||'gpt-4.1-mini'
 const response=await request('responses',{model,store:false,instructions,input:JSON.stringify(payload),text:{format:{type:'json_schema',name,strict:true,schema}},max_output_tokens:4000})
 if(response.status!=='completed')throw Error('Incomplete AI output')
 const text=response.output?.flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('')
 const parsed=JSON.parse(text||'null');if(!validate(parsed,schema))throw Error('AI output failed schema validation');return parsed
}
export async function embed(text:string):Promise<number[]>{
 const model=process.env.OPENAI_EMBEDDING_MODEL||'text-embedding-3-small'
 const result=await request('embeddings',{model,input:text.slice(0,22000),dimensions:1536})
 const values=result.data?.[0]?.embedding;if(!Array.isArray(values)||values.length!==1536||values.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Invalid embedding')
 return values
}

export async function checkOpenAI(){await structured('health_check',{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},'Return ok true.',{check:true});return true}
export const embeddingModel=()=>process.env.OPENAI_EMBEDDING_MODEL||'text-embedding-3-small'
