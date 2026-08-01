export default defineEventHandler((event) => {
    const config = useRuntimeConfig()
    const domain = config.domain as string

    setHeader(event, 'Content-Type', 'application/json')
    return {
        links: [
            {
                rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                href: `https://${domain}/nodeinfo/2.0.json`,
            },
        ],
    }
})
