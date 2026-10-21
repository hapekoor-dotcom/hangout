export function environmentStatus(){return Object.fromEntries(['OPENAI_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].map(key=>[key,Boolean(process.env[key]?.trim())])) as Record<string,boolean>}
export function configured(){return Object.values(environmentStatus()).every(Boolean)}
export function serverOnly(){if(typeof window!=='undefined')throw Error('Server module cannot run in the browser')}
