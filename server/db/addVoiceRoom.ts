import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { servers, rooms } from './schema'
import { eq } from 'drizzle-orm'

const client = postgres(process.env.DATABASE_URL ?? 'postgresql://cocoartz:cocoartz@localhost:5432/cocoartz', {
    prepare: false,
})
const db = drizzle(client, { schema })

async function run() {
    // 이미 존재하는지 확인
    const existing = await db.select().from(rooms).where(eq(rooms.path, '/voicechat'))
    if (existing.length > 0) {
        console.log('⚠️  음성 채팅방이 이미 존재합니다:', existing[0].path)
        await client.end()
        return
    }

    // 룸 생성
    const [voiceRoom] = await db.insert(rooms).values({
        path: '/voicechat',
        knownas: '음성 채팅방',
        type: 'voice',
        info: 'TTS로 메시지를 읽어주는 음성 채팅 채널입니다.',
    }).returning()
    console.log('✅ 룸 생성:', voiceRoom.knownas, `(id: ${voiceRoom.id})`)

    // 서버의 rooms 배열에 추가
    const serverList = await db.select().from(servers)
    if (!serverList.length) {
        console.log('⚠️  서버를 찾을 수 없습니다.')
        await client.end()
        return
    }

    const server = serverList[0]
    let roomsArr = []
    try { roomsArr = JSON.parse(server.rooms ?? '[]') } catch { roomsArr = [] }

    roomsArr.push({ type: 'title', knownas: '음성 채널' })
    roomsArr.push(voiceRoom.id)

    await db.update(servers).set({ rooms: JSON.stringify(roomsArr) }).where(eq(servers.id, server.id))
    console.log('✅ 서버 룸 목록 업데이트 완료')
    console.log('🔊 음성 채팅방 경로: /voicechat')

    await client.end()
}

run().catch((e) => { console.error(e); process.exit(1) })
