// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@vite-pwa/nuxt'],
  vue: {
    compilerOptions: {
      // emoji-picker-element이 등록하는 웹 컴포넌트 — Vue 컴포넌트로 착각해 경고내지 않게 함
      isCustomElement: (tag) => tag === 'emoji-picker',
    },
  },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
  app: {
    head: {
      title: 'CocoArtz',
      htmlAttrs: {
        lang: 'ko',
      },
      meta: [
        // Nuxt가 기본으로 넣어주는 viewport(width=device-width, initial-scale=1)는 사용자
        // 핀치/더블탭 줌을 막지 않음 — 여기서 명시적으로 덮어써서 전체 사이트에서 브라우저 자체
        // 확대·축소를 끔(맵 화면들이 핀치를 자체 줌 컨트롤로 직접 처리하는데, 브라우저 기본
        // 핀치줌까지 같이 반응하면 두 로직이 동시에 겹쳐 어긋나 보임)
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
        { name: 'author', content: 'CocoArtz' },
        { name: 'robots', content: 'all' },
        { name: 'description', content: '코코아츠 커뮤니티' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'CocoArtz' },
        { property: 'og:description', content: '코코아츠 커뮤니티' },
        { name: 'theme-color', content: '#D21F3C' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: '코코아츠' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'stylesheet', href: 'https://cdn.hugeicons.com/font/hgi-stroke-rounded.css' },
      ],
      // 하이드레이션 전에 테마부터 정해서 라이트모드 유저가 잠깐 다크로 번쩍이는 걸 방지
      script: [
        {
          innerHTML: "(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){}})()",
        },
      ],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'CocoArtz',
      short_name: '코코아츠',
      description: '코코아츠 커뮤니티',
      lang: 'ko',
      start_url: '/',
      display: 'standalone',
      theme_color: '#D21F3C',
      background_color: '#1e1e26',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // 실시간 WS/채팅/지도 앱이라 API 응답까지 캐싱하면 오래된 데이터가 보일 수 있음.
    // 정적 빌드 산출물(JS/CSS)만 프리캐시하고, 타일/캐릭터 이미지만 별도로 캐시.
    // navigateFallback은 SPA/SSG처럼 "/"가 빌드 시점에 정적 html로 나오는 경우를 위한 옵션인데,
    // 이 앱은 SSR이라 "/"가 정적 파일로 프리캐시되지 않음 — 켜두면 서비스워커가 모든 페이지 이동마다
    // 이 폴백을 쓰려다 "/"가 프리캐시 목록에 없어서 매번 non-precached-url 에러를 던졌음(콘솔 확인됨).
    // 오프라인 전용 폴백 페이지를 따로 안 두는 이상 SSR에선 의미가 없어서 아예 뺌 — 온라인일 땐
    // 어차피 네트워크로 정상 이동하니 동작엔 영향 없음.
    workbox: {
      globPatterns: ['**/*.{js,css,html}'],
      runtimeCaching: [
        {
          urlPattern: /\/(tileset|character)\/.*\.png$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'game-assets',
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },
  // 여기 process.env.X 값들은 `nuxt build`/`nuxt dev` 실행 시점(로컬에선 .env가 자동 로드됨)에
  // 딱 한 번 평가되어 그대로 굳습니다. 도커 이미지처럼 .env 없이 빌드하는 환경에선 전부 빈 값으로
  // 고정되고, 컨테이너를 나중에 DOMAIN=... 같은 이름으로 띄워도 반영되지 않음 — 반드시
  // NUXT_DOMAIN / NUXT_PUBLIC_API_BASE_URL / NUXT_PUBLIC_SERVER_SLUG / NUXT_S3_* 처럼
  // NUXT_ 접두사가 붙은 이름으로 컨테이너 실행 시점 env를 줘야 실제로 덮어써짐(docker-compose.yml
  // 참고). 여기 아래 값들은 로컬 개발 편의를 위한 기본값일 뿐, 배포 시 설정 통로가 아님.
  runtimeConfig: {
    domain: process.env.DOMAIN ?? '',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'auto',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      publicUrlBase: process.env.S3_PUBLIC_URL_BASE ?? '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },
    public: {
      apiBaseUrl: process.env.API_BASEURL ?? '',
      serverSlug: process.env.SERVER_SLUG ?? 'default',
      // 유저별 언어 토글이 아니라 "서버 하나 = 언어 하나" — 셀프호스트하는 운영자가 배포 시점에
      // 한 번 정함(app/i18n/*.json에 있는 언어만 가능, 없으면 ko로 폴백). 다른 env들처럼
      // NUXT_PUBLIC_LOCALE로 컨테이너 실행 시점에 덮어쓸 수 있음
      locale: process.env.LOCALE ?? 'ko',
      // objectStorageEnabled는 여기 두지 않음 — process.env.S3_*(접두사 없는 이름)로 계산되는
      // 값이라 "docker build" 시점에 한 번 평가되어 이미지에 굳어버리고, 배포 시 NUXT_S3_*
      // 런타임 env를 아무리 제대로 줘도 반영되지 않는 버그가 있었음. 대신 요청마다 실제
      // 런타임 값을 읽는 /api/getObjectStorageStatus(server/utils/objectStorage.ts의
      // isObjectStorageConfigured() 재사용)를 클라이언트에서 호출해서 판단함
    },
  },
})
