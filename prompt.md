# 코코아츠(CocoArtz) 리부트 — 기획 요약

1. 디스코드 유사 커뮤니티 구조
2. 자체 호스팅 소프트웨어 (도커라이즈, 환경변수)
3. Nuxt 4 기반
4. 채널 + 음성채팅방 (TTS 방: 채팅 내용을 TTS로 송출)
5. 각 채널 안에 아이소메트릭 맵 / 아바타 이동 / 웹소켓 멀티유저 / 의사3D 원근감+피사계심도
6. Discord 유사 UI, 악센트 #D21F3C, 채팅은 SNS 타임라인 스타일로 맵 위 모달
7. 페디버스 연합 채널 (마스토돈/미스키 ActivityPub)
8. 유저 개인 페이지 + 방 꾸미기 (헤더-프사-닉네임-타임라인)
9. 상점 채널 (타일/아바타 아이템 구매)
11. 전용 폰트 cocoartz (woff2)
12. 위쪽 메뉴인 서버 정보, 멤버, 설정의 맵은 홈과 동기화해주세요. 유저가 서버 정보, 멤버, 설정에 들어가있어도 홈에 들어가있는것과 같은 효과가 필요합니다.
13. 커뮤니티 유저들에 의해 작성, 수정되고 비로그인 유저들도 조회할 수 있는 위키 채널 있으면 좋을 듯

---

## 구현 계획표

