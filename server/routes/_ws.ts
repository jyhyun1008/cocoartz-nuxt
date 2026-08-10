import { db } from '../utils/db'
import { chats, users, chatReactions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getUserBlockStatus } from '../utils/userStatus'
import { getUserIdFromCookieHeader } from '../utils/session'
import { getMuteLookup, getWordMuteLookup, getEmojiMuteLookup } from '../utils/mutes'

interface PeerInfo {
  peer: any
  userId: number
  // true면 세션 쿠키로 검증된 진짜 계정. false면 로그인 안 한 손님(구경만) — userId는 아래
  // nextGuestId()가 찍어주는 음수 합성 id라 실제 계정(양수, serial PK)과 절대 안 겹침.
  // 채팅 전송/수정/삭제, 중복 세션 강퇴처럼 "계정에 종속된" 동작은 반드시 이 값을 확인해야 함.
  authenticated: boolean
  user: any
  roomPath: string
  x: number
  y: number
  z: number
  // 마지막으로 "실제로 움직이던" 방향(멈추면 오는 null은 반영 안 하고 이전 값을 유지) — 이게
  // 없으면 이미 멈춰서 서 있는 유저 방에 새로 들어온 사람에게는 이 유저의 방향을 알려줄 방법이
  // 없어서(room_state 시점엔 position 이벤트가 다시 안 옴) 항상 기본 방향(아래)으로 보였음
  dir: string | null
}

// 로그인 안 한 손님(구경) 연결에게 부여하는 임시 id. 실제 계정 id(1부터 증가하는 양수 serial
// PK)와 절대 안 겹치게 항상 음수를 씀 — 클라이언트가 다른 유저를 userId로 구분/렌더링하는데,
// 손님이 여러 명 동시에 있을 때 전부 같은 값(예: 0나 null)이면 서로 같은 사람으로 겹쳐 보임.
let _guestIdSeq = 0
function nextGuestId(): number {
  _guestIdSeq -= 1
  return _guestIdSeq
}

// roomPath -> peerId -> PeerInfo
const rooms = new Map<string, Map<string, PeerInfo>>()
// peerId -> PeerInfo  (for fast lookup in message/close)
const peerMap = new Map<string, PeerInfo>()

function sendTo(peer: any, data: object) {
  try { peer.send(JSON.stringify(data)) } catch {}
}

function broadcastToRoom(roomPath: string, data: object, excludeId?: string) {
  const room = rooms.get(roomPath)
  if (!room) return
  const payload = JSON.stringify(data)
  for (const [id, info] of room) {
    if (id !== excludeId) {
      try { info.peer.send(payload) } catch {}
    }
  }
}

function broadcastToAll(data: object, excludeId?: string) {
  const payload = JSON.stringify(data)
  for (const [id, info] of peerMap) {
    if (id !== excludeId) {
      try { info.peer.send(payload) } catch {}
    }
  }
}

function buildPresence() {
  const presence: Record<string, { userId: number; user: any }[]> = {}
  for (const [roomPath, room] of rooms) {
    presence[roomPath] = [...room.values()].map(p => ({
      userId: p.userId,
      user: p.user,
    }))
  }
  return presence
}

function removePeer(peerId: string) {
  const info = peerMap.get(peerId)
  if (!info) return
  const room = rooms.get(info.roomPath)
  if (room) {
    room.delete(peerId)
    if (room.size === 0) rooms.delete(info.roomPath)
  }
  peerMap.delete(peerId)
  broadcastToRoom(info.roomPath, { type: 'user_left', userId: info.userId }, peerId)
  broadcastToAll({ type: 'presence', presence: buildPresence() }, peerId)
}

// 관리자가 정지/영구정지를 실행한 직후 호출됨(server/api/admin/banUser.ts 등) — 그 유저가 이미
// 열어둔 연결(여러 탭이면 전부)을 그 자리에서 끊어서 "즉시 차단"이 되게 함. 같은 Node 프로세스
// 안에서 모듈 상태(peerMap)를 그대로 공유하니 별도 통신 없이 바로 됨.
export function kickUserConnections(userId: number, reason: string = 'banned') {
  for (const [peerId, info] of peerMap) {
    if (info.userId !== userId) continue
    sendTo(info.peer, { type: 'kicked', reason })
    try { info.peer.close?.() } catch {}
    removePeer(peerId)
  }
}

