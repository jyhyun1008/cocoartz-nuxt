import ko from '../i18n/ko.json'
import ja from '../i18n/ja.json'
import zh from '../i18n/zh.json'

// 유저별 언어 토글이 아니라 "서버 하나 = 언어 하나"(nuxt.config.ts의 public.locale, 배포
// 시점에 NUXT_PUBLIC_LOCALE로 정함) — 그래서 @nuxtjs/i18n처럼 라우팅/유저별 로케일 저장 같은
// 무거운 기능은 필요 없고, 그냥 정적 JSON 사전 하나 골라서 문자열만 찾아주면 됨.
//
// ⚠️ 지금은 로그인/가입/비밀번호 재설정 화면만 이 사전을 씀 — 앱 전체를 한 번에 다 옮기는 대신,
// 이 흐름을 "패턴 예시"로 완성해두고 나머지는 기능을 건드릴 때마다 하나씩 옮기는 중
// (docs 어딘가에 진행 상황 정리해둘 것).
const dicts: Record<string, any> = { ko, ja, zh }

function getByPath(dict: any, path: string): unknown {
    let val = dict
    for (const part of path.split('.')) {
        val = val?.[part]
        if (val === undefined) return undefined
    }
    return val
}

export function useI18n() {
    const config = useRuntimeConfig()
    const locale = (dicts[config.public.locale as string] ? config.public.locale : 'ko') as string
    const dict = dicts[locale]

    // key: "auth.loginTab" 같은 점 표기. 아직 그 언어로 안 옮겨진 키는 한국어로 폴백(공란/깨진
    // 화면 대신 "일단 한국어라도 보이게") — 완전히 없는 키만 key 문자열 그대로 보여줌(눈에 띄게
    // 해서 번역 누락을 알아채기 쉽게)
    function t(key: string, params?: Record<string, string | number>): string {
        let val = getByPath(dict, key)
        if (val === undefined) val = getByPath(ko, key)
        if (typeof val !== 'string') return key

        if (params) {
            for (const [k, v] of Object.entries(params)) val = (val as string).replaceAll(`{${k}}`, String(v))
        }
        return val as string
    }

    // 서버가 createError({ data: { code } })로 실어보낸 에러 코드(server/utils/apiError.ts
    // 참고)를 우선 쓰고, 코드가 없는(아직 이 패턴으로 안 옮겨진) 엔드포인트는 예전처럼 서버가
    // 보낸 한국어 message를 그대로 보여줌 — 번역이 100%가 아니어도 최소한 에러 자체는 항상 뜸
    function errT(e: any): string {
        const code = e?.data?.data?.code
        if (code) return t(`errors.${code}`)
        return e?.data?.message ?? t('auth.genericError')
    }

    return { t, errT, locale }
}
