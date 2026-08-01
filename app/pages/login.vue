<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const { userId } = useCurrentUser()
const router = useRouter()

const mode = ref('login')
const email = ref('')
const password = ref('')
const username = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const loading = ref(false)

async function submit() {
    errorMsg.value = ''
    successMsg.value = ''
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
                successMsg.value = '가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있어요.'
                mode.value = 'login'
                password.value = ''
                return
            }
            userId.value = res.id
            await router.push('/')
        }
    } catch (e) {
        errorMsg.value = e?.data?.message ?? '오류가 발생했습니다'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div id="login-page">
        <div id="login-card">
            <div id="login-logo">CocoArtz</div>

            <div id="login-tabs">
                <button :class="{ active: mode === 'login' }" @click="mode = 'login'; errorMsg = ''; successMsg = ''">로그인</button>
                <button :class="{ active: mode === 'register' }" @click="mode = 'register'; errorMsg = ''; successMsg = ''">회원가입</button>
            </div>

            <form id="login-form" @submit.prevent="submit">
                <div v-if="mode === 'register'" class="field">
                    <label>아이디</label>
                    <input v-model="username" type="text" placeholder="영문, 숫자" autocomplete="username" required />
                </div>
                <div class="field">
                    <label>이메일</label>
                    <input v-model="email" type="email" placeholder="example@email.com" autocomplete="email" required />
                </div>
                <div class="field">
                    <label>비밀번호</label>
                    <input v-model="password" type="password" placeholder="6자 이상" autocomplete="current-password" required />
                </div>

                <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
                <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

                <button type="submit" class="submit-btn" :disabled="loading">
                    {{ loading ? '처리 중...' : (mode === 'login' ? '로그인' : '가입하기') }}
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