// 아바타 장착(equipAvatarItem.ts)/프로필 수정(updateProfile.ts) 등으로 users 테이블이 바뀐
// 직후 호출됨 — 이미 방에 접속해 있는 이 유저의 PeerInfo.user 캐시를 새 값으로 갈아끼우고,
// 같은 방에 있는 다른 사람들에게도 즉시 알려줌. PeerInfo.user는 원래 join 시점에 한 번만
// 채워지고 그 뒤로는 절대 안 갱신됐어서, 마을에 있다가 프로필에서 옷/닉네임을 바꾸고 돌아와도
// 본인 화면만 바뀌고 같은 방에 있던 다른 유저들 눈엔 그 사람이 다시 join하기 전까지(=방을
// 새로고침하거나 나갔다 들어오기 전까지) 예전 모습 그대로 보이는 문제가 있었음
export function broadcastUserUpdate(userId: number, user: any) {
  const notifiedRooms = new Set<string>()
  for (const [, info] of peerMap) {
    if (info.userId !== userId) continue
    info.user = user
    if (!notifiedRooms.has(info.roomPath)) {
      notifiedRooms.add(info.roomPath)
      broadcastToRoom(info.roomPath, { type: 'user_updated', userId, user })
    }
  }
}

// 게시판에 새 글(댓글 제외)이 올라온 직후 호출됨(server/api/createPost.ts) — 사이드바 채널명
// 옆에 띄우는 안 읽음 표시(useRoomSocket.ts의 unreadRooms)는 "지금 그 방에 들어와있는 사람"만
// 알면 되는 게 아니라 서버 전체 어디에 있든 다 알아야 하니 broadcastToRoom이 아니라
// broadcastToAll을 씀. 연합 게시판은 createPost.ts가 애초에 이 함수를 안 불러서(원격에서
// 계속 들어오는 글까지 합치면 사실상 항상 켜져 있는 셈이라 의미가 없음) 여기까지 안 옴.
//
// excludeUserId: 글을 쓴 본인은 "새 글이 있다"는 알림을 받을 이유가 없음(자기가 방금 썼으니
// 당연히 알고 있음) — 그래서 그 유저의 연결(계정당 하나만 허용되니 있어도 최대 1개)만 쏙 빼고
// 나머지 전체에 보냄. 예전엔 본인한테도 그대로 갔었고, 클라이언트 쪽에서 "지금 보고 있는 채널"
// 기준으로 사이드바 동그라미만 숨겼는데, 그 사이 파비콘 배지는 잠깐이라도 켜졌다가 제대로 안
// 꺼지는 경우가 있어서(끄는 것도 결국 또 다른 비동기 클라이언트 로직에 의존하니) 아예 본인한테는
// 안 보내는 쪽이 더 확실함
export function broadcastNewPost(roomPath: string, excludeUserId?: number) {
  let excludeId: string | undefined
  if (excludeUserId != null) {
    for (const [peerId, info] of peerMap) {
      if (info.userId === excludeUserId) { excludeId = peerId; break }
    }
  }
  broadcastToAll({ type: 'new_post', roomPath }, excludeId)
}

