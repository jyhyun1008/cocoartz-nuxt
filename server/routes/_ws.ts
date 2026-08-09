import { db } from '../utils/db'
import { chats, users, chatReactions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getUserBlockStatus } from '../utils/userStatus'
import { getUserIdFromCookieHeader } from '../utils/session'

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
