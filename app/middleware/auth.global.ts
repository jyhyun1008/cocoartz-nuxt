export default defineNuxtRouteMiddleware((to) => {
    const { isLoggedIn } = useCurrentUser()
    // 로그인된 유저가 /login 접근 시 홈으로 리다이렉트
    if (isLoggedIn.value && to.path === '/login') {
        return navigateTo('/')
    }
    // 비로그인 유저는 /login과 콘텐츠 열람 페이지에 자유롭게 접근 가능
    // 쓰기 작업은 각 컴포넌트/API에서 개별 인증
})