// 연합 게시판(연합 타임라인) 전용 실시간 스트리밍 — 위 broadcastNewPost(사이드바 안 읽음 동그라미)와
// 반대로 여긴 연합 게시판만을 위한 것. 새로 올라온 글의 실제 내용을 지금 그 채널을 보고 있는
// 사람들에게만(broadcastToRoom) 바로 흘려보내서, WindowBoard.vue가 새로고침 없이 목록 맨 위에
// 바로 꽂아 넣을 수 있게 함. entry는 getFederatedBoardFeed.ts가 내려주는 것과 같은 모양
// ({ kind: 'local'|'remote', post })으로 맞춰서 프론트가 그대로 재사용할 수 있게 함.
// - 로컬 글: server/api/createPost.ts가 연합 게시판에 쓰였을 때 호출
// - 원격 글: server/routes/users/[username]/inbox.post.ts가 연합 타임라인(remoteTimelinePosts)에
//   실제로 새로 저장됐을 때(중복 아닐 때만) 호출
//
// ⚠️ 평범한 broadcastToRoom과 달리 유저마다 다르게 보냄 — 일반 목록 조회(getFederatedBoardFeed.ts)는
// 보는 사람의 뮤트 목록(계정/단어/이모지 뮤트)을 서버에서 걸러주는데, 이 실시간 푸시는 그 필터링
// 없이 그냥 모두에게 똑같이 뿌리면 뮤트한 사람 글이 스트리밍으로는 그대로 보이는 문제가 있었음.
// 그래서 방에 있는 사람마다 그 사람 기준으로 뮤트 판정을 따로 해서, 하드 뮤트면 그 사람한텐 아예
// 안 보내고 소프트 뮤트면 게이트가 뜨도록 post.muted='soft'를 붙여서 보냄 — getFederatedBoardFeed.ts/
// getPostsByRoomId.ts 등이 하는 것과 동일한 판정을 여기서도 똑같이 함.
function entryAuthor(entry: { kind: 'local' | 'remote'; post: any }) {
  if (entry.kind === 'local') return { userid: entry.post.userid ?? null, actorUrl: entry.post.remoteActorUrl ?? null }
  return { actorUrl: entry.post.sourceActorUrl ?? null }
}
function entryText(entry: { kind: 'local' | 'remote'; post: any }): string {
  if (entry.kind === 'local') return `${entry.post.title ?? ''} ${entry.post.content ?? ''}`
  return entry.post.content ?? ''
}

export async function broadcastFederatedBoardPost(roomPath: string, entry: { kind: 'local' | 'remote'; post: any }) {
  const room = rooms.get(roomPath)
  if (!room) return
  const author = entryAuthor(entry)
  const text = entryText(entry)

  for (const [, info] of room) {
    // 손님(비로그인)은 뮤트 목록 자체가 없으니 그대로 보냄
    if (!info.authenticated) {
      sendTo(info.peer, { type: 'federated_new_post', entry })
      continue
    }

    const [muteLookup, wordMuteLookup, emojiMuteLookup] = await Promise.all([
      getMuteLookup(info.userId),
      getWordMuteLookup(info.userId),
      getEmojiMuteLookup(info.userId),
    ])
    const levels = [muteLookup.levelOf(author), wordMuteLookup.levelOf(text), emojiMuteLookup.levelOf(text)]
    if (levels.includes('hard')) continue  // 이 유저한테는 아예 안 보냄

    const muted = levels.includes('soft') ? ('soft' as const) : undefined
    const payload = muted ? { ...entry, post: { ...entry.post, muted } } : entry
    sendTo(info.peer, { type: 'federated_new_post', entry: payload })
  }
}

// 개인 팔로잉 타임라인(WindowTimeline.vue) 실시간 스트리밍 — 위 연합 게시판(방 단위)과 달리
// "특정 유저 한 명"에게만 쏨(그 유저를 팔로우하는 사람들 + 본인, 호출하는 쪽에서 대상을 정해서
// 한 명씩 부름). entry 모양은 getFollowingFeed.ts가 내려주는 것과 동일하게 맞춰서 프론트가
// 그대로 재사용할 수 있게 함.
// - 로컬 글: server/api/createPost.ts가 최상위 글(답글 아님)을 만들었을 때, 작성자의 팔로워
//   전원 + 작성자 본인에게 각각 호출(본인도 포함하는 이유는 getFollowingFeed.ts가 자기 글도
//   항상 타임라인에 같이 보여주기 때문 — 다른 탭에 타임라인을 띄워두고 있었다면 거기도 바로 반영됨)
// - 원격 글: server/routes/users/[username]/inbox.post.ts가 원격 팔로우 계정의 새 글/부스트를
//   그 특정 유저의 개인 피드(remoteFeedPosts)에 실제로 새로 저장했을 때, 그 유저 한 명에게만 호출
//
// 연합 게시판 스트리밍과 동일하게, 받는 사람 기준 뮤트(계정/단어/이모지)를 서버에서 걸러서 보냄
export async function broadcastTimelineNewPost(userId: number, entry: { kind: 'local' | 'remote'; post: any }) {
  const targets = [...peerMap.values()].filter((info) => info.userId === userId && info.authenticated)
  if (!targets.length) return

  const author = entryAuthor(entry)
  const text = entryText(entry)
  const [muteLookup, wordMuteLookup, emojiMuteLookup] = await Promise.all([
    getMuteLookup(userId),
    getWordMuteLookup(userId),
    getEmojiMuteLookup(userId),
  ])
  const levels = [muteLookup.levelOf(author), wordMuteLookup.levelOf(text), emojiMuteLookup.levelOf(text)]
  if (levels.includes('hard')) return  // 뮤트한 계정/단어/이모지가 걸리면 본인 타임라인에도 실시간으로는 안 띄움

  const muted = levels.includes('soft') ? ('soft' as const) : undefined
  const payload = muted ? { ...entry, post: { ...entry.post, muted } } : entry
  for (const info of targets) sendTo(info.peer, { type: 'timeline_new_post', entry: payload })
}