| 우선순위 | 분류 | 작업 | 상태 |
|:---:|---|---|:---:|
| 1 | 기반 | Nuxt 4 프로젝트 세팅 | ✅ |
| 1 | 기반 | Docker + docker-compose (앱 + PostgreSQL) | ✅ |
| 1 | 기반 | 환경변수 구조 (.env, SERVER_SLUG 등) | ✅ |
| 1 | 기반 | PostgreSQL + Drizzle ORM 스키마 | ✅ |
| 1 | 기반 | 자체 호스팅 단일 서버 구조 (slug 레이어 제거) | ✅ |
| 1 | UI | 전용 폰트(cocoartz) + 전역 CSS 변수(#D21F3C) | ✅ |
| 1 | UI | 헤더 / 사이드바 / 프로필바 레이아웃 | ✅ |
| 1 | UI | 채널별 라우팅 (`/`, `/[page]`, `/info` 등) | ✅ |
| 2 | 맵 | 아이소메트릭 타일 렌더링 (z-order 포함) | ✅ |
| 2 | 맵 | WASD 캐릭터 이동 + 위치 localStorage 저장 | ✅ |
| 2 | 맵 | 맵 데이터 DB 저장 및 룸별 로드 | ✅ |
| 2 | 맵 | 의사3D 효과 (원근감 + handheld) | ✅ |
| 2 | 맵 | 의사3D 효과 (피사계심도) | ✅ |
| 2 | 맵 | 스크롤 줌: 타일 상/하단 분할 렌더링 + 캐릭터 세로 스쿼시 + 발끝-타일 정렬 | ✅ |
| 2 | 맵 | 타일 z좌표 elevation (다층 블록 쌓기, z-depth sort) | ✅ |
| 2 | 맵 | 타일 옆면 3분할 렌더링 (25/25/50 고정·스트레치·고정, 줌 연동 스케일) | ✅ |
| 3 | 채팅 | 채팅 UI (오버레이, 작은↔큰 모드 토글) | ✅ |
| 3 | 채팅 | 채팅 실제 전송 (POST API + 실시간 반영) | ✅ |
| 3 | 채팅 | Shift+Enter 개행 (textarea 자동 높이 조절) + 한국어 IME 이중 전송 방지 | ✅ |
| 3 | 채팅 | 채팅·게시판·음성채팅·위키 마크다운 서식 지원 (`marked`, `breaks:true`) | ✅ |
| 3 | 채팅 | SNS 타임라인 게시판 UI (WindowBoard 기초) | ✅ |
| 3 | 채팅 | 게시물 작성 / 좋아요 / 댓글 | ✅ |
| 3 | 채팅 | 음성채팅방 채널 타입 + TTS 송출 | ✅ |
| 3 | 위키 | 위키 채널 기본 기능 (대문·목록·작성·편집·이력) | ✅ |
| 3 | 위키 | `[[페이지명]]` 위키 링크 문법 + 하위 페이지 URL (`/wiki/slug`) | ✅ |
| 3 | 위키 | 대문 페이지 자동 표시 (가장 먼저 생성된 페이지) | ✅ |
| 4 | UI | 모든 모달 다크 모드 통일 (게시판·음성·서버정보·채팅 대형 모드) | ✅ |
| 4 | UI | 서버 정보·멤버·설정 페이지의 맵을 홈과 동기화 (path="/") | ✅ |
| 4 | UI | WindowMembers / WindowSettings 플레이스홀더 모달 | ✅ |
| 4 | UI | 채팅·게시판·음성채팅 유저 클릭 → `/@username` 프로필 워프 | ✅ |
| 4 | 인증 | 회원가입 / 로그인 시스템 (현재 이메일 하드코딩) | ✅ |
| 4 | 유저 | 유저 개인 페이지 (`/@[username]`) — 카드 레이아웃 + 개인 방 + 게시글 타임라인 | ✅ |
| 4 | 유저 | 개인 방 꾸미기 — 기본 맵 표시 (DB `users.map` 컬럼, 6×6 기본 맵, 내장형 WASD) | ✅ |
| 4 | 유저 | 개인 방 꾸미기 — UserRoomEmbed 3분할 렌더링·스크롤 줌 RoomMap 동기화 | ✅ |
| 4 | 유저 | 개인 페이지에서 작성한 게시글 누르면 그 게시글을 조회할 수 있도록 하기(같은 페이지 말고 링크 공유할 수 있게 별도의 페이지로 구현) | ✅ |
| 4 | 유저 | 개인 방 꾸미기 — 타일 편집 UI (팔레트 + 아이소메트릭 그리드 클릭 배치) + 저장 API | ✅ |
| 5 | 멀티유저 | WebSocket — 같은 채널 유저 아바타 위치 공유 | ✅ |
| 5 | 멀티유저 | 웹소켓 - 사이드바에 채널 접속 유저 프사+닉네임 표시 (디스코드 음성채팅 스타일) | ✅ |
| 5 | 멀티유저 | 채팅 실시간 수신 (WebSocket) | ✅ |
| 5 | 멀티유저 | WS 버그 수정: 채팅 이중 전송 (`broadcastToRoom` + `sendTo` 중복 제거) | ✅ |
| 5 | 멀티유저 | WS 버그 수정: 재접속 시 동일 userId stale 연결 정리 (클라이언트 복제 방지) | ✅ |
| 5 | 멀티유저 | 슬랙, 디스코드처럼 이모지 리액션 받기 / 좋아요와 분리 / 디코처럼 여러 리액션 가능 | ✅ |
| 6 | 연합 | 페디버스 채널 (ActivityPub, 마스토돈/미스키 연동, 이모지 리액션은 연동되지 않음 - 좋아요만 연동 ) | ⬜ |
| 7 | 상점 | 상점 채널 UI | ⬜ |
| 7 | 상점 | 타일·아바타 아이템 구매 시스템 | ⬜ |
| 7 | 상점 | 배경 사진 변경 기능 | ⬜ |

---

## 폰트

```css
@font-face {
    font-family: 'cocoartz';
    src: url('https://blog.howeverina.studio/font/Griun_Cocoartz-Rg.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
    ascent-override: 80%;
    descent-override: 20%;
}

@font-face {
    font-family: 'cocoartz';
    src: url('https://blog.howeverina.studio/font/Griun_DarkCocoartz-Rg.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
    ascent-override: 80%;
    descent-override: 20%;
}
```

---

## 줌 시스템 핵심 공식 (RoomMap.vue + CharacterMoving.vue)

줌 범위: `z = 0.7 ~ 2.5`, `topRatio` 계산:
```js
topRatio = z >= 1 ? max(1/3, 0.5 - (z-1)/9) : min(0.9, 0.5 + (1-z)*0.28)
dynH = topRatio * 128   // 타일 윗면(바닥) 높이
```

### 캐릭터 하반신 세로 스쿼시 (`CharacterMoving.vue`)
```js
// z < 1: z=0.7→31px, z=1.0→64px 선형 / z >= 1: 항상 64px
charBottomH = z >= 1 ? 64 : round(31 + 33 * (z - 0.7) / 0.3)
```

캐릭터는 상단 슬라이스(64px) + 하단 슬라이스(charBottomH)로 분할 렌더링.  
`transform: scale(z)`, `transformOrigin: center 48px` (눈 위치 = 화면 중앙 고정).

### 캐릭터 발끝 화면 위치
```
feet_screen_y = content_center + (16 + charBottomH) * z
```
- 눈(layout y=48) → scale 피벗 = 화면 중앙
- 발끝(layout y=64+charBottomH) → center + (16 + charBottomH) * z

### 맵 오프셋 (`calcMapTopOffset`)
```js
// 타일 앞끝(Near corner) = 발끝에 정렬
// Near corner screen_y = center + offset + (dynH/2)*z
// → offset = (16 + charBotH - dynH/2) * z
offset = round((16 + charBotH - topRatio*64) * z)
```

### 타일 스케일 피벗 보정 (`tilesScaleStyle`)
```js
// 타일 y 간격 = topRatio*64 per position unit (줌마다 달라짐)
ox = position.x * 32
oy = -position.y * topRatio * 64   // ← *32가 아님! topRatio에 따라 변함
transformOrigin: `calc(50% + ${ox}px) calc(50% + ${oy}px)`
```

### 맵 스크롤 위치
```js
map.left = position.x * (-32)
map.top  = position.y * topRatio * 64 + offset   // ← *32가 아님!
```

### 다른 유저 아바타 오프셋
```js
dx = (other.x - local.x) * 32 * z
dy = -(other.y - local.y) * topRatio * 64 * z
```

> **주의**: `oy`와 `map.top`에서 `py * 32` 대신 `py * topRatio * 64`를 써야 하는 이유 — 아이소메트릭 타일의 y 간격(dynH/2)이 줌에 따라 변하기 때문. `32`는 topRatio=0.5(z=1)일 때만 맞는 값.

---

## 마크다운 렌더링

`marked` 라이브러리 사용. 컴포넌트별 설정:

| 위치 | 함수 | 옵션 |
|---|---|---|
| 채팅 (RoomMap) | `marked.parse(text, { breaks: true })` | 한 줄 개행 → `<br>` |
| 음성채팅 (WindowVoice) | `marked.parse(text, { breaks: true })` | 한 줄 개행 → `<br>` |
| 게시판 (WindowBoard) | `marked.parse(content)` | 표준 |
| 위키 (WindowWiki) | `marked.parse(preprocessWikiLinks(content))` | 표준, `[[링크]]` 전처리 포함 |

채팅/음성채팅에서 `marked.parse()`는 `<p>` 태그로 감싸므로 CSS로 여백 제거 필요:
```css
.msg :deep(p) { margin: 0; }
.msg :deep(p + p) { margin-top: 0.35em; }
```

---

## 위키 시스템

### 라우팅 구조
```
app/pages/
  [page]/
    index.vue    → /:page        (채널 기본 뷰)
    [slug].vue   → /:page/:slug  (위키 하위 페이지)
```
- `[page].vue` 파일 없이 `[page]/` 디렉토리만 사용 → Nuxt가 flat 독립 라우트로 처리 (nested 방지)
- `[page]/[slug].vue`에서 `route.params.slug`를 `wikiSlug`로 RoomMap → WindowWiki에 전달

### `[[링크]]` 문법 (`WindowWiki.vue`)
```js
function preprocessWikiLinks(content) {
    return content.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
        const slug = toSlug(name.trim())
        const href = `${props.channelPath}/${encodeURIComponent(slug)}`
        return `<a href="${href}" class="wiki-internal-link">${name.trim()}</a>`
    })
}

function toSlug(title) {
    return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
}
```
- `/wiki/테스트` → `getWikiPageBySlug` API 호출 (slug + roomid로 조회)

### 대문 페이지 & 내비게이션
- `targetSlug` 없을 때: `pages`에서 id 기준 최소값 페이지를 자동으로 대문 표시
- `targetSlug` 있을 때: `openPageBySlug(slug)` 호출, 없으면 목록 유지
- 헤더: 제목 왼쪽, 버튼(편집·이력·목록·✕) 전부 오른쪽 (`wiki-header-actions` flex 그룹)

---

## WebSocket 주요 버그 수정 기록

### 채팅 이중 수신 (서버 측)
`server/routes/_ws.ts`의 chat 처리:
```ts
// 수정 전 (버그): broadcastToRoom이 발신자 포함 + sendTo로 한 번 더 = 2회 수신
broadcastToRoom(info.roomPath, { type: 'chat', chat: chatWithUser })
sendTo(peer, { type: 'chat', chat: chatWithUser })

// 수정 후: broadcastToRoom에서 발신자 제외 + sendTo 1회
broadcastToRoom(info.roomPath, { type: 'chat', chat: chatWithUser }, peer.id)
sendTo(peer, { type: 'chat', chat: chatWithUser })
```

### 클라이언트 복제 (stale 연결)
페이지 재로드 시 이전 WS 연결이 서버에 남아있으면, 새 연결 join 시 같은 userId가 2개 peer로 관리되어 다른 유저에게 캐릭터가 2개 보임. join 처리 최초에 같은 userId의 기존 연결을 `removePeer`로 정리:
```ts
for (const [staleId, staleInfo] of peerMap) {
    if (staleInfo.userId === userId && staleId !== peer.id) {
        removePeer(staleId)
    }
}
```

### 채팅 중복 표시 (클라이언트 측)
`chatData`(HTTP 초기 로드)와 `realtimeChats`(WS 수신)에 같은 메시지가 들어갈 수 있는 엣지 케이스 대비:
```js
const chats = computed(() => {
    const base = chatData.value ?? []
    const seen = new Set(base.map(c => c.id))
    const fresh = realtimeChats.value.filter(c => !seen.has(c.id))
    return [...base, ...fresh]
})
```

### Vue template ref 자동 언래핑 주의
Vue 3 template에서 `ref`는 자동 언래핑됨 → 인라인 arrow function에서 `.value` 사용 불가:
```js
// ❌ 오류: mapBlurred가 template에서 boolean으로 언래핑됨
@set-blur="(v) => { mapBlurred.value = v }"

// ✅ script setup에 메서드로 정의
function setBlurFromVoice(v) { mapBlurred.value = v }
@set-blur="setBlurFromVoice"
```
