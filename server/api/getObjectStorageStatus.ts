import { isObjectStorageConfigured } from '../utils/objectStorage'

// 오브젝트 스토리지 설정 여부를 요청 시점에 확인해서 반환 — nuxt.config.ts의
// runtimeConfig.public.objectStorageEnabled는 process.env.S3_*(접두사 없는 이름)를
// "docker build" 시점에 한 번만 평가해서 이미지에 굳혀버리는 값이라, 배포 시
// NUXT_S3_* 런타임 env를 아무리 제대로 줘도 클라이언트에서는 항상 false로 보이는
// 버그가 있었음(관리자 설정 화면이 "오브젝트 스토리지가 설정되지 않았습니다"로 계속 뜸).
// 이 엔드포인트는 매 요청마다 useRuntimeConfig()로 실제 런타임 값을 읽는
// isObjectStorageConfigured()를 그대로 재사용해서 항상 최신 상태를 반영함
export default eventHandler(() => {
    return { enabled: isObjectStorageConfigured() }
})