export default defineWebSocketHandler({
  async message(peer, message) {
    let data: any
    try { data = JSON.parse(message.text()) } catch { return }

    if (data.type === 'join') {
      const { roomPath, x = 0, y = 0, z = 0 } = data

      // ⚠️ 예전엔 위에서 그냥 data.userId(클라이언트가 자유롭게 조작 가능)를 그대로 믿었음 —
      // 로그인 없이도(혹은 남의 id를 실어서) 그 사람 행세로 이동/채팅이 가능한 완전한 인증
      // 우회였음. 이제 업그레이드 요청에 실려온 쿠키에서 서버만 복호화 가능한 세션을 검증해서
      // 얻은 id만 신뢰함(server/utils/session.ts). 다만 로그인 자체를 안 한 손님은 원래부터
      // 방을 구경할 수 있었던 동작이라(다른 유저를 보고, 다른 유저 화면에도 보임) 접속을
      // 거절하지 않고 authenticated=false로 게스트 id를 발급해 그대로 들여보냄 — 계정에
      // 종속된 동작(채팅, 중복 세션 강퇴)만 아래에서 authenticated로 따로 막음.
      const sessionUserId = await getUserIdFromCookieHeader(peer.request.headers.get('cookie'))
      const authenticated = sessionUserId != null
      const userId = sessionUserId ?? nextGuestId()

      // 같은 계정으로 다른 기기/탭에서 이미 접속돼 있으면 그 연결을 끊음(단순 새로고침으로
      // 옛 소켓이 아직 안 닫힌 경우도 포함) — 계정당 연결을 하나로 강제하는 이유는, 맵 위
      // 코인 수집(collectCoin)이 클라이언트 주도(로컬 타이머로 코인을 띄우고 밟으면 호출)라서
      // 두 클라이언트를 동시에 띄워두면 서버 쿨다운 체크의 select→update 사이 틈을 타 거의
      // 동시에 호출해 쿨다운 안에 중복 수령할 여지가 있었음(투 배럭 방지). 게스트는 계정이
      // 없어 이 문제 자체가 없고, 게스트끼리는 id가 매번 달라 애초에 겹칠 일도 없음.
      if (authenticated) {
        for (const [staleId, staleInfo] of peerMap) {
          if (staleInfo.userId === userId && staleId !== peer.id) {
            sendTo(staleInfo.peer, { type: 'kicked', reason: 'duplicate_session' })
            try { staleInfo.peer.close?.() } catch {}
            removePeer(staleId)
          }
        }
      }

      // Leave previous room if switching
      const existing = peerMap.get(peer.id)
      if (existing && existing.roomPath !== roomPath) {
        broadcastToRoom(existing.roomPath, { type: 'user_left', userId: existing.userId }, peer.id)
        rooms.get(existing.roomPath)?.delete(peer.id)
      }

      let user: any = null
      if (authenticated) {
        ;[user] = await db.select().from(users).where(eq(users.id, userId))

        // 정지/영구정지된 계정은 실시간 이동/채팅에도 못 들어오게 막음(HTTP 쪽 미들웨어는 이
        // 웹소켓 업그레이드 경로를 안 거치므로 여기서 따로 체크해야 함)
        if (user && getUserBlockStatus(user).blocked) {
          sendTo(peer, { type: 'join_rejected', reason: 'banned' })
          peer.close?.()
          return
        }
      }

      const info: PeerInfo = { peer, userId, authenticated, user: user ?? null, roomPath, x, y, z, dir: null }

      if (!rooms.has(roomPath)) rooms.set(roomPath, new Map())
      rooms.get(roomPath)!.set(peer.id, info)
      peerMap.set(peer.id, info)

      // Send room state (other users) to the new joiner — dir을 같이 내려줘야 이미 멈춰서
      // 서 있는 유저도 마지막으로 보던 방향 그대로 보임(안 그러면 항상 기본 방향인 아래로 보임)
      const others = [...rooms.get(roomPath)!.values()]
        .filter(p => p.peer.id !== peer.id)
        .map(p => ({ userId: p.userId, user: p.user, x: p.x, y: p.y, z: p.z, dir: p.dir }))
      sendTo(peer, { type: 'room_state', users: others })

      // Notify room members a new user joined
      broadcastToRoom(roomPath, {
        type: 'user_joined', userId, user: user ?? null, x, y, z,
      }, peer.id)

      // Broadcast updated presence to everyone
      broadcastToAll({ type: 'presence', presence: buildPresence() })

    } else if (data.type === 'position') {
      const info = peerMap.get(peer.id)
      if (!info) return
      info.x = data.x
      info.y = data.y
      if (typeof data.z === 'number') info.z = data.z
      // 멈췄다는 신호(dir: null)는 저장하지 않고 마지막 실제 방향을 그대로 유지 — 나중에 이 방에
      // 들어오는 사람에게 room_state로 알려줄 때 쓰기 위함(위 join 핸들러 주석 참고)
      if (data.dir) info.dir = data.dir
      broadcastToRoom(info.roomPath, {
        type: 'position', userId: info.userId, x: data.x, y: data.y, z: info.z, dir: data.dir ?? null, jumping: !!data.jumping,
      }, peer.id)

    } else if (data.type === 'ping') {
      // 클라이언트가 주기적으로 보내는 하트비트 — 딱히 처리할 건 없고, 이 메시지가 오간다는
      // 사실 자체가 리버스 프록시/방화벽의 "연결이 조용하면 끊어버리는" idle timeout을 막아줌
      sendTo(peer, { type: 'pong' })

    } else if (data.type === 'chat') {
      const info = peerMap.get(peer.id)
      if (!info || !info.authenticated) return
      const { serverid, roomid, content } = data
      const [chat] = await db.insert(chats).values({
        serverid, roomid, userid: info.userId, content,
      }).returning()
      const chatWithUser = { ...chat, user: info.user }
      // Broadcast to others, send confirmation to sender separately
      broadcastToRoom(info.roomPath, { type: 'chat', chat: chatWithUser }, peer.id)
      sendTo(peer, { type: 'chat', chat: chatWithUser })

    } else if (data.type === 'chat_edit') {
      const info = peerMap.get(peer.id)
      if (!info || !info.authenticated) return
      const { chatid } = data
      const content = String(data.content ?? '').trim()
      if (!chatid || !content) return

      const [chat] = await db.select().from(chats).where(eq(chats.id, chatid))
      if (!chat || chat.userid !== info.userId) return

      await db.update(chats).set({ content, edited: true }).where(eq(chats.id, chatid))
      const payload = { type: 'chat_edit', chatid, content }
      broadcastToRoom(info.roomPath, payload, peer.id)
      sendTo(peer, payload)

    } else if (data.type === 'chat_delete') {
      const info = peerMap.get(peer.id)
      if (!info || !info.authenticated) return
      const { chatid } = data
      if (!chatid) return

      const [chat] = await db.select().from(chats).where(eq(chats.id, chatid))
      if (!chat || chat.userid !== info.userId) return

      await db.delete(chatReactions).where(eq(chatReactions.chatid, chatid))
      await db.delete(chats).where(eq(chats.id, chatid))
      const payload = { type: 'chat_delete', chatid }
      broadcastToRoom(info.roomPath, payload, peer.id)
      sendTo(peer, payload)
    }
  },

  close(peer) {
    removePeer(peer.id)
  },

  error(peer) {
    removePeer(peer.id)
  },
})
