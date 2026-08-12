<script setup>
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl

const { server } = await useServer()
useHead({ title: server?.title || 'CocoArtz' })

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorMsg = ref('')

async function submit() {
    if (!email.value.trim() || loading.value) return
    errorMsg.value = ''
    loading.value = true
    try {
        // 이 API는 이메일이 실제로 가입돼 있는지와 무관하게 항상 성공만 돌려줌(계정 존재 유추
        // 방지) — 그래서 여기서도 성공/실패를 구분해서 보여주지 않고 항상 같은 안내만 보여줌
        await $fetch(`${apiBaseUrl}/api/auth/requestPasswordReset`, {
            method: 'POST',
            body: { email: email.value.trim() },
        })
        sent.value = true
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
            <div id="login-logo">{{ server?.title || 'CocoArtz' }}</div>

            <template v-if="sent">
                <p class="success-msg">가입하신 이메일이 맞다면, 비밀번호 재설정 링크를 보냈어요. 메일함(스팸함도)을 확인해주세요.</p>
                <NuxtLink to="/login" class="submit-btn" style="text-align:center;text-decoration:none">로그인으로 돌아가기</NuxtLink>
            </template>
            <form v-else id="login-form" @submit.prevent="submit">
                <p class="lead-text">가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드려요.</p>
                <div class="field">
                    <label>이메일</label>
                    <input v-model="email" type="email" placeholder="example@email.com" autocomplete="email" required autofocus />
                </div>

                <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

                <button type="submit" class="submit-btn" :disabled="loading">
                    {{ loading ? '전송 중...' : '재설정 링크 보내기' }}
                </button>
                <NuxtLink to="/login" class="forgot-link" style="align-self:center">로그인으로 돌아가기</NuxtLink>
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

.forgot-link {
    font-size: 0.82rem;
    color: rgba(var(--fg-rgb),0.4);
    text-decoration: none;
}
.forgot-link:hover { color: var(--accent, #D21F3C); text-decoration: underline; }
</style>
