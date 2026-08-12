<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-shopping-bag-01"></i>
            <span style="flex:1">상점</span>
            <span class="shop-balance"><i class="hgi hgi-stroke hgi-coins-01"></i> {{ balance }} {{ currencyName }}</span>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>

        <div id="shop-content">
            <div class="admin-tabs">
                <button
                    v-for="tab in mainTabs"
                    :key="tab.id"
                    class="admin-tab-btn"
                    :class="{ active: mainTab === tab.id }"
                    @click="selectMainTab(tab.id)"
                >
                    <i :class="tab.icon"></i> {{ tab.label }}
                </button>
            </div>

            <div class="admin-tabs shop-subtabs">
                <button
                    v-for="tab in currentSubTabs"
                    :key="tab.id"
                    class="admin-tab-btn"
                    :class="{ active: subTab === tab.id }"
                    @click="subTab = tab.id"
                >
                    {{ tab.label }}
                </button>
            </div>

            <p v-if="buyError" class="admin-error">{{ buyError }}</p>

            <div v-if="visibleItems.length" class="shop-grid">
                <div v-for="item in visibleItems" :key="item.id" class="shop-card">
                    <div class="shop-card-icon">
                        <AvatarPartIcon v-if="avatarPartFromCategory(item.category)" :part="avatarPartFromCategory(item.category)" :variant="item.itemKey" :size="56" />
                        <NuxtImg v-else-if="item.icon" :src="item.icon" />
                        <i v-else class="hgi hgi-stroke hgi-package" />
                    </div>
                    <!-- 이름/설명 둘 다 1줄로 자르고, 마우스 올렸을 때 다 못 보여준 글자가 있으면
                         (실제로 넘칠 때만) 음원 사이트 노래 제목처럼 좌우로 흐르게 함 -->
                    <div class="shop-card-name" @mouseenter="handleMarqueeEnter" @mouseleave="handleMarqueeLeave">
                        <span class="marquee-text">{{ item.name }}</span>
                    </div>
                    <!-- 설명이 없어도(v-if로 아예 안 그리면 높이가 적용될 요소 자체가 없어져서 설명
                         있는 카드와 없는 카드끼리 높이가 어긋남) 항상 그려서 1줄 높이를 맞춤 -->
                    <p class="shop-card-desc" @mouseenter="handleMarqueeEnter" @mouseleave="handleMarqueeLeave">
                        <span class="marquee-text">{{ item.description }}</span>
                    </p>
                    <div class="shop-card-price"><i class="hgi hgi-stroke hgi-coins-01"></i> {{ item.price }}</div>
                    <div v-if="isStackable(item)" class="shop-owned-count">{{ item.owned }}개 보유</div>

                    <!-- 맵 아이템/기능 아이템/소모품은 몇 개 살지 매번 고를 수 있고(이미 갖고 있어도 더 살 수 있음),
                         아바타/지형은 있다/없다라 항상 1개(그리고 이미 보유했으면 재구매 자체를 막음) -->
                    <div v-if="isStackable(item)" class="shop-qty-stepper">
                        <button type="button" class="shop-qty-btn" :disabled="(quantities[item.id] ?? 1) <= 1" @click="stepQty(item, -1)">−</button>
                        <input
                            v-model.number="quantities[item.id]"
                            type="number" min="1" max="99" class="shop-qty-input"
                            @change="clampQty(item)"
                        />
                        <button type="button" class="shop-qty-btn" :disabled="(quantities[item.id] ?? 1) >= 99" @click="stepQty(item, 1)">+</button>
                    </div>

                    <button
                        v-if="isStackable(item) || !item.owned"
                        class="shop-buy-btn"
                        :disabled="buyingId === item.id || !isLoggedIn"
                        @click="buy(item)"
                    >
                        {{ buyingId === item.id ? '구매 중...' : '구매' }}
                    </button>
                    <div v-else class="shop-owned-badge"><i class="hgi hgi-stroke hgi-checkmark-circle-01"></i> 보유중</div>
                </div>
            </div>
            <p v-else class="info-placeholder">이 카테고리엔 아직 등록된 아이템이 없습니다.</p>
        </div>
    </div>
</template>

<script setup>
import { isStackableCategory, avatarPartFromCategory } from '../../lib/shopCategories'

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()
const { server } = await useServer()
const currencyName = computed(() => server?.currencyName ?? '코코아')

const { mainTabs, avatarSubTabs, itemSubTabs } = useShopCategories()

const mainTab = ref('avatar')
const subTab = ref(avatarSubTabs[0]?.id ?? '')
const currentSubTabs = computed(() => mainTab.value === 'avatar' ? avatarSubTabs : itemSubTabs)
function selectMainTab(id) {
    mainTab.value = id
    subTab.value = currentSubTabs.value[0]?.id ?? ''
}
watch(mainTab, () => { subTab.value = currentSubTabs.value[0]?.id ?? '' })

