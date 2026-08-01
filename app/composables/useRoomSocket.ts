// Module-level singleton — WS connection persists across route changes
let _ws: WebSocket | null = null
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _apiBaseUrl = ''

function getWsUrl(): string {
  if (!_apiBaseUrl) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/_ws`
  }
  return _apiBaseUrl.replace(/^https?/, m => (m === 'https' ? 'wss' : 'ws')) + '/_ws'
}

function rawSend(data: object) {
  if (!_ws) return
  if (_ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(data))
  } else if (_ws.readyState === WebSocket.CONNECTING) {
    _ws.addEventListener('open', () => _ws?.send(JSON.stringify(data)), { once: true })
  }
}

export function useRoomSocket() {
  const presenceByRoom = useState<Record<string, { userId: number; user: any }[]>>(
    'ws-presence', () => ({}),
  )
  const otherUsersInRoom = useState<{ userId: number; user: any; x: number; y: number; dir: string | null }[]>(
    'ws-other-users', () => [],
  )
  const realtimeChats = useState<any[]>('ws-realtime-chats', () => [])

  function handleMessage(event: MessageEvent) {
    let data: any
    try { data = JSON.parse(event.data) } catch { return }

    if (data.type === 'presence') {
      presenceByRoom.value = data.presence

    } else if (data.type === 'room_state') {
      otherUsersInRoom.value = data.users.map((u: any) => ({ ...u, dir: null }))

    } else if (data.type === 'user_joined') {
      const exists = otherUsersInRoom.value.some(u => u.userId === data.userId)
      if (!exists) {
        otherUsersInRoom.value = [
          ...otherUsersInRoom.value,
          { userId: data.userId, user: data.user, x: data.x, y: data.y, dir: null },
        ]
      }

    } else if (data.type === 'user_left') {
      otherUsersInRoom.value = otherUsersInRoom.value.filter(u => u.userId !== data.userId)

    } else if (data.type === 'position') {
      otherUsersInRoom.value = otherUsersInRoom.value.map(u =>
        u.userId === data.userId ? { ...u, x: data.x, y: data.y, dir: data.dir ?? null } : u,
      )

    } else if (data.type === 'chat') {
      realtimeChats.value = [...realtimeChats.value, data.chat]
    }
  }

  function connect(apiBaseUrl: string) {
    if (!import.meta.client) return
    _apiBaseUrl = apiBaseUrl
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return

    _ws = new WebSocket(getWsUrl())
    _ws.onmessage = handleMessage
    _ws.onclose = () => {
      _ws = null
      // Reconnect after 3 seconds
      _reconnectTimer = setTimeout(() => connect(_apiBaseUrl), 3000)
    }
    _ws.onerror = () => {
      _ws?.close()
    }
  }

  function joinRoom(roomPath: string, userId: number, x = 0, y = 0) {
    otherUsersInRoom.value = []
    realtimeChats.value = []
    rawSend({ type: 'join', roomPath, userId, x, y })
  }

  // Throttle: only send if moved by at least 0.1 units or 150ms elapsed
  let _lastSentPos = { x: 0, y: 0 }
  let _lastSentTime = 0
  function sendPosition(x: number, y: number, dir: string | null = null) {
    const now = Date.now()
    const dx = Math.abs(x - _lastSentPos.x)
    const dy = Math.abs(y - _lastSentPos.y)
    if (dx < 0.1 && dy < 0.1 && now - _lastSentTime < 150 && dir === null) return
    _lastSentPos = { x, y }
    _lastSentTime = now
    rawSend({ type: 'position', x, y, dir })
  }

  function sendChat(serverid: number, roomid: number, content: string) {
    rawSend({ type: 'chat', serverid, roomid, content })
  }

  return {
    presenceByRoom: readonly(presenceByRoom),
    otherUsersInRoom: readonly(otherUsersInRoom),
    realtimeChats: readonly(realtimeChats),
    connect,
    joinRoom,
    sendPosition,
    sendChat,
  }
}
