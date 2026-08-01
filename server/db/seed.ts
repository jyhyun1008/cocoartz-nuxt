import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { users, servers, rooms, chats, posts } from './schema'

const client = postgres(process.env.DATABASE_URL ?? 'postgresql://cocoartz:cocoartz@localhost:5432/cocoartz', {
    prepare: false,
})
const db = drizzle(client, { schema })

async function seed() {
    console.log('🌱 Seeding...')

    // 유저
    const [user] = await db.insert(users).values({
        username: 'howeverina',
        knownas: '연이나',
        email: 'howeverina@proton.me',
        bio: '코코아츠 관리자',
    }).returning()
    console.log('✅ User:', user.knownas)

    // 룸 목록 (JSON으로 servers.rooms에 저장)
    const roomList = [
        { type: 'title', knownas: '채팅 채널' },
        'ROOM_GALLERY_ID',
        'ROOM_PRACTICE_ID',
        { type: 'title', knownas: '게시판' },
        'ROOM_NOTI_ID',
    ]

    // 서버
    const [server] = await db.insert(servers).values({
        slug: 'cocoartz',
        title: '코코아츠',
        themecolor: '#D21F3C',
        info: '코코아츠 메인 서버입니다.',
        rooms: '[]', // 나중에 업데이트
    }).returning()
    console.log('✅ Server:', server.title)

    // 룸 생성
    const [gallery] = await db.insert(rooms).values({
        path: '/cocoartz/gallery',
        knownas: '갤러리',
        type: 'board',
        info: '작품을 올리는 공간입니다.',
    }).returning()

    const [practiceroom] = await db.insert(rooms).values({
        path: '/cocoartz/practiceroom',
        knownas: '합주실',
        type: 'room',
        info: '음악을 같이 즐기는 공간입니다.',
    }).returning()

    const [noti] = await db.insert(rooms).values({
        path: '/cocoartz/noti',
        knownas: '공지 게시판',
        type: 'board',
        info: '공지사항을 올리는 곳입니다.',
    }).returning()

    console.log('✅ Rooms:', gallery.knownas, practiceroom.knownas, noti.knownas)

    // servers.rooms 업데이트 — title 항목 + room id 혼합 배열
    const roomsJson = JSON.stringify([
        { type: 'title', knownas: '채팅 채널' },
        gallery.id,
        practiceroom.id,
        { type: 'title', knownas: '게시판' },
        noti.id,
    ])
    await db.update(servers).set({ rooms: roomsJson })

    // 채팅 샘플
    await db.insert(chats).values([
        {
            serverid: server.id,
            roomid: practiceroom.id,
            userid: user.id,
            content: '안녕하세요! 합주실에 오신 것을 환영합니다 🎵',
        },
        {
            serverid: server.id,
            roomid: practiceroom.id,
            userid: user.id,
            content: 'WASD로 캐릭터를 움직일 수 있어요.',
        },
    ])
    console.log('✅ Chats inserted')

    // 게시글 샘플
    await db.insert(posts).values([
        {
            serverid: server.id,
            roomid: noti.id,
            userid: user.id,
            title: '코코아츠 서버 오픈!',
            content: '코코아츠 커뮤니티가 새롭게 문을 열었습니다. 많은 참여 부탁드립니다!',
        },
        {
            serverid: server.id,
            roomid: gallery.id,
            userid: user.id,
            title: '갤러리 이용 안내',
            content: '이곳에 작품을 자유롭게 올려주세요.',
        },
    ])
    console.log('✅ Posts inserted')

    console.log('\n🎉 Done! 서버 slug: cocoartz → http://localhost:3000/cocoartz/')
    await client.end()
}

seed().catch((e) => { console.error(e); process.exit(1) })
