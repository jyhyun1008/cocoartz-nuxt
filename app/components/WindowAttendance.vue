<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-calendar-01"></i>
            <span style="flex:1">출석체크</span>
            <span class="shop-balance"><i class="hgi hgi-stroke hgi-coins-01"></i> {{ balance }} {{ currencyName }}</span>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>

        <div id="attendance-content">
            <div class="attendance-hero">
                <div class="attendance-streak">
                    <span class="streak-num">{{ status?.currentStreak ?? 0 }}</span>일 연속 출석 중
                </div>
                <button
                    class="submit-btn attendance-claim-btn"
                    :disabled="!status || status.claimedToday || claiming"
                    @click="claim"
                >
                    <template v-if="status?.claimedToday">
                        <i class="hgi hgi-stroke hgi-checkmark-circle-01"></i> 오늘 출석 완료
                    </template>
                    <template v-else-if="claiming">처리 중...</template>
                    <template v-else>출석하고 {{ status?.nextReward ?? '' }}{{ currencyName }} 받기</template>
                </button>
                <p v-if="claimError" class="admin-error">{{ claimError }}</p>
                <p v-if="justClaimedAmount !== null" class="attendance-claimed-msg">
                    <i class="hgi hgi-stroke hgi-coins-01"></i> +{{ justClaimedAmount }} {{ currencyName }} 획득!
                </p>
            </div>

            <div class="attendance-calendar">
                <div class="attendance-cal-weekdays">
                    <span v-for="w in ['일','월','화','수','목','금','토']" :key="w">{{ w }}</span>
                </div>
                <div class="attendance-cal-grid">
                    <div v-for="(d, i) in calendarDays" :key="d?.date ?? `blank-${i}`" class="attendance-cal-cell" :class="{ blank: !d, claimed: d?.claimed, today: d?.isToday, future: d?.future }">
                        <template v-if="d">
                            <span class="cal-day-num">{{ d.day }}</span>
                            <i v-if="d.claimed" class="hgi hgi-stroke hgi-checkmark-circle-01"></i>
                        </template>
                    </div>
                </div>
            </div>

            <p class="attendance-hint">매일 자정(UTC)에 초기화돼요. 하루라도 거르면 연속 출석일수가 1일로 초기화되니, 매일 들러서 챙겨가세요!</p>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()
const { server } = await useServer()
const currencyName = computed(() => server?.currencyName ?? '코코아')
const { playCoinSound } = useSoundEffects()

// 재화 잔액 — ServerProfilebar.vue/WindowShop.vue와 같은 키로 캐시를 공유해서, 여기서 출석하면
// 사이드바 잔액도 같이 갱신됨
const { data: balanceData, refresh: refreshBalance } = await useAsyncData(
    `balance-data-${server?.id}`,
    () => (isLoggedIn.value && server?.id)
        ? $fetch(`${apiBaseUrl}/api/getMyBalance`, { method: 'POST', body: { userid: userId.value, serverid: server.id } }).catch(() => ({ balance: 0 }))
        : { balance: 0 },
)
const balance = computed(() => balanceData.value?.balance ?? 0)

const { data: status, refresh: refreshStatus } = await useAsyncData(
    `attendance-status-${server?.id}`,
    () => (isLoggedIn.value && server?.id)
        ? $fetch(`${apiBaseUrl}/api/getAttendanceStatus`, { method: 'POST', body: { userid: userId.value, serverid: server.id } }).catch(() => null)
        : null,
    { watch: [userId] },
)

// 이번 달 캘린더 — status.today(서버가 내려주는 UTC 기준 "YYYY-MM-DD")를 기준으로 그 달의
// 1일이 무슨 요일인지 계산해서 앞자리를 비워두고, claimedDates에 있는 날짜만 체크 표시함
const calendarDays = computed(() => {
    const todayStr = status.value?.today
    if (!todayStr) return []
    const [year, month] = todayStr.split('-').map(Number)
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const claimedSet = new Set(status.value?.claimedDates ?? [])

    const cells = new Array(firstWeekday).fill(null)
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        cells.push({
            date: dateStr,
            day,
            claimed: claimedSet.has(dateStr),
            isToday: dateStr === todayStr,
            future: dateStr > todayStr,
        })
    }
    return cells
})

const claiming = ref(false)
const claimError = ref('')
const justClaimedAmount = ref(null)

async function claim() {
    if (claiming.value || !status.value || status.value.claimedToday) return
    claiming.value = true
    claimError.value = ''
    try {
        const res = await $fetch(`${apiBaseUrl}/api/claimAttendance`, {
            method: 'POST',
            body: { userid: userId.value, serverid: server.id },
        })
        justClaimedAmount.value = res.amount
        playCoinSound()
        await Promise.all([refreshStatus(), refreshBalance()])
    } catch (e) {
        claimError.value = e?.data?.message ?? '출석 처리에 실패했습니다'
    } finally {
        claiming.value = false
    }
}
</script>

<style>
#attendance-content {
    padding: 20px;
    overflow-y: auto;
}

.attendance-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 16px;
    background: var(--bgaccent);
    border-radius: 12px;
    margin-bottom: 20px;
    text-align: center;
}

.attendance-streak {
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.65);
}

.streak-num {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--accent);
    margin-right: 2px;
}

.attendance-claim-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.attendance-claimed-msg {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #d99a00;
    font-weight: 700;
    font-size: 0.9rem;
}

.attendance-calendar {
    max-width: 360px;
    margin: 0 auto;
}

.attendance-cal-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.35);
    margin-bottom: 6px;
}

.attendance-cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
}

.attendance-cal-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.5);
    gap: 1px;
}

.attendance-cal-cell.blank { visibility: hidden; }

.attendance-cal-cell.future {
    color: rgba(var(--fg-rgb),0.2);
}

.attendance-cal-cell.today {
    outline: 1.5px solid var(--accent);
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.85);
}

.attendance-cal-cell.claimed {
    background: var(--bgaccent);
    color: var(--accent);
    font-weight: 700;
}

.attendance-cal-cell i {
    font-size: 0.6rem;
}

.attendance-hint {
    text-align: center;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.35);
    margin-top: 18px;
}
</style>
