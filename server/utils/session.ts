import type { H3Event } from 'h3'

// 로그인 세션 — h3의 useSession(iron 방식으로 암호화+서명된 쿠키)으로 유저 id를 안전하게 담음.
//
// ⚠️ 예전엔 이게 없었음: login.ts가 'user-id' 쿠키에 평문 유저 id를 그대로 넣었고, 심지어
// 대부분의 API는 그 쿠키조차 안 보고 요청 body에 실려온 userid 필드를 그대로 "이 사람이다"로
// 믿어버렸음 — 로그인 없이도 body에 남의(혹은 관리자의) userid를 실어 보내면 그 사람 행세가
// 가능한 완전한 인증 우회였음. 이제 실제 "내가 누구인지"는 오직 이 세션(서버만 복호화 가능한
// httpOnly 쿠키)에서만 나옴 — API 핸들러는 절대 body.userid를 자기 자신의 신원으로 쓰면 안 되고,
// 반드시 requireUserId(event)/getOptionalUserId(event)를 통해서만 얻어야 함.
//
// 'user-id' 쿠키(평문, httpOnly 아님)는 그대로 유지함 — 클라이언트(useCurrentUser.ts)가 "지금
// 로그인된 사람이 누구인지" UI 표시용으로 읽는 용도로만 계속 씀. 이 쿠키 값 자체는 이제 어떤
// API의 인가 판단에도 안 쓰이니, 유저가 자기 브라우저에서 이 쿠키를 조작해도(자기 자신에게만
// 영향) 실제로 할 수 있는 게 없음 — 진짜 권한은 세션 쿠키(iron으로 봉인돼서 위조 불가능)가 갖고 있음.
const SESSION_NAME = 'cocoartz-session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30일 — login.ts의 기존 'user-id' 쿠키 수명과 동일하게 맞춤

interface AuthSessionData {
    userId: number
}

function sessionPassword(): string {
    const secret = process.env.SESSION_SECRET
    if (secret && secret.length >= 32) return secret
    // 프로덕션에서 시크릿을 안 정하면 서버 재시작마다(그리고 다중 인스턴스 배포 시 인스턴스마다)
    // 값이 달라져서 로그인이 계속 풀림 — 그렇게라도 눈에 띄게 만들어서 반드시 SESSION_SECRET을
    // 32자 이상 랜덤 문자열로 설정하게 유도함(.env.example 참고). 로컬 개발은 계속 되게 폴백만 둠.
    console.warn('[session] SESSION_SECRET 환경변수가 없거나 32자 미만이에요 — 서버를 재시작하면 로그인이 풀려요. 배포 시 꼭 32자 이상의 랜덤 문자열로 설정해주세요(예: openssl rand -base64 32).')
    return 'dev-only-insecure-session-secret-change-me-in-prod'
}

function getAuthSession(event: H3Event) {
    return useSession<AuthSessionData>(event, {
        password: sessionPassword(),
        name: SESSION_NAME,
        maxAge: SESSION_MAX_AGE,
        // cookie 옵션을 명시 안 하면 h3 기본값(secure, httpOnly, path:/)을 그대로 씀 —
        // sameSite만 로그인 흐름(외부 링크 타고 들어와도 세션 유지)에 맞춰 lax로 지정
        cookie: { sameSite: 'lax' },
    })
}

// 로그인/회원가입 성공 직후 호출 — 세션 쿠키를 새로 발급함
export async function createAuthSession(event: H3Event, userId: number): Promise<void> {
    const session = await getAuthSession(event)
    await session.update({ userId })
}

// 로그아웃 시 호출 — 세션 쿠키를 지움
export async function destroyAuthSession(event: H3Event): Promise<void> {
    const session = await getAuthSession(event)
    await session.clear()
}

// 로그인이 반드시 필요한 API에서 호출 — 세션이 없거나 위조돼서 복호화가 안 되면 401.
// body에 실려온 userid는 여기서 절대 안 봄(서버가 검증한 값만 신뢰).
export async function requireUserId(event: H3Event): Promise<number> {
    const session = await getAuthSession(event)
    const userId = session.data?.userId
    if (!userId) throw createError({ statusCode: 401, message: '로그인이 필요합니다' })
    return userId
}

// 로그인 여부와 무관하게 동작하되(비로그인도 볼 수 있는 화면 등) 로그인 상태면 그 신원을
// 반영해야 하는 API에서 호출 — 세션이 있으면 검증된 id, 없으면 null
export async function getOptionalUserId(event: H3Event): Promise<number | null> {
    const session = await getAuthSession(event)
    return session.data?.userId ?? null
}

function parseCookieHeader(header: string): Record<string, string> {
    const out: Record<string, string> = {}
    for (const part of header.split(';')) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        const key = part.slice(0, eq).trim()
        const val = part.slice(eq + 1).trim()
        try { out[key] = decodeURIComponent(val) } catch { out[key] = val }
    }
    return out
}

// server/routes/_ws.ts(WebSocket) 전용 — 일반 API처럼 H3Event가 없고 crossws Peer.request만
// 있어서(순수 Headers 객체) useSession을 못 씀. unsealSession은 실제로 event 인자를 안 쓰기
// 때문에(h3 소스 확인함) 쿠키 헤더에서 세션 쿠키 값만 직접 뽑아 언실하면 됨.
// ⚠️ 예전엔 WS 'join' 메시지의 body(클라이언트가 자유롭게 조작 가능)에 실린 userId를 그대로
// 믿었음 — REST API들과 완전히 같은 종류의 인증 우회였고(실시간 이동/채팅을 남 행세로 할 수
// 있었음), 여기서 한 번만 제대로 검증하면 이후 로직(position/chat/chat_edit/chat_delete)은
// 전부 이때 서버가 저장해둔 PeerInfo.userId를 그대로 재사용하니 그쪽은 손댈 필요 없음.
export async function getUserIdFromCookieHeader(cookieHeader: string | null | undefined): Promise<number | null> {
    if (!cookieHeader) return null
    const sealed = parseCookieHeader(cookieHeader)[SESSION_NAME]
    if (!sealed) return null
    try {
        const unsealed = await unsealSession(undefined as unknown as H3Event, {
            password: sessionPassword(),
            name: SESSION_NAME,
            maxAge: SESSION_MAX_AGE,
        }, sealed)
        const userId = (unsealed.data as AuthSessionData | undefined)?.userId
        return typeof userId === 'number' ? userId : null
    } catch {
        return null  // 위조/만료된 세션 쿠키 — 로그인 안 한 것과 동일하게 취급
    }
}