// 재화 잔액 — ServerProfilebar.vue와 같은 키로 캐시를 공유해서, 여기서 구매하면 사이드바 잔액도 같이 갱신됨.
// ServerProfilebar.vue와 같은 이유로 useRequestFetch() 사용 — SSR 중 평범한 $fetch로는 세션
// 쿠키가 안 실려서 매번 401 → 잔액 0으로 보이는 문제가 있었음
const authedFetch = useRequestFetch()
const { data: balanceData, refresh: refreshBalance } = await useAsyncData(
    `balance-data-${server?.id}`,
    () => (isLoggedIn.value && server?.id)
        ? authedFetch(`${apiBaseUrl}/api/getMyBalance`, { method: 'POST', body: { userid: userId.value, serverid: server.id } }).catch(() => ({ balance: 0 }))
        : { balance: 0 },
)
const balance = computed(() => balanceData.value?.balance ?? 0)

// 키를 userId로 물려야 함 — 예전엔 고정 문자열 키('shop-catalog')라, 로그인 전(또는 다른 계정)
// 상태에서 상점을 한 번이라도 연 세션이면 Nuxt가 그 결과(모든 아이템 owned:0)를 그대로 캐싱해두고,
// 이후 실제로 로그인해서(또는 계정이 바뀌어서) 다시 상점을 열어도 새로고침 없이는 그 캐시를 그대로
// 재사용해버려서 이미 보유한 아이템까지 계속 "구매" 버튼으로 보였음(프로필 페이지 등에서 이미
// 한 번 고쳤던 것과 동일한 패턴 — 여긴 빠져있었음)
const { data: catalogData, refresh: refreshCatalog } = await useAsyncData(
    () => `shop-catalog-${userId.value ?? 'guest'}`,
    () => $fetch(`${apiBaseUrl}/api/getShopCatalog`, { method: 'POST', body: { userid: userId.value } }),
    { watch: [userId] },
)
const catalog = computed(() => catalogData.value ?? [])

const visibleItems = computed(() => catalog.value.filter(i => i.category === subTab.value))

function isStackable(item) { return isStackableCategory(item.category) }

// 이름/설명이 1줄 폭을 넘칠 때만(딱 안 잘리는 짧은 텍스트는 건드릴 필요가 없으니) 마우스를 올린
// 순간 실제로 넘치는 픽셀만큼만 좌우로 흐르게 함 — CSS만으로는 "진짜로 넘쳤는지"를 알 방법이
// 없어서(넘치든 안 넘치든 그냥 애니메이션을 걸면 안 넘치는 것까지 괜히 흔들림) 호버 시점에 실제
// scrollWidth/clientWidth 차이를 재서 그 값만큼만 CSS 변수로 넘겨줌
function handleMarqueeEnter(e) {
    const wrap = e.currentTarget
    const text = wrap.querySelector('.marquee-text')
    if (!text) return
    const overflow = text.scrollWidth - wrap.clientWidth
    if (overflow <= 0) return
    const duration = Math.min(12, Math.max(3, overflow / 40))
    text.style.setProperty('--marquee-distance', `${-overflow}px`)
    text.style.setProperty('--marquee-duration', `${duration}s`)
    text.classList.add('is-marquee')
}
function handleMarqueeLeave(e) {
    const text = e.currentTarget.querySelector('.marquee-text')
    if (!text) return
    text.classList.remove('is-marquee')
    text.style.removeProperty('--marquee-distance')
    text.style.removeProperty('--marquee-duration')
}

const quantities = reactive({})

// 개수 입력칸이 처음엔 비어 보이지 않게, 카탈로그가 들어오는 대로 각 아이템 기본 수량을 1로 채워둠
watch(catalogData, (list) => {
    for (const item of list ?? []) {
        if (quantities[item.id] === undefined) quantities[item.id] = 1
    }
}, { immediate: true })

function clampQty(item) {
    const n = Math.floor(Number(quantities[item.id]))
    quantities[item.id] = Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1
}
function stepQty(item, delta) {
    quantities[item.id] = Math.min(99, Math.max(1, (quantities[item.id] ?? 1) + delta))
}

const buyingId = ref(null)
const buyError = ref('')

async function buy(item) {
    if (!isLoggedIn.value || buyingId.value) return
    buyError.value = ''
    buyingId.value = item.id
    try {
        await $fetch(`${apiBaseUrl}/api/buyItem`, {
            method: 'POST',
            body: {
                userid: userId.value,
                serverid: server.id,
                itemid: item.id,
                quantity: isStackable(item) ? (quantities[item.id] || 1) : 1,
            },
        })
        await Promise.all([refreshCatalog(), refreshBalance()])
    } catch (err) {
        buyError.value = err?.data?.message ?? '구매에 실패했습니다'
    } finally {
        buyingId.value = null
    }
}
</script>

