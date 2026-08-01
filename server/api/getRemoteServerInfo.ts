import { fetchInstanceInfo } from '../utils/ap/instanceInfo'

export default eventHandler(async (event) => {
    const { host } = await readBody(event)
    if (!host || typeof host !== 'string') return { name: null, themeColor: null, iconUrl: null }
    return fetchInstanceInfo(host)
})
