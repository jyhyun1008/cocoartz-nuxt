// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image'],
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
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://cdn.hugeicons.com/font/hgi-stroke-rounded.css' },
      ],
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