<style>
#shop-content {
    padding: 16px 24px 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.shop-balance {
    font-size: 0.82rem;
    color: #d99a00;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-right: 8px;
}

.shop-subtabs { border-bottom: none; margin-top: -4px; }

.shop-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    margin-top: 8px;
}

.shop-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 10px;
    border-radius: 12px;
    background: rgba(var(--fg-rgb),0.04);
    border: 1px solid rgba(var(--fg-rgb),0.06);
    text-align: center;
    transition: border-color 0.1s, background 0.1s;
}

/* 인벤토리에서 장착 가능한(아바타) 카드만 클릭해서 바로 장착 — 나머지(맵 아이템 등)는 그냥 진열용 */
.shop-card-clickable {
    cursor: pointer;
}
.shop-card-clickable:hover {
    background: rgba(var(--fg-rgb),0.08);
}
.shop-card-equipped {
    border-color: var(--accent);
    background: var(--bgaccent);
}
.shop-equipped-label {
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.shop-card-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: rgba(var(--fg-rgb),0.05);
    font-size: 1.4rem;
    color: rgba(var(--fg-rgb),0.3);
    overflow: hidden;
}
.shop-card-icon img { width: 100%; height: 100%; object-fit: contain; }

/* 이름/설명 둘 다 무조건 1줄 — 넘치는 텍스트는 잘라서 ...으로, 마우스를 올렸을 때만(JS가 실제로
   넘칠 때만 .is-marquee를 붙임) 노래 제목처럼 옆으로 흐름. width:100%가 있어야 overflow:hidden
   기준이 되는 실제 폭이 생김(안 그러면 콘텐츠 크기에 맞춰 늘어나서 절대 안 넘침) */
.shop-card-name {
    width: 100%;
    font-weight: 700;
    font-size: 0.88rem;
    white-space: nowrap;
    overflow: hidden;
}

.shop-card-desc {
    width: 100%;
    margin: 0;
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.45);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    /* 설명이 없어도(빈 문자열) 옆 카드랑 높이가 안 어긋나게 1줄 높이를 고정해둠 */
    min-height: 1.3em;
}

.shop-card-name .marquee-text,
.shop-card-desc .marquee-text {
    display: inline-block;
    white-space: nowrap;
}
.marquee-text.is-marquee {
    animation: shop-marquee-scroll var(--marquee-duration, 6s) linear infinite;
}
/* 시작/끝에서 살짝 멈췄다가 흐르고, 끝나면 다음 반복 시작점(0%)으로 바로 스냅 — 음원 사이트
   재생목록의 긴 제목이 흐르는 것과 같은 "쭉 흐르다 처음으로 되돌아가는" 루프 느낌 */
@keyframes shop-marquee-scroll {
    0%, 10% { transform: translateX(0); }
    90%, 100% { transform: translateX(var(--marquee-distance, 0px)); }
}

.shop-card-price {
    font-size: 0.8rem;
    color: #d99a00;
    display: flex;
    align-items: center;
    gap: 4px;
}

.shop-qty-stepper {
    width: 100%;
    display: flex;
    align-items: stretch;
    gap: 4px;
}

.shop-qty-btn {
    flex-shrink: 0;
    width: 24px;
    border-radius: 6px;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    background: rgba(var(--fg-rgb),0.05);
    color: rgba(var(--fg-rgb),0.7);
    font-size: 0.9rem;
    font-family: inherit;
    line-height: 1;
    cursor: pointer;
}
.shop-qty-btn:hover:not(:disabled) { background: rgba(var(--fg-rgb),0.12); }
.shop-qty-btn:disabled { opacity: 0.3; cursor: default; }

.shop-qty-input {
    width: 100%;
    min-width: 0;
    text-align: center;
    border-radius: 6px;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    background: var(--bg);
    color: inherit;
    padding: 4px;
    font-size: 0.82rem;
    /* 화살표 스테퍼를 직접 만들어서 붙였으니 브라우저 기본 스핀 버튼은 숨김 */
    -moz-appearance: textfield;
}
.shop-qty-input::-webkit-outer-spin-button,
.shop-qty-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.shop-buy-btn {
    width: 100%;
    background: var(--accent);
    color: rgba(var(--accent-fg-rgb),1);
    border: none;
    border-radius: 6px;
    padding: 6px 0;
    font-size: 0.82rem;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
}
.shop-buy-btn:disabled { opacity: 0.4; cursor: default; }

.shop-owned-count {
    width: 100%;
    text-align: center;
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.4);
}

.shop-owned-badge {
    width: 100%;
    text-align: center;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}
</style>
