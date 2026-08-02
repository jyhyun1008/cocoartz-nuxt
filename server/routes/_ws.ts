import { db } from '../utils/db'
import { chats, users } from '../db/schema'
import { eq } from 'drizzle-orm'

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
    }
  },

  close(peer) {
    removePeer(peer.id)
  },

  error(peer) {
    removePeer(peer.id)
  },
})
