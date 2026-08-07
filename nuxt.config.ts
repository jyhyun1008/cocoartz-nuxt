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
    workbox: {
      navigateFallback: '/',
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
      // objectStorageEnabled는 여기 두지 않음 — process.env.S3_*(접두사 없는 이름)로 계산되는
      // 값이라 "docker build" 시점에 한 번 평가되어 이미지에 굳어버리고, 배포 시 NUXT_S3_*
      // 런타임 env를 아무리 제대로 줘도 반영되지 않는 버그가 있었음. 대신 요청마다 실제
      // 런타임 값을 읽는 /api/getObjectStorageStatus(server/utils/objectStorage.ts의
      // isObjectStorageConfigured() 재사용)를 클라이언트에서 호출해서 판단함
    },
  },
})
