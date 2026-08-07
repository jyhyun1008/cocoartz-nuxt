// 오브젝트 스토리지 설정 여부 — 요청 시점에 서버가 실제 런타임 env(NUXT_S3_*)를 읽어서
// 판단한 값을 가져옴(nuxt.config.ts의 public.objectStorageEnabled는 빌드 시점에 굳어버려서
// 배포 후 런타임 env를 아무리 바꿔도 반영이 안 되는 버그가 있었음 — 그 대체용)
export const useObjectStorageStatus = () => {
    const config = useRuntimeConfig()
    const apiBaseUrl = config.public.apiBaseUrl

    const enabled = useState<boolean>('object-storage-enabled', () => false)
    const loaded = useState<boolean>('object-storage-status-loaded', () => false)

    async function ensureLoaded() {
        if (loaded.value) return
        loaded.value = true
        try {
            const res = await $fetch(`${apiBaseUrl}/api/getObjectStorageStatus`) as { enabled: boolean }
            enabled.value = !!res?.enabled
        } catch {
            enabled.value = false
        }
    }

    return { enabled, ensureLoaded }
}
