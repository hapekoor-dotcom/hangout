import {serverOnly} from '../env.ts'
serverOnly()
export class SupabaseError extends Error {status:number;code:string;constructor(status:number,code:string){super('Database request failed');this.status=status;this.code=code}}
export function supabase(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)throw Error('Server database is not configured')
 const origin=new URL(url);if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('Invalid database URL')
 return {async request<T=any>(path:string,method='GET',body?:unknown,prefer?:string):Promise<T>{
  const response=await fetch(new URL('/rest/v1/'+path,origin),{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new SupabaseError(response.status,typeof error.code==='string'?error.code:'database_error')}
  return response.status===204?undefined as T:response.text().then(text=>text?JSON.parse(text):undefined)
 },async rpc<T=any>(name:string,args:unknown={}){return this.request<T>('rpc/'+name,'POST',args)}}
}
