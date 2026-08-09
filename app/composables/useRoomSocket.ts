// Module-level singleton — WS connection persists across route changes
let _ws: WebSocket | null = null
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _apiBaseUrl = ''
// 서버가 'kicked'(다른 기기에서 접속됨/정지 등)로 끊었을 때는 onclose의 3초 후 자동 재연결을
// 막아야 함 — 안 막으면 끊긴 쪽이 곧장 다시 join해서 방금 새로 접속한 쪽을 도로 쫓아내는
// 핑퐁이 벌어짐. 유저가 명시적으로(예: 새로고침) 다시 시도하기 전까지는 조용히 끊긴 채로 둠
let _suppressReconnect = false

// 아무 동작(이동/채팅) 없이 가만히 있으면 리버스 프록시/방화벽이 "조용한" 연결을 끊어버리는
// 경우가 있음 — 그러면 서버는 진짜로 나간 걸로 처리해서 user_left를 쏘고, 클라이언트는 3초
// 후 재연결하면서 잠깐 사라졌다 나타나는 것처럼 보임. 주기적으로 핑을 보내 연결을 살아있게 유지.
const HEARTBEAT_INTERVAL_MS = 20_000

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
  const otherUsersInRoom = useState<{ userId: number; user: any; x: number; y: number; z: number; dir: string | null }[]>(
    'ws-other-users', () => [],
  )
  const realtimeChats = useState<any[]>('ws-realtime-chats', () => [])
  // userId -> 마지막으로 점프 신호를 받은 시각. 값 자체보다 "바뀌었다"는 게 중요해서(같은 유저가
  // 연달아 점프해도 매번 다른 타임스탬프가 와야 감지됨) Date.now()를 그대로 씀 — OtherCharacter.vue가
  // 이 값이 바뀔 때마다 점프 연출을 다시 재생함(위치 갱신처럼 계속 켜져있는 상태가 아니라
  // "한 번 튀는" 펄스라 별도로 뺌).
  const jumpPulses = useState<Record<number, number>>('ws-jump-pulses', () => ({}))
  // 서버가 이 연결을 끊은 이유 — null이면 정상. 'duplicate_session'(다른 기기/탭에서 새로
  // 접속함) 또는 'banned'/'suspended'(관리자 조치)로 옴. 화면에서 이 값을 보고 안내 배너를 띄움
  const kickedReason = useState<string | null>('ws-kicked-reason', () => null)

  function handleMessage(event: MessageEvent) {
    let data: any
    try { data = JSON.parse(event.data) } catch { return }

    if (data.type === 'presence') {
      presenceByRoom.value = data.presence

    } else if (data.type === 'room_state') {
      // dir을 여기서 null로 덮어쓰면 이미 멈춰서 서 있는 유저까지 전부 기본 방향(아래)으로
      // 보였음 — 서버가 내려주는 마지막 실제 방향(u.dir)을 그대로 씀
      otherUsersInRoom.value = data.users.map((u: any) => ({ ...u, z: u.z ?? 0, dir: u.dir ?? null }))

    } else if (data.type === 'user_joined') {
      const exists = otherUsersInRoom.value.some(u => u.userId === data.userId)
      if (!exists) {
        otherUsersInRoom.value = [
          ...otherUsersInRoom.value,
          { userId: data.userId, user: data.user, x: data.x, y: data.y, z: data.z ?? 0, dir: null },
        ]
      }

    } else if (data.type === 'user_left') {
      otherUsersInRoom.value = otherUsersInRoom.value.filter(u => u.userId !== data.userId)

    // 서버가 broadcastUserUpdate(_ws.ts)로 보내주는 갱신 — 아바타 장착/프로필 수정 등으로 이미
    // 방에 같이 있던 유저의 옷차림/닉네임/프로필사진이 바뀌었을 때 옴. 위치는 그대로 두고 user
    // 필드만 새로 갈아끼움
    } else if (data.type === 'user_updated') {
      otherUsersInRoom.value = otherUsersInRoom.value.map(u =>
        u.userId === data.userId ? { ...u, user: data.user } : u,
      )

    } else if (data.type === 'position') {
      otherUsersInRoom.value = otherUsersInRoom.value.map(u =>
        u.userId === data.userId ? { ...u, x: data.x, y: data.y, z: data.z ?? u.z, dir: data.dir ?? null } : u,
      )
      if (data.jumping) {
        jumpPulses.value = { ...jumpPulses.value, [data.userId]: Date.now() }
      }

    } else if (data.type === 'chat') {
      realtimeChats.value = [...realtimeChats.value, data.chat]

    // 수정/삭제는 새 채팅을 추가하는 게 아니라 realtimeChats에 이미 들어있거나(방금 온 실시간
    // 메시지) chatData/chatHistory(REST로 미리 불러온 과거 메시지)에 있는 기존 항목에 적용돼야
    // 함 — 컴포넌트가 두 출처를 합칠 때 wsType으로 구분해서 반영하도록 마커만 append해둠
    } else if (data.type === 'chat_edit') {
      realtimeChats.value = [...realtimeChats.value, { wsType: 'chat_edit', id: data.chatid, content: data.content }]

    } else if (data.type === 'chat_delete') {
      realtimeChats.value = [...realtimeChats.value, { wsType: 'chat_delete', id: data.chatid }]

    } else if (data.type === 'kicked') {
      _suppressReconnect = true
      kickedReason.value = data.reason ?? 'unknown'
    }
  }

  function connect(apiBaseUrl: string) {
    if (!import.meta.client) return
    _apiBaseUrl = apiBaseUrl
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return

    _ws = new WebSocket(getWsUrl())
    _ws.onmessage = handleMessage
    _ws.onopen = () => {
      if (_heartbeatTimer) clearInterval(_heartbeatTimer)
      _heartbeatTimer = setInterval(() => rawSend({ type: 'ping' }), HEARTBEAT_INTERVAL_MS)
    }
    _ws.onclose = () => {
      _ws = null
      if (_heartbeatTimer) {
        clearInterval(_heartbeatTimer)
        _heartbeatTimer = null
      }
      if (_suppressReconnect) return
      // Reconnect after 3 seconds
      _reconnectTimer = setTimeout(() => connect(_apiBaseUrl), 3000)
    }
    _ws.onerror = () => {
      _ws?.close()
    }
  }

  function joinRoom(roomPath: string, userId: number, x = 0, y = 0, z = 0) {
    otherUsersInRoom.value = []
    realtimeChats.value = []
    rawSend({ type: 'join', roomPath, userId, x, y, z })
  }

  // Throttle: only send if moved by at least 0.1 units or 150ms elapsed.
  // dir === null은 "이동 정지" 신호라 스로틀에서 제외해야 함 — 마지막 이동과 좌표가
  // 같고 150ms 이내에 키를 떼는 흔한 경우(짧게 눌렀다 뗄 때) 스로틀에 걸려 씹히면
  // 다른 유저 화면에서 정지 모션으로 안 바뀌고 걷기 애니메이션이 멈추지 않는 버그가 생김.
  // jumping도 같은 이유로 스로틀 제외 — 점프 신호가 씹히면 다른 유저 화면에 안 보임.
  let _lastSentPos = { x: 0, y: 0 }
  let _lastSentTime = 0
  function sendPosition(x: number, y: number, dir: string | null = null, z = 0, jumping = false) {
    const now = Date.now()
    if (dir !== null && !jumping) {
      const dx = Math.abs(x - _lastSentPos.x)
      const dy = Math.abs(y - _lastSentPos.y)
      if (dx < 0.1 && dy < 0.1 && now - _lastSentTime < 150) return
    }
    _lastSentPos = { x, y }
    _lastSentTime = now
    rawSend({ type: 'position', x, y, z, dir, jumping })
  }

  function sendChat(serverid: number, roomid: number, content: string) {
    rawSend({ type: 'chat', serverid, roomid, content })
  }

  function editChat(chatid: number, content: string) {
    rawSend({ type: 'chat_edit', chatid, content })
  }

  function deleteChat(chatid: number) {
    rawSend({ type: 'chat_delete', chatid })
  }

  // 'kicked' 배너에서 유저가 명시적으로 다시 접속을 시도할 때(예: "여기서 계속하기" 버튼) 호출 —
  // 자동 재연결 억제를 풀고 바로 새 연결을 시작함. 이 탭에서 이어가면 이번엔 반대로 다른 쪽이
  // (아직 열려 있었다면) 밀려남
  function resumeConnection() {
    _suppressReconnect = false
    kickedReason.value = null
    connect(_apiBaseUrl)
  }

  return {
    presenceByRoom: readonly(presenceByRoom),
    otherUsersInRoom: readonly(otherUsersInRoom),
    realtimeChats: readonly(realtimeChats),
    jumpPulses: readonly(jumpPulses),
    kickedReason: readonly(kickedReason),
    connect,
    joinRoom,
    sendPosition,
    sendChat,
    editChat,
    deleteChat,
    resumeConnection,
  }
}
