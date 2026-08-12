<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()
const router = useRouter()
const { t, errT } = useI18n()

const { server } = await useServer()
useHead({ title: server?.title || 'CocoArtz' })

const mode = ref('login')
const email = ref('')
const password = ref('')
const username = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const loading = ref(false)

// 로그인이 "이메일 인증 필요"로 막혔을 때만 재전송 버튼을 보여줌 — 언어랑 무관하게 서버가
// 실어보내는 에러 코드(server/utils/apiError.ts)로 판별함
const showResendVerification = ref(false)
const resending = ref(false)
const resendDone = ref(false)

async function submit() {
    errorMsg.value = ''
    successMsg.value = ''
    showResendVerification.value = false
    resendDone.value = false
    loading.value = true
    try {
        if (mode.value === 'login') {
            const res = await $fetch(`${apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                body: { email: email.value, password: password.value },
            })
            userId.value = res.id
            await router.push('/')
        } else {
            const res = await $fetch(`${apiBaseUrl}/api/auth/register`, {
                method: 'POST',
                body: { email: email.value, password: password.value, username: username.value },
            })
            if (res.pendingApproval) {
                // 승인제 가입 — 로그인 처리하지 않고 승인 대기 안내만 표시
                successMsg.value = t('auth.pendingApprovalMsg')
                mode.value = 'login'
                password.value = ''
                return
            }
            if (res.pendingVerification) {
                // 이메일 인증 필수 서버 — 로그인 처리하지 않고 메일함 확인 안내만 표시
                successMsg.value = t('auth.pendingVerificationMsg')
                mode.value = 'login'
                password.value = ''
                return
            }
            userId.value = res.id
            await router.push('/')
        }
    } catch (e) {
        errorMsg.value = errT(e)
        if (e?.data?.data?.code === 'EMAIL_VERIFICATION_REQUIRED') showResendVerification.value = true
    } finally {
        loading.value = false
    }
}

async function resendVerification() {
    if (!email.value.trim() || resending.value) return
    resending.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/auth/resendVerification`, {
            method: 'POST',
            body: { email: email.value.trim() },
        })
        resendDone.value = true
    } finally {
        resending.value = false
    }
}
</script>

<template>
    <div id="login-page">
        <div id="login-card">
            <div id="login-logo">{{ server?.title || 'CocoArtz' }}</div>

            <div id="login-tabs">
                <button :class="{ active: mode === 'login' }" @click="mode = 'login'; errorMsg = ''; successMsg = ''">{{ t('auth.loginTab') }}</button>
                <button :class="{ active: mode === 'register' }" @click="mode = 'register'; errorMsg = ''; successMsg = ''">{{ t('auth.registerTab') }}</button>
            </div>

            <form id="login-form" @submit.prevent="submit">
                <div v-if="mode === 'register'" class="field">
                    <label>{{ t('auth.handleLabel') }} <span class="field-hint">{{ t('auth.handleHint') }}</span></label>
                    <input v-model="username" type="text" :placeholder="t('auth.handlePlaceholder')" autocomplete="username" required />
                </div>
                <div class="field">
                    <label>{{ t('auth.emailLabel') }}</label>
                    <input v-model="email" type="email" placeholder="example@email.com" autocomplete="email" required />
                </div>
                <div class="field">
                    <label>{{ t('auth.passwordLabel') }}</label>
                    <input v-model="password" type="password" :placeholder="t('auth.passwordPlaceholder')" autocomplete="current-password" required />
                    <NuxtLink v-if="mode === 'login'" to="/forgot-password" class="forgot-link">{{ t('auth.forgotPassword') }}</NuxtLink>
                </div>

                <p v-if="errorMsg" class="error-msg">
                    {{ errorMsg }}
                    <button v-if="showResendVerification" type="button" class="inline-link-btn" :disabled="resending || resendDone" @click="resendVerification">
                        {{ resendDone ? t('auth.resendSent') : (resending ? t('auth.resending') : t('auth.resendVerification')) }}
                    </button>
                </p>
                <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

                <button type="submit" class="submit-btn" :disabled="loading">
                    {{ loading ? t('auth.processing') : (mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')) }}
                </button>
            </form>
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
    gap: 24px;
}

#login-logo {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--accent, #D21F3C);
    text-align: center;
    letter-spacing: -0.02em;
}

#login-tabs {
    display: flex;
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 10px;
    overflow: hidden;
}

#login-tabs button {
    flex: 1;
    background: none;
    border: none;
    padding: 9px;
    font-size: 0.9rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.4);
    cursor: pointer;
    transition: all 0.15s;
}

#login-tabs button.active {
    background: var(--accent, #D21F3C);
    color: white;
    font-weight: 700;
}

#login-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
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

.field-hint {
    font-weight: 400;
    text-transform: none;
    color: rgba(var(--fg-rgb),0.3);
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

.forgot-link {
    align-self: flex-end;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.4);
    text-decoration: none;
}
.forgot-link:hover { color: var(--accent, #D21F3C); text-decoration: underline; }

.inline-link-btn {
    display: block;
    margin-top: 6px;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
}
.inline-link-btn:disabled { cursor: default; opacity: 0.7; }

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
    font-size: 0.85rem;
    color: #23a559;
    margin: 0;
    padding: 8px 12px;
    background: rgba(35, 165, 89, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(35, 165, 89, 0.2);
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
    margin-top: 4px;
}

.submit-btn:hover { opacity: 0.88; }
.submit-btn:disabled { opacity: 0.4; cursor: default; }
</style>
