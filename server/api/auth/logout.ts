export default eventHandler((event) => {
    deleteCookie(event, 'user-id', { path: '/' })
    return { ok: true }
})
