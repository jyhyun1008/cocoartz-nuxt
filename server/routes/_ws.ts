import { db } from '../utils/db'
import { chats, users, chatReactions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getUserBlockStatus } from '../utils/userStatus'

interface PeerInfo {
  peer: any
  userId: number
  user: any
  roomPath: string
  x: number
  y: number
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
export function kickUserConnections(userId: number) {
  for (const [peerId, info] of peerMap) {
    if (info.userId !== userId) continue
    sendTo(info.peer, { type: 'kicked' })
    try { info.peer.close?.() } catch {}
    removePeer(peerId)
  }
}

export default defineWebSocketHandler({
  async message(peer, message) {
    let data: any
    try { data = JSON.parse(message.text()) } catch { return }

    if (data.type === 'join') {
      const { roomPath, userId, x = 0, y = 0 } = data

      // Remove stale connections for the same userId (e.g. page reload before old WS closed)
      for (const [staleId, staleInfo] of peerMap) {
        if (staleInfo.userId === userId && staleId !== peer.id) {
          removePeer(staleId)
        }
      }

      // Leave previous room if switching
      const existing = peerMap.get(peer.id)
      if (existing && existing.roomPath !== roomPath) {
        broadcastToRoom(existing.roomPath, { type: 'user_left', userId: existing.userId }, peer.id)
        rooms.get(existing.roomPath)?.delete(peer.id)
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId))

      // 정지/영구정지된 계정은 실시간 이동/채팅에도 못 들어오게 막음(HTTP 쪽 미들웨어는 이
      // 웹소켓 업그레이드 경로를 안 거치므로 여기서 따로 체크해야 함)
      if (user && getUserBlockStatus(user).blocked) {
        sendTo(peer, { type: 'join_rejected', reason: 'banned' })
        peer.close?.()
        return
      }

      const info: PeerInfo = { peer, userId, user: user ?? null, roomPath, x, y }

      if (!rooms.has(roomPath)) rooms.set(roomPath, new Map())
      rooms.get(roomPath)!.set(peer.id, info)
      peerMap.set(peer.id, info)

      // Send room state (other users) to the new joiner
      const others = [...rooms.get(roomPath)!.values()]
        .filter(p => p.peer.id !== peer.id)
        .map(p => ({ userId: p.userId, user: p.user, x: p.x, y: p.y }))
      sendTo(peer, { type: 'room_state', users: others })

      // Notify room members a new user joined
      broadcastToRoom(roomPath, {
        type: 'user_joined', userId, user: user ?? null, x, y,
      }, peer.id)

      // Broadcast updated presence to everyone
      broadcastToAll({ type: 'presence', presence: buildPresence() })

    } else if (data.type === 'position') {
      const info = peerMap.get(peer.id)
      if (!info) return
      info.x = data.x
      info.y = data.y
      broadcastToRoom(info.roomPath, {
        type: 'position', userId: info.userId, x: data.x, y: data.y, dir: data.dir ?? null,
      }, peer.id)

    } else if (data.type === 'ping') {
      // 클라이언트가 주기적으로 보내는 하트비트 — 딱히 처리할 건 없고, 이 메시지가 오간다는
      // 사실 자체가 리버스 프록시/방화벽의 "연결이 조용하면 끊어버리는" idle timeout을 막아줌
      sendTo(peer, { type: 'pong' })

    } else if (data.type === 'chat') {
      const info = peerMap.get(peer.id)
      if (!info) return
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
      if (!info) return
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
      if (!info) return
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
