<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const route = useRoute()

const { server } = await useServer()
useHead({ title: server?.title || 'CocoArtz' })

const status = ref('loading') // 'loading' | 'success' | 'error'
const message = ref('')

const token = typeof route.query.token === 'string' ? route.query.token : ''

if (!token) {
    status.value = 'error'
    message.value = '유효하지 않은 링크입니다.'
} else {
    try {
        const res = await $fetch(`${apiBaseUrl}/api/verifyEmail`, { method: 'POST', body: { token } })
        status.value = 'success'
        message.value = `${res.username}님, 이메일 인증이 완료되었습니다.`
    } catch (e) {
        status.value = 'error'
        message.value = e?.data?.message ?? '인증에 실패했습니다.'
    }
}
</script>

<template>
    <div id="login-page">
        <div id="login-card">
            <div id="login-logo">{{ server?.title || 'CocoArtz' }}</div>

            <div v-if="status === 'loading'" class="verify-status">확인 중...</div>
            <p v-else-if="status === 'success'" class="success-msg">{{ message }}</p>
            <p v-else class="error-msg">{{ message }}</p>

            <NuxtLink to="/" class="submit-btn" style="text-align:center;text-decoration:none">홈으로 가기</NuxtLink>
        </div>
    </div>
</template>

<style scoped>
#login-page {
    min-height: 100dvh;
    background-color: var(--page-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

#login-card {
    width: 100%;
    max-width: 380px;
    background: var(--surface-0);
    border-radius: 20px;
    padding: 36px 32px 40px;
    border: 1px solid rgba(var(--fg-rgb),0.07);
    display: flex;
    flex-direction: column;
    gap: 20px;
}

#login-logo {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--accent, #D21F3C);
    text-align: center;
    letter-spacing: -0.02em;
}

.verify-status {
    text-align: center;
    color: rgba(var(--fg-rgb),0.6);
    font-size: 0.95rem;
}

.error-msg {
    font-size: 0.9rem;
    color: #ff6b6b;
    margin: 0;
    padding: 10px 14px;
    background: rgba(255, 107, 107, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(255, 107, 107, 0.2);
    text-align: center;
}

.success-msg {
    font-size: 0.9rem;
    color: #23a559;
    margin: 0;
    padding: 10px 14px;
    background: rgba(35, 165, 89, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(35, 165, 89, 0.2);
    text-align: center;
}

.submit-btn {
    background-color: var(--accent, #D21F3C);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 12px;
    font-size: 1rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s;
    display: block;
}

.submit-btn:hover { opacity: 0.88; }
</style>
