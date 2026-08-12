<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const route = useRoute()
const router = useRouter()
const { t, errT } = useI18n()

const { server } = await useServer()
useHead({ title: server?.title || 'CocoArtz' })

const token = typeof route.query.token === 'string' ? route.query.token : ''

const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const done = ref(false)
const errorMsg = ref('')
const errorCode = ref('')

async function submit() {
    errorMsg.value = ''
    errorCode.value = ''
    if (password.value.length < 6) {
        errorMsg.value = t('errors.PASSWORD_TOO_SHORT')
        return
    }
    if (password.value !== passwordConfirm.value) {
        errorMsg.value = t('resetPassword.mismatch')
        return
    }
    loading.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/auth/resetPassword`, {
            method: 'POST',
            body: { token, password: password.value },
        })
        done.value = true
        // 재설정 직후 자동 로그인은 안 시킴(보안상 새 비밀번호로 직접 로그인하게 하는 쪽이 안전) —
        // 3초 뒤 로그인 화면으로 자연스럽게 넘겨줌
        setTimeout(() => router.push('/login'), 3000)
    } catch (e) {
        errorMsg.value = errT(e)
        errorCode.value = e?.data?.data?.code ?? ''
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div id="login-page">
        <div id="login-card">
            <div id="login-logo">{{ server?.title || 'CocoArtz' }}</div>

            <p v-if="!token" class="error-msg">{{ t('resetPassword.invalidLink') }}</p>
            <template v-else-if="done">
                <p class="success-msg">{{ t('resetPassword.done') }}</p>
            </template>
            <form v-else id="login-form" @submit.prevent="submit">
                <p class="lead-text">{{ t('resetPassword.lead') }}</p>
                <div class="field">
                    <label>{{ t('resetPassword.newPasswordLabel') }}</label>
                    <input v-model="password" type="password" :placeholder="t('auth.passwordPlaceholder')" autocomplete="new-password" required autofocus />
                </div>
                <div class="field">
                    <label>{{ t('resetPassword.confirmLabel') }}</label>
                    <input v-model="passwordConfirm" type="password" :placeholder="t('resetPassword.confirmPlaceholder')" autocomplete="new-password" required />
                </div>

                <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

                <button type="submit" class="submit-btn" :disabled="loading">
                    {{ loading ? t('resetPassword.submitting') : t('resetPassword.submit') }}
                </button>
            </form>

            <NuxtLink v-if="!token || errorCode === 'LINK_EXPIRED'" to="/forgot-password" class="submit-btn" style="text-align:center;text-decoration:none">{{ t('resetPassword.retry') }}</NuxtLink>
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

#login-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.lead-text {
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.55);
    margin: 0;
    line-height: 1.5;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field label {
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.45);
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.field input {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.9);
    transition: border-color 0.15s, background 0.15s;
}

.field input::placeholder { color: rgba(var(--fg-rgb),0.25); }
.field input:focus {
    outline: none;
    border-color: var(--accent, #D21F3C);
    background: rgba(var(--fg-rgb),0.09);
}

.error-msg {
    font-size: 0.85rem;
    color: #ff6b6b;
    margin: 0;
    padding: 8px 12px;
    background: rgba(255, 107, 107, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(255, 107, 107, 0.2);
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
.submit-btn:disabled { opacity: 0.4; cursor: default; }
</style>
