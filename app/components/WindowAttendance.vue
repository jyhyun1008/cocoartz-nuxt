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
                    :key="status?.claimedToday ? 'claimed' : 'unclaimed'"
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
                    <div v-for="(d, i) in calendarDays" :key="d?.date ?? `blank-${i}`" class="attendance-cal-cell" :class="{ blank: !d, today: d?.isToday }">
                        <template v-if="d">
                            <span class="cal-day-num">{{ d.day }}</span>
                            <i v-if="d.claimed" class="hgi hgi-stroke hgi-checkmark-circle-01 cal-status-icon cal-status-claimed"></i>
                            <i v-else-if="!d.future" class="hgi hgi-stroke hgi-cancel-01 cal-status-icon cal-status-missed"></i>
                            <span v-else class="cal-status-dot">·</span>
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
    /* 스크롤이 생기는 순간 오른쪽에만 스크롤바 폭만큼 공간이 먹혀서, margin:0 auto로 가운데
       맞춰둔 달력(.attendance-calendar)이 그만큼 왼쪽으로 쏠려 보이던 문제 — 스크롤 여부와
       무관하게 항상 그 공간을 미리 비워둬서 안 쏠리게 함 */
    scrollbar-gutter: stable;
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
    /* 아래 .attendance-cal-grid랑 gap이 안 맞으면 두 그리드의 컬럼 경계가 서로 달라져서(그리드가
       gap만큼 트랙 폭을 나눠 갖는 방식이 서로 다름) 요일 헤더가 오른쪽으로 갈수록 날짜 칸과
       점점 어긋나 보임(누적 오차) — 반드시 같은 gap을 줘야 컬럼이 정확히 맞음 */
    gap: 4px;
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

/* 칸마다 테두리 + 날짜는 위, 상태 아이콘은 아래로 고정된 위치에 둠 — 예전엔 출석한 날만
   체크 아이콘이 붙어서 내용물 양이 칸마다 달랐고, aspect-ratio가 있어도 내용이 많은 칸(날짜+
   아이콘)이 내용이 적은 칸(날짜만)보다 살짝 더 늘어나 버려서 줄마다 높이가 안 맞았음 — 이제
   모든 칸이 "날짜 + 아이콘(또는 점)"으로 항상 내용물 양이 같아서 높이가 저절로 맞음.
   ⚠️ aspect-ratio는 빼고 min-height로 고정 — aspect-ratio를 grid item에 쓰면 일부
   브라우저(특히 모바일 사파리)에서 내용이 조금만 늘어도 실제 렌더 높이가 grid의 auto row
   트랙 계산과 안 맞아서 다음 줄이 살짝 겹쳐 보이는 문제가 있었음 */
.attendance-cal-cell {
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 5px 0 7px;
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 8px;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.5);
}

.attendance-cal-cell.blank { visibility: hidden; }

.attendance-cal-cell.today {
    border-color: var(--accent);
    border-width: 1.5px;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.85);
}

.cal-day-num { font-variant-numeric: tabular-nums; }

/* 출석한 날 — 악센트색 체크(원 안에 체크 표시라 "O"보다 의미가 더 분명해서 이걸로 씀) */
.cal-status-icon.cal-status-claimed {
    color: var(--accent);
    font-size: 0.85rem;
}

/* 출석 못 한(지나간) 날 — 회색 X */
.cal-status-icon.cal-status-missed {
    color: rgba(var(--fg-rgb),0.22);
    font-size: 0.7rem;
}

/* 아직 안 온 날 — 옅은 점 하나만 */
.cal-status-dot {
    color: rgba(var(--fg-rgb),0.2);
    font-size: 0.9rem;
    line-height: 1;
}

.attendance-hint {
    text-align: center;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.35);
    margin-top: 24px;
}
</style>
