// 세션 도입(server/utils/session.ts) 이후로 "로그인 상태"를 나타내는 값이 두 개로 늘어남:
// 1) 'user-id' 평문 쿠키 — useCurrentUser.ts가 읽는, UI 표시 전용 값(실제 인가엔 안 쓰임)
// 2) 'cocoartz-session' httpOnly 쿠키 — requireUserId(event)가 검증하는 진짜 신원
//
// 문제는 이 둘이 서로 갱신되는 시점이 다르다는 것: 세션 쿠키가 무슨 이유로든(만료, 서버가
// SESSION_SECRET 없이 재시작해서 예전 세션을 더는 못 푸는 경우 등) 먼저 무효화돼도 'user-id'
// 쿠키는 그대로 남아있어서, 화면은 계속 "로그인된 것처럼" 보임. 그 상태에서 requireUserId를
// 쓰는 API(재화 잔액 조회 등 100곳 넘게)를 부르면 서버는 401로 거절하는데, 각 API 호출부는
// 그 401을 개별적으로 조용히 삼키고 기본값(예: 잔액 0)으로 대체해버림 — 그래서 "로그인은 돼
// 있는 것 같은데 재화가 자꾸 0으로 보인다"는 증상이 나타남.
//
// 근본 해결(서버가 왜 세션을 잃어버렸는지)과는 별개로, 클라이언트가 이 불일치 자체를 오래 들고
// 있지 않게 만드는 안전장치: 어떤 API 호출이든 401을 받으면(=서버가 "로그인이 필요하다"고 한
// 것) 'user-id' 쿠키를 같이 지워서 화면도 진짜 상태(로그아웃)로 즉시 맞춤. 이러면 각 화면이
// 이미 갖고 있는 "로그인 필요" 안내로 자연스럽게 넘어가지, 로그인된 것처럼 보이면서 값만
// 틀리게 나오는 혼란스러운 상태로 남지 않음.
export default defineNuxtPlugin(() => {
    const original = globalThis.$fetch
    globalThis.$fetch = original.create({
        onResponseError({ response }) {
            if (response.status !== 401) return
            const userIdCookie = useCookie('user-id')
            if (userIdCookie.value != null) userIdCookie.value = null
        },
    }) as typeof globalThis.$fetch
})
