// 사용법: npx tsx server/db/setAdmin.ts howeverina
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import * as dotenv from 'dotenv'
dotenv.config()

const username = process.argv[2]
if (!username) {
    console.error('사용법: npx tsx server/db/setAdmin.ts <username>')
    process.exit(1)
}

const client = postgres(process.env.DATABASE_URL ?? '', { prepare: false })
const db = drizzle(client)

const [updated] = await db.update(users)
    .set({ isAdmin: true })
    .where(eq(users.username, username))
    .returning({ id: users.id, username: users.username, isAdmin: users.isAdmin })

if (updated) {
    console.log(`✅ ${updated.username} (id: ${updated.id}) → isAdmin = true`)
} else {
    console.error(`❌ '${username}' 유저를 찾을 수 없습니다`)
}

await client.end()
