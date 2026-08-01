// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@vite-pwa/nuxt'],
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
      objectStorageEnabled: !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_PUBLIC_URL_BASE),
    },
  },
})
