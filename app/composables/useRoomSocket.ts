// Module-level singleton — WS connection persists across route changes
let _ws: WebSocket | null = null
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _apiBaseUrl = ''
// 서버가 'kicked'(다른 기기에서 접속됨/정지 등)로 끊었을 때는 onclose의 3초 후 자동 재연결을
// 막아야 함 — 안 막으면 끊긴 쪽이 곧장 다시 join해서 방금 새로 접속한 쪽을 도로 쫓아내는
// 핑퐁이 벌어짐. 유저가 명시적으로(예: 새로고침) 다시 시도하기 전까지는 조용히 끊긴 채로 둠
let _suppressReconnect = false
// 마지막으로 실제 join한 방 정보 — 연결이 (강퇴가 아니라) 네트워크 끊김/idle timeout 등으로
// 조용히 끊겼다가 자동 재연결됐을 때, 서버 쪽엔 이 연결에 대한 peerMap/rooms 기록이 전혀 없는
// 새 상태로 시작되므로 이 정보로 자동 재참가시킴(아래 connect()의 onopen 참고). 이게 없으면
// 재연결은 되는데 "그 방에 있다"는 사실 자체를 서버가 모르는 채로 조용히 남아서, 위치 동기화는
// 물론 방 기반 브로드캐스트(연합 게시판 실시간 스트리밍 등)도 다시 join할 때까지 계속 못 받음
let _lastJoinParams: { roomPath: string; userId: number; x: number; y: number; z: number } | null = null
// 지금 연결이 "이 로그인 상태"로 열렸다고 서버가 인식하고 있는 스냅샷 — 아래 connect() 참고
let _wsUserId: number | null = null

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
  // roomPath -> 새 글이 올라와서 아직 안 읽은 채널 표시(ServerSidebar.vue의 사이드바 동그라미,
  // faviconBadge.client.ts의 파비콘 배지가 이 값을 봄) — DB에 안 남기는 순전히 실시간 세션 동안만
  // 유지되는 표시라, 새로고침하면 초기화됨(서버가 broadcastNewPost로 보내는 'new_post'만 반영)
  const unreadRooms = useState<Record<string, true>>('ws-unread-rooms', () => ({}))
  // 연합 게시판 실시간 스트리밍(server/routes/_ws.ts의 broadcastFederatedBoardPost) — 새 글/재게시가
  // 도착할 때마다 배열 맨 뒤에 추가됨. WindowBoard.vue는 이 배열 자체를 히스토리로 재생하는 게
  // 아니라 "바뀔 때마다 맨 뒤(가장 최근 것)만" 봐서 자기 목록(feedItems) 맨 앞에 꽂아 넣으므로,
  // 긴 세션에서 계속 쌓이지 않게 오래된 것부터 잘라내도 무방함(최근 N개만 유지)
  const federatedPostFeed = useState<Array<{ kind: 'local' | 'remote'; post: any }>>('ws-federated-post-feed', () => [])
  const FEDERATED_FEED_CAP = 50
  // 개인 팔로잉 타임라인 실시간 스트리밍(server/routes/_ws.ts의 broadcastTimelineNewPost) —
  // federatedPostFeed와 동일한 패턴(WindowTimeline.vue가 배열 맨 뒤(최근 것)만 보고 자기
  // localItems/remoteItems 맨 앞에 꽂아 넣음)이라 방 개념 없이 유저 단위로만 옴
  const timelinePostFeed = useState<Array<{ kind: 'local' | 'remote'; post: any }>>('ws-timeline-post-feed', () => [])
  const TIMELINE_FEED_CAP = 50

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

    } else if (data.type === 'new_post') {
      unreadRooms.value = { ...unreadRooms.value, [data.roomPath]: true }

    } else if (data.type === 'federated_new_post') {
      federatedPostFeed.value = [...federatedPostFeed.value, data.entry].slice(-FEDERATED_FEED_CAP)

    } else if (data.type === 'timeline_new_post') {
      timelinePostFeed.value = [...timelinePostFeed.value, data.entry].slice(-TIMELINE_FEED_CAP)
    }
  }

  function connect(apiBaseUrl: string, userId: number | null = _wsUserId) {
    if (!import.meta.client) return
    _apiBaseUrl = apiBaseUrl

    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
      if (_wsUserId === userId) return  // 이미 같은 로그인 상태로 연결/연결 시도 중 — 재사용
      // 로그인 상태가 바뀜(예: 손님으로 방에 있다가 그 자리에서 로그인) — 웹소켓은 최초 연결
      // 핸드셰이크 때 실린 쿠키를 그 연결이 끊길 때까지 그대로 들고 있어서(server/routes/_ws.ts가
      // join마다 peer.request.headers에서 쿠키를 다시 읽긴 하지만 peer.request 자체가 접속
      // 시점 스냅샷이라 안 바뀜), 같은 소켓으로 join을 다시 보내봤자 서버는 계속 로그인 전(손님)
      // 신원으로만 인식함 — 새 쿠키가 실리려면 새 업그레이드 요청이 필요하니 소켓을 강제로 닫고
      // 새로 엶. onclose를 먼저 떼고 직접 닫아서 3초 자동재연결과 안 겹치게 함(서버 쪽은 정상
      // close로 처리돼 removePeer→user_left가 그대로 나가므로 옛 신원 캐릭터가 유령으로 안 남음)
      _ws.onclose = null
      try { _ws.close() } catch {}
      _ws = null
      if (_heartbeatTimer) {
        clearInterval(_heartbeatTimer)
        _heartbeatTimer = null
      }
    }

    _wsUserId = userId
    _ws = new WebSocket(getWsUrl())
    _ws.onmessage = handleMessage
    _ws.onopen = () => {
      if (_heartbeatTimer) clearInterval(_heartbeatTimer)
      _heartbeatTimer = setInterval(() => rawSend({ type: 'ping' }), HEARTBEAT_INTERVAL_MS)
      // 끊겼다가 자동 재연결된 경우 자동으로 마지막 방에 다시 join — 최초 접속 시엔
      // RoomMap.vue의 onMounted가 joinRoom을 직접 불러줘서 이 시점엔 아직 null이라 안 겹침
      if (_lastJoinParams) rawSend({ type: 'join', ..._lastJoinParams })
    }
    _ws.onclose = () => {
      _ws = null
      if (_heartbeatTimer) {
        clearInterval(_heartbeatTimer)
        _heartbeatTimer = null
      }
      if (_suppressReconnect) return
      // Reconnect after 3 seconds
      _reconnectTimer = setTimeout(() => connect(_apiBaseUrl, _wsUserId), 3000)
    }
    _ws.onerror = () => {
      _ws?.close()
    }
  }

  function joinRoom(roomPath: string, userId: number, x = 0, y = 0, z = 0) {
    _lastJoinParams = { roomPath, userId, x, y, z }
    otherUsersInRoom.value = []
    realtimeChats.value = []
    // 소켓이 아직 연결 중(CONNECTING)일 땐 여기서 rawSend로 큐잉하지 않음 — connect()의 onopen이
    // "열리면 _lastJoinParams를 보내라"는 걸 이미 하고 있어서(재연결 자동 재참가용), 방금 위에서
    // 막 세팅한 _lastJoinParams를 그쪽도 보게 됨. 그런데 예전엔 이 함수도 rawSend로 "열리면 보내라"를
    // 따로 큐잉해버려서, connect() 직후 바로 joinRoom()을 부르는 흔한 순서(onMounted, resume 등)에서
    // 소켓이 열리는 순간 join이 두 번 나갔음 — 로그인 유저는 매번 같은 계정 id라 서버가 두 번째를
    // 같은 사람으로 알아서 겉으론 안 보였지만, 손님은 join마다 서버가 새 음수 id를 새로 발급해서
    // (server/routes/_ws.ts) 완전히 다른 사람 두 명이 들어온 것처럼 처리돼 캐릭터가 두 개 생기고,
    // 나중에 실제로 나갈 때도 그중 최신 id 하나만 user_left가 나가 나머지 하나가 유령으로 남았음
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      rawSend({ type: 'join', roomPath, userId, x, y, z })
    }
    // OPEN이 아니면 아무것도 안 함 — connect()의 onopen이 뜨는 대로 _lastJoinParams를 보고 보내줌
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
  function resumeConnection(userId: number | null = _wsUserId) {
    _suppressReconnect = false
    kickedReason.value = null
    connect(_apiBaseUrl, userId)
  }

  // 그 채널을 실제로 열어봤을 때(ServerSidebar.vue가 현재 경로와 비교해서 호출) 안 읽음 표시를
  // 지움 — 새 글 스트리밍과 마찬가지로 세션 동안만 유지되는 순전히 클라이언트 쪽 read 상태
  function markRoomRead(roomPath: string) {
    if (!(roomPath in unreadRooms.value)) return
    const next = { ...unreadRooms.value }
    delete next[roomPath]
    unreadRooms.value = next
  }

  return {
    presenceByRoom: readonly(presenceByRoom),
    otherUsersInRoom: readonly(otherUsersInRoom),
    realtimeChats: readonly(realtimeChats),
    jumpPulses: readonly(jumpPulses),
    kickedReason: readonly(kickedReason),
    unreadRooms: readonly(unreadRooms),
    markRoomRead,
    federatedPostFeed: readonly(federatedPostFeed),
    timelinePostFeed: readonly(timelinePostFeed),
    connect,
    joinRoom,
    sendPosition,
    sendChat,
    editChat,
    deleteChat,
    resumeConnection,
  }
}
