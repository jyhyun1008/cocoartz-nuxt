import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(sql)

console.log('[migrate] DB 마이그레이션 적용 중...')
await migrate(db, { migrationsFolder: join(__dirname, 'migrations') })
console.log('[migrate] 완료')
await sql.end()
