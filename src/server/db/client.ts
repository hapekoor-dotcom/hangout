import pg from 'pg'
let pool:pg.Pool|undefined
export function database(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is not configured');return pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:8000,statement_timeout:15000})}
export async function closeDatabase(){await pool?.end()}
export function vector(values:number[]){if(values.length!==1536||values.some(v=>!Number.isFinite(v)))throw Error('Invalid embedding dimensions');return '['+values.join(',')+']'}
