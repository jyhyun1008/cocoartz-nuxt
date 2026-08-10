// 캐릭터 파츠(아바타) 카탈로그 — useTerrainCatalog.ts와 같은 패턴. 관리자가 상점 페이지에서
// 원본 스프라이트시트(768x1024, 정면·측면·후면 3열×4행)를 직접 업로드하면 그 URL을 여기서
// 받아다가 useCharacter.ts(실제 맵 위 캐릭터 렌더링)/AvatarPartIcon.vue(인벤토리·상점 아이콘)
// 둘 다에서 씀. 카탈로그에 없는 (part, variant) 조합은 예전 그대로 `/character/{part}/{variant}.png`
// 관례 경로로 폴백함(가입 시 기본 지급되는 파츠들이 여기 해당 — 이미 파일이 배포돼있어서
// 굳이 다시 업로드 안 해도 됨).
export interface AvatarPartDef {
    part: string
    variant: number
    image: string
    // 'deco' 파트에만 있음 — 몸 앞/뒤 어디에 그릴지(server/api/getAvatarPartCatalog.ts에서 items.meta 기준으로 계산해서 내려줌)
    layer?: 'front' | 'back'
}

export function useAvatarPartCatalog() {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    const { data: dbCatalogData } = useAsyncData(
        'db-avatar-part-catalog',
        () => $fetch<AvatarPartDef[]>(`${apiBaseUrl}/api/getAvatarPartCatalog`).catch(() => []),
        { server: false },
    )

    const AVATAR_PART_CATALOG = computed<AvatarPartDef[]>(() => dbCatalogData.value ?? [])

    function getAvatarPartImage(part: string, variant: string | number): string {
        const v = Number(variant)
        const found = AVATAR_PART_CATALOG.value.find(d => d.part === part && d.variant === v)
        return found?.image ?? `/character/${part}/${variant}.png`
    }

    // 데코 아이템의 앞/뒤 레이어 설정 — 관리자가 상점에 등록할 때 고른 값(items.meta). 카탈로그에
    // 없으면(레거시 관례 경로로만 존재하는 데코는 없다고 봐도 되지만 방어적으로) 기본값 'back'
    function getDecoLayer(variant: string | number): 'front' | 'back' {
        const v = Number(variant)
        const found = AVATAR_PART_CATALOG.value.find(d => d.part === 'deco' && d.variant === v)
        return found?.layer === 'front' ? 'front' : 'back'
    }

    return { AVATAR_PART_CATALOG, getAvatarPartImage, getDecoLayer }
}
