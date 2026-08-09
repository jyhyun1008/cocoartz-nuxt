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
                    <div class="shop-card-name">{{ item.name }}</div>
                    <p v-if="item.description" class="shop-card-desc">{{ item.description }}</p>
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

// 재화 잔액 — ServerProfilebar.vue와 같은 키로 캐시를 공유해서, 여기서 구매하면 사이드바 잔액도 같이 갱신됨
const { data: balanceData, refresh: refreshBalance } = await useAsyncData(
    `balance-data-${server?.id}`,
    () => (isLoggedIn.value && server?.id)
        ? $fetch(`${apiBaseUrl}/api/getMyBalance`, { method: 'POST', body: { userid: userId.value, serverid: server.id } }).catch(() => ({ balance: 0 }))
        : { balance: 0 },
)
const balance = computed(() => balanceData.value?.balance ?? 0)

const { data: catalogData, refresh: refreshCatalog } = await useAsyncData(
    'shop-catalog',
    () => $fetch(`${apiBaseUrl}/api/getShopCatalog`, { method: 'POST', body: { userid: userId.value } }),
)
const catalog = computed(() => catalogData.value ?? [])

const visibleItems = computed(() => catalog.value.filter(i => i.category === subTab.value))

function isStackable(item) { return isStackableCategory(item.category) }

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

.shop-card-name { font-weight: 700; font-size: 0.88rem; }

.shop-card-desc {
    margin: 0;
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.45);
    line-height: 1.3;
    /* 설명이 길면 카드 높이가 아이템마다 들쭉날쭉해지니 2줄까지만 보여주고 나머진 ...으로 자름.
       min-height도 2줄 높이로 고정해서, 짧은 설명(1줄)인 카드도 옆 카드랑 높이가 안 어긋나게 함 */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: calc(1.3em * 2);
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
