import { destroyAuthSession } from '../../utils/session'

export default eventHandler(async (event) => {
    deleteCookie(event, 'user-id', { path: '/' })
    await destroyAuthSession(event)
    return { ok: true }
})
