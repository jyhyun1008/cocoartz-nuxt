<template>
    <div class="modal-base">
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-setting-07"></i>
            <span v-if="view === 'list'">서버 설정 / 채널 관리</span>
            <span v-else-if="view === 'create'">새 채널 만들기</span>
            <span v-else-if="view === 'edit'">채널 편집</span>
            <span v-else-if="view === 'map-edit' && defaultMapEdit">기본 개인 방 맵 편집</span>
            <span v-else-if="view === 'map-edit'">채널 맵 편집</span>
            <button v-if="view !== 'list'" class="back-btn-header" @click="view === 'map-edit' ? closeMapEdit() : (view = 'list')">← 뒤로</button>
            <button class="window-close-btn" @click="$emit('close')">✕</button>
        </div>

        <!-- 비로그인 -->
        <div v-if="!isLoggedIn" id="settings-content">
            <p class="info-placeholder">설정을 변경하려면 로그인이 필요합니다.</p>
        </div>

        <!-- 채널 목록 -->
        <div v-else-if="view === 'list'" id="settings-content">

            <div class="admin-tabs">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    class="admin-tab-btn"
                    :class="{ active: activeTab === tab.id }"
                    @click="activeTab = tab.id"
                >
                    <i :class="tab.icon"></i> {{ tab.label }}
                </button>
            </div>

            <!-- 서버 정보 섹션 -->
            <div v-if="activeTab === 'server'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">서버 정보</span>
                </div>

                <label class="admin-label">서버 이름</label>
                <input v-model="serverForm.title" placeholder="서버 이름" class="post-input" />

                <label class="admin-label">악센트 컬러</label>
                <div class="admin-color-row">
                    <input type="color" v-model="serverForm.themecolor" class="admin-color-input" />
                    <input v-model="serverForm.themecolor" placeholder="#D21F3C" class="post-input" style="flex:1" />
                </div>

                <label class="admin-label">재화 이름 <span class="admin-label-hint">맵 아이템에서 얻는 코인 등에 쓰임</span></label>
                <input v-model="serverForm.currencyName" placeholder="코코아" class="post-input" />

                <label class="admin-label">가입 보너스 <span class="admin-label-hint">신규 가입 시 자동 지급(0이면 지급 안 함)</span></label>
                <input v-model.number="serverForm.signupBonus" type="number" min="0" placeholder="100" class="post-input" />

                <label class="admin-label">서버 소개 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="serverForm.info" placeholder="서버 소개..." class="post-textarea" style="min-height:60px"></textarea>

                <label class="admin-label">서버 아이콘 <span class="admin-label-hint">선택</span></label>
                <div class="admin-icon-row">
                    <div class="admin-icon-preview">
                        <NuxtImg v-if="serverForm.avatar" :src="serverForm.avatar" class="admin-icon-preview-img" />
                        <i v-else class="hgi hgi-stroke hgi-image-02"></i>
                    </div>
                    <input v-model="serverForm.avatar" placeholder="https://example.com/icon.png" class="post-input" style="flex:1" />
                    <template v-if="objectStorageEnabled">
                        <input type="file" ref="serverIconFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleServerIconFile" />
                        <button class="admin-add-btn" style="margin-left:0" @click="serverIconFileInput?.click()" :disabled="serverIconUploading">
                            {{ serverIconUploading ? '업로드 중...' : '업로드' }}
                        </button>
                    </template>
                </div>

                <label class="admin-label">가입 방식</label>
                <select v-model="serverForm.registrationMode" class="admin-select">
                    <option value="open" :disabled="!mailReady">자유 가입{{ mailReady ? '' : ' (이메일 설정 필요)' }}</option>
                    <option value="approval" :disabled="!mailReady">승인제 가입{{ mailReady ? '' : ' (이메일 설정 필요)' }}</option>
                    <option value="closed">가입 차단</option>
                </select>
                <p v-if="!mailReady" class="admin-label-hint" style="margin:-4px 0 0">
                    가입을 받으려면 이메일 인증/비밀번호 재설정 메일을 보낼 수 있어야 해서, "이메일" 탭에서 SMTP 설정을 먼저 끝내야 해요.
                </p>

                <label class="admin-label">기본 개인 방 <span class="admin-label-hint">가입 직후(혹은 아직 방을 한 번도 안 꾸민 유저)에게 보이는 방 모습</span></label>
                <button class="admin-add-btn" style="margin-left:0;align-self:flex-start" @click="openDefaultMapEdit">
                    <i class="hgi hgi-stroke hgi-map-01"></i> 맵 편집
                </button>

                <p v-if="serverError" class="admin-error">{{ serverError }}</p>
                <button class="submit-btn" style="margin-top:8px;align-self:flex-start" @click="submitServerInfo" :disabled="serverSaving">
                    {{ serverSaving ? '저장 중...' : '서버 정보 저장' }}
                </button>
                <p v-if="serverSaveMsg" class="admin-save-msg">{{ serverSaveMsg }}</p>
            </div>

            <!-- 커스텀 이모지 관리 -->
            <div v-if="activeTab === 'emoji'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">커스텀 이모지 관리</span>
                </div>
                <p class="admin-label-hint" style="margin:-4px 0 10px">
                    게시판/채팅/위키 본문과 리액션에서 :샷코드: 로 쓸 수 있고, 연합 게시판에 올라간 글은 다른 서버에서도 이미지로 보여요.
                </p>

                <div class="admin-channel-list">
                    <div v-for="e in customEmojiList" :key="e.shortcode" class="admin-emoji-item">
                        <div class="admin-emoji-item-row">
                            <div class="admin-icon-preview" style="width:28px;height:28px">
                                <NuxtImg :src="e.imageUrl" class="admin-icon-preview-img" />
                            </div>
                            <span class="admin-ch-name">:{{ e.shortcode }}:</span>
                            <div class="admin-ch-actions">
                                <button
                                    v-if="emojiEditDraft[e.id] && isEmojiDirty(e)"
                                    class="admin-icon-btn"
                                    title="분류/태그 저장"
                                    :disabled="emojiSaving[e.id]"
                                    @click="saveCustomEmojiMeta(e)"
                                >
                                    <i class="hgi hgi-stroke hgi-tick-01"></i>
                                </button>
                                <button class="admin-icon-btn danger" @click="deleteCustomEmoji(e.id)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </div>
                        <div v-if="emojiEditDraft[e.id]" class="admin-emoji-meta-row">
                            <input
                                v-model="emojiEditDraft[e.id].category"
                                list="admin-emoji-category-options"
                                placeholder="카테고리 (선택, 예: 반응)"
                                class="post-input"
                                style="flex:1"
                            />
                            <input
                                v-model="emojiEditDraft[e.id].tags"
                                placeholder="검색 태그 (공백으로 구분, 예: 축하 파티)"
                                class="post-input"
                                style="flex:1.4"
                            />
                        </div>
                    </div>
                    <div v-if="!customEmojiList.length" class="empty" style="padding:14px 0">등록된 커스텀 이모지가 없습니다.</div>
                </div>
                <datalist id="admin-emoji-category-options">
                    <option v-for="c in customEmojiCategories" :key="c" :value="c" />
                </datalist>

                <template v-if="objectStorageEnabled">
                    <label class="admin-label">새 이모지 추가</label>
                    <div class="admin-icon-row">
                        <input v-model="newEmojiShortcode" placeholder="샷코드 (영문 소문자/숫자/밑줄, 콜론 없이)" class="post-input" style="flex:1" />
                    </div>
                    <div class="admin-icon-row">
                        <input v-model="newEmojiCategory" list="admin-emoji-category-options" placeholder="카테고리 (선택)" class="post-input" style="flex:1" />
                        <input v-model="newEmojiTags" placeholder="검색 태그 (선택, 공백으로 구분)" class="post-input" style="flex:1.4" />
                    </div>
                    <div class="admin-icon-row">
                        <input type="file" ref="emojiFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleCustomEmojiFile" />
                        <button class="admin-add-btn" style="margin-left:0" @click="emojiFileInput?.click()" :disabled="customEmojiUploading || !newEmojiShortcode.trim()">
                            {{ customEmojiUploading ? '업로드 중...' : '업로드' }}
                        </button>
                    </div>
                </template>
                <p v-else class="admin-label-hint">오브젝트 스토리지가 설정되지 않아 이모지를 업로드할 수 없어요.</p>
                <p v-if="customEmojiError" class="admin-error">{{ customEmojiError }}</p>
            </div>

            <!-- 승인 대기 중인 가입 신청 -->
            <div v-if="activeTab === 'pending'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">가입 승인 대기</span>
                </div>
                <div class="admin-channel-list">
                    <div v-for="p in pendingUsers" :key="p.id" class="admin-channel-item">
                        <div class="admin-icon-preview" style="width:28px;height:28px;border-radius:50%">
                            <NuxtImg v-if="p.avatar" :src="p.avatar" class="admin-icon-preview-img" />
                            <i v-else class="hgi hgi-stroke hgi-user"></i>
                        </div>
                        <span class="admin-ch-name">{{ p.knownas || p.username }}</span>
                        <code class="admin-ch-path">{{ p.email }}</code>
                        <div class="admin-ch-actions">
                            <button class="admin-icon-btn" @click="approveUser(p.id)" title="승인">
                                <i class="hgi hgi-stroke hgi-tick-01"></i>
                            </button>
                            <button class="admin-icon-btn danger" @click="rejectUser(p.id)" title="거절">
                                <i class="hgi hgi-stroke hgi-delete-02"></i>
                            </button>
                        </div>
                    </div>
                    <div v-if="!pendingUsers.length" class="empty" style="padding:14px 0">승인 대기 중인 가입 신청이 없습니다.</div>
                </div>
                <p v-if="pendingError" class="admin-error">{{ pendingError }}</p>
            </div>

            <!-- 멤버 관리: 재화 지급 / 정지 / 영구정지 -->
            <div v-if="activeTab === 'members'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">멤버 관리</span>
                </div>
                <input v-model="memberSearch" placeholder="이름/아이디로 검색" class="post-input" style="margin-bottom:10px" />
                <div class="admin-channel-list">
                    <template v-for="m in filteredMembers" :key="m.id">
                        <div class="admin-channel-item">
                            <div class="admin-icon-preview" style="width:28px;height:28px;border-radius:50%">
                                <NuxtImg v-if="m.avatar" :src="m.avatar" class="admin-icon-preview-img" />
                                <i v-else class="hgi hgi-stroke hgi-user"></i>
                            </div>
                            <span class="admin-ch-name">{{ m.knownas || m.username }}</span>
                            <code class="admin-ch-path">@{{ m.username }}</code>
                            <span v-if="memberStatusLabel(m)" class="admin-ch-type-badge admin-ch-federated-badge">{{ memberStatusLabel(m) }}</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="toggleMemberPanel(m.id)" title="관리">
                                    <i class="hgi hgi-stroke hgi-user-edit-01"></i>
                                </button>
                            </div>
                        </div>

                        <div v-if="expandedMemberId === m.id" class="member-action-panel">
                            <div class="member-action-row">
                                <label class="admin-label" style="margin:0">재화 지급</label>
                                <input v-model.number="grantAmountDraft" type="number" placeholder="예: 50 (마이너스면 차감)" class="post-input" style="max-width:180px" />
                                <button class="admin-add-btn" style="margin-left:0" :disabled="!grantAmountDraft" @click="doGrantCurrency(m.id)">지급</button>
                            </div>
                            <p v-if="grantMsg[m.id]" class="admin-save-msg" style="margin:2px 0 0">{{ grantMsg[m.id] }}</p>

                            <div class="member-action-row" style="margin-top:10px">
                                <template v-if="m.bannedAt">
                                    <span class="admin-error" style="margin:0">영구정지됨<template v-if="m.banReason"> · {{ m.banReason }}</template></span>
                                    <button class="admin-add-btn" style="margin-left:auto" @click="doUnban(m.id)">영구정지 해제</button>
                                </template>
                                <template v-else-if="isSuspended(m)">
                                    <span class="admin-error" style="margin:0">{{ formatSuspendUntil(m.suspendedUntil) }}까지 정지<template v-if="m.suspendReason"> · {{ m.suspendReason }}</template></span>
                                    <button class="admin-add-btn" style="margin-left:auto" @click="doUnsuspend(m.id)">정지 해제</button>
                                </template>
                                <template v-else>
                                    <select v-model="suspendDurationDraft[m.id]" class="admin-select" style="max-width:120px">
                                        <option value="3600000">1시간</option>
                                        <option value="86400000">1일</option>
                                        <option value="259200000">3일</option>
                                        <option value="604800000">7일</option>
                                    </select>
                                    <input v-model="suspendReasonDraft[m.id]" placeholder="사유(선택)" class="post-input" style="flex:1;min-width:80px" />
                                    <button class="admin-add-btn" style="margin-left:0" @click="doSuspend(m.id)">정지</button>
                                    <button class="admin-add-btn danger-btn" style="margin-left:0" @click="banTarget = m">영구정지</button>
                                </template>
                            </div>
                        </div>
                    </template>
                    <div v-if="!filteredMembers.length" class="empty" style="padding:20px 0">멤버가 없습니다.</div>
                </div>
                <p v-if="memberActionError" class="admin-error">{{ memberActionError }}</p>
            </div>

            <!-- 기본 페이지(마을 / 공지 게시판) 맵 편집 -->
            <div v-if="activeTab === 'pinned'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">기본 페이지</span>
                </div>
                <p class="admin-label-hint" style="margin:-4px 0 10px">
                    사이드바의 "마을"·"공지 게시판"은 고정 링크라 채널 목록에 만들 필요 없이 여기서 이름과 맵을 바로 편집할 수 있어요.
                </p>
                <div v-for="pinned in PINNED_PAGES" :key="pinned.path" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
                    <input
                        v-model="pinnedNameDraft[pinned.path]"
                        :placeholder="pinned.knownas"
                        class="post-input"
                        style="flex:1;min-width:120px"
                    />
                    <button
                        class="admin-add-btn"
                        style="margin-left:0"
                        :disabled="pinnedSaving === pinned.path || !pinnedNameDraft[pinned.path]?.trim()"
                        @click="savePinnedName(pinned)"
                    >
                        {{ pinnedSaving === pinned.path ? '저장 중...' : '이름 저장' }}
                    </button>
                    <button
                        class="admin-add-btn"
                        style="margin-left:0"
                        :disabled="pinnedLoading === pinned.path"
                        @click="openPinnedMapEdit(pinned)"
                    >
                        <i class="hgi hgi-stroke hgi-map-01"></i>
                        {{ pinnedLoading === pinned.path ? '불러오는 중...' : '맵 편집' }}
                    </button>
                </div>
                <p v-if="pinnedError" class="admin-error">{{ pinnedError }}</p>
            </div>

            <!-- 채널 목록 섹션 -->
            <div v-if="activeTab === 'channels'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">채널 목록</span>
                    <button class="admin-add-btn" @click="openCreate">
                        <i class="hgi hgi-stroke hgi-add-01"></i> 새 채널
                    </button>
                </div>

                <div class="admin-channel-list">
                    <div
                        v-for="(entry, i) in orderedList"
                        :key="entryKey(entry, i)"
                        class="admin-channel-item"
                        :class="{ 'is-title': isTitleEntry(entry) }"
                    >
                        <!-- 섹션 타이틀 구분자 -->
                        <template v-if="isTitleEntry(entry)">
                            <i class="hgi hgi-stroke hgi-text-font admin-ch-icon" style="opacity:0.4"></i>
                            <span class="admin-ch-name title-entry">{{ entry.knownas }}</span>
                            <span class="admin-ch-type-badge">제목</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="moveUp(i)" :disabled="i === 0" title="위로">↑</button>
                                <button class="admin-icon-btn" @click="moveDown(i)" :disabled="i === orderedList.length - 1" title="아래로">↓</button>
                                <button class="admin-icon-btn danger" @click="removeTitleEntry(i)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </template>

                        <!-- 실제 채널 -->
                        <template v-else>
                            <i :class="channelIcon(entry.type)" class="admin-ch-icon"></i>
                            <span class="admin-ch-name">{{ entry.knownas }}</span>
                            <code class="admin-ch-path">{{ entry.path }}</code>
                            <span class="admin-ch-type-badge">{{ typeLabel(entry.type) }}</span>
                            <span v-if="entry.federated" class="admin-ch-type-badge admin-ch-federated-badge"><i class="hgi hgi-stroke hgi-globe-02"></i> 연합</span>
                            <span v-if="entry.galleryView" class="admin-ch-type-badge"><i class="hgi hgi-stroke hgi-grid"></i> 갤러리</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="moveUp(i)" :disabled="i === 0" title="위로">↑</button>
                                <button class="admin-icon-btn" @click="moveDown(i)" :disabled="i === orderedList.length - 1" title="아래로">↓</button>
                                <button class="admin-icon-btn" @click="openEdit(entry)" title="편집">
                                    <i class="hgi hgi-stroke hgi-edit-02"></i>
                                </button>
                                <button class="admin-icon-btn danger" @click="confirmDelete(entry)" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </template>
                    </div>

                    <div v-if="!orderedList.length" class="empty" style="padding:20px 0">
                        채널이 없습니다. 새 채널을 만들어 보세요.
                    </div>
                </div>

                <!-- 제목 구분자 추가 -->
                <div class="admin-title-add">
                    <input v-model="newTitleName" placeholder="섹션 제목 입력" class="post-input" style="flex:1" />
                    <button class="admin-add-btn" @click="addTitleEntry" :disabled="!newTitleName.trim()">
                        제목 추가
                    </button>
                </div>

                <!-- 순서 저장 -->
                <button class="submit-btn" style="margin-top:12px;align-self:flex-start" @click="saveOrder" :disabled="saving">
                    {{ saving ? '저장 중...' : '순서 저장' }}
                </button>
                <p v-if="saveMsg" class="admin-save-msg">{{ saveMsg }}</p>
            </div>

            <!-- 이메일 설정 -->
            <div v-if="activeTab === 'email'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">이메일 설정</span>
                </div>
                <p class="admin-label-hint" style="margin:-4px 0 10px">
                    가입 승인제일 때 새 가입 신청은 관리자에게, 승인 처리는 신청자 본인에게 메일로 알려드려요.
                </p>

                <label class="admin-label">SMTP 호스트</label>
                <input v-model="emailForm.smtpHost" placeholder="smtp.example.com" class="post-input" />

                <label class="admin-label">포트 / 보안 연결</label>
                <div class="admin-color-row">
                    <input v-model.number="emailForm.smtpPort" type="number" placeholder="587" class="post-input" style="max-width:120px" />
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                        <input type="checkbox" v-model="emailForm.smtpSecure" /> TLS(465) 사용
                    </label>
                </div>

                <label class="admin-label">계정</label>
                <input v-model="emailForm.smtpUser" placeholder="user@example.com" class="post-input" />

                <label class="admin-label">비밀번호 <span class="admin-label-hint">{{ emailSmtpPasswordSet ? '설정됨 — 바꾸려면 새로 입력' : '미설정' }}</span></label>
                <input v-model="emailForm.smtpPassword" type="password" :placeholder="emailSmtpPasswordSet ? '변경하지 않으려면 비워두세요' : ''" class="post-input" />

                <label class="admin-label">발신 이름 <span class="admin-label-hint">선택</span></label>
                <input v-model="emailForm.fromName" placeholder="코코아츠" class="post-input" />

                <label class="admin-label">발신 주소 <span class="admin-label-hint">선택, 비우면 계정으로</span></label>
                <input v-model="emailForm.fromAddress" placeholder="no-reply@example.com" class="post-input" />

                <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;margin-top:4px">
                    <input type="checkbox" v-model="emailForm.enabled" /> 이메일 발송 사용
                </label>

                <p v-if="emailError" class="admin-error">{{ emailError }}</p>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
                    <button class="submit-btn" @click="submitEmailSettings" :disabled="emailSaving">
                        {{ emailSaving ? '저장 중...' : '저장' }}
                    </button>
                    <button class="admin-add-btn" style="margin-left:0" @click="sendTestEmail" :disabled="emailTesting">
                        {{ emailTesting ? '보내는 중...' : '테스트 메일 보내기' }}
                    </button>
                </div>
                <p v-if="emailSaveMsg" class="admin-save-msg">{{ emailSaveMsg }}</p>
                <p v-if="emailTestMsg" class="admin-label-hint">{{ emailTestMsg }}</p>
            </div>

            <!-- 상점 아이템 관리 -->
            <div v-if="activeTab === 'shop'" class="admin-section">
                <div class="admin-section-header">
                    <span class="admin-section-title">상점 아이템 관리</span>
                </div>
                <p class="admin-label-hint" style="margin:-4px 0 10px">
                    등록/수정해도 이미 산 사람의 인벤토리나 맵에 놓인 아이템엔 영향 없어요. category·itemKey는 한번 등록하면 못 바꿔요(다른 값으로 옮기려면 새로 등록).
                </p>

                <div class="admin-tabs shop-subtabs">
                    <button class="admin-tab-btn" :class="{ active: shopCategoryFilter === 'all' }" @click="shopCategoryFilter = 'all'">전체</button>
                    <button
                        v-for="c in ALL_SHOP_CATEGORIES" :key="c.id" class="admin-tab-btn"
                        :class="{ active: shopCategoryFilter === c.id }" @click="shopCategoryFilter = c.id"
                    >{{ c.label }}</button>
                </div>

                <!-- 인라인 수정 폼에서 쓰는 숨김 파일 입력 — 한 번에 하나의 아이템만 수정 상태(editingShopItemId)일
                     수 있으니 v-for 루프 안에 아이템마다 두지 않고 여기 하나씩만 둠(v-for 안에서 ref="문자열"을
                     쓰면 Vue가 자동으로 배열로 묶어버려서 예전엔 함수 ref로 우회했었는데, 그 방식이 avatar-part
                     쪽 "다시 올리기" 버튼에서 클릭이 씹히는 문제가 있어서 아예 루프 밖으로 뺌) -->
                <input type="file" ref="shopEditIconFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleShopEditIconFile" />

                <div class="admin-channel-list">
                    <template v-for="item in filteredShopItems" :key="item.id">
                        <div class="admin-channel-item">
                            <div class="admin-icon-preview" style="width:28px;height:28px">
                                <AvatarPartIcon v-if="avatarPartFromCategory(item.category)" :part="avatarPartFromCategory(item.category)" :variant="item.itemKey" :size="28" />
                                <NuxtImg v-else-if="item.icon" :src="item.icon" class="admin-icon-preview-img" />
                                <i v-else class="hgi hgi-stroke hgi-package"></i>
                            </div>
                            <span class="admin-ch-name">{{ item.name }}</span>
                            <code class="admin-ch-path">{{ shopCategoryLabel(item.category) }} · {{ item.itemKey }} · {{ item.price }}{{ serverForm.currencyName || '코코아' }}</code>
                            <span v-if="item.isDefault" class="admin-ch-type-badge admin-ch-federated-badge">가입 시 기본 지급</span>
                            <span v-if="item.category === 'terrain' && item.blocksMovement" class="admin-ch-type-badge">막힘</span>
                            <span class="admin-ch-type-badge" :class="{ 'admin-ch-federated-badge': item.active }">{{ item.active ? '판매중' : '비활성' }}</span>
                            <div class="admin-ch-actions">
                                <button class="admin-icon-btn" @click="toggleEditShopItem(item)" title="수정">
                                    <i class="hgi hgi-stroke hgi-pencil-edit-01"></i>
                                </button>
                                <button class="admin-icon-btn danger" @click="shopDeleteTarget = item" title="삭제">
                                    <i class="hgi hgi-stroke hgi-delete-02"></i>
                                </button>
                            </div>
                        </div>

                        <!-- 인라인 수정 폼 -->
                        <div v-if="editingShopItemId === item.id" class="create-form shop-inline-edit">
                            <input v-model="shopEditForm.name" placeholder="이름" class="post-input" />
                            <textarea v-model="shopEditForm.description" placeholder="설명(선택)" class="post-textarea" style="min-height:50px"></textarea>
                            <div class="admin-color-row">
                                <input v-model.number="shopEditForm.price" type="number" min="0" class="post-input" style="max-width:120px" />
                                <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                                    <input type="checkbox" v-model="shopEditForm.active" /> 판매중
                                </label>
                                <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                                    <input type="checkbox" v-model="shopEditForm.isDefault" /> 가입 시 기본 지급
                                </label>
                                <label v-if="item.category === 'terrain'" style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                                    <input type="checkbox" v-model="shopEditForm.blocksMovement" /> 캐릭터 통과 불가(막힘)
                                </label>
                                <template v-if="item.category === 'avatar_deco'">
                                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                                        <input type="radio" value="back" v-model="shopEditForm.decoLayer" /> 몸 뒤 레이어
                                    </label>
                                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                                        <input type="radio" value="front" v-model="shopEditForm.decoLayer" /> 몸 앞 레이어
                                    </label>
                                </template>
                            </div>

                            <template v-if="avatarPartFromCategory(item.category)">
                                <label class="admin-label">파츠 이미지 <span class="admin-label-hint">itemKey(파츠 variant 번호)는 등록 후 못 바꿔요 — 이미지만 다시 올릴 수 있어요</span></label>
                                <p v-if="item.category === 'avatar_deco'" class="admin-label-hint" style="margin:-4px 0 6px">
                                    데코는 다른 파츠(768×1024)보다 세로로 100px 더 큰 <b>768×1424</b> 스프라이트시트예요(3열×4행, 셀 256×356 —
                                    각 행 맨 위 100px이 머리 위 여유 공간). <NuxtLink to="/character/deco-guide.png" target="_blank" style="color:var(--accent)">가이드 이미지</NuxtLink>를
                                    참고해서 그 여백에 맞춰 그려주세요.
                                </p>
                                <div class="admin-icon-row">
                                    <AvatarPartIcon
                                        :part="avatarPartFromCategory(item.category)" :variant="item.itemKey" :size="56"
                                        :src-override="shopEditForm.icon"
                                    />
                                    <template v-if="objectStorageEnabled">
                                        <button class="admin-add-btn" style="margin-left:0" @click="shopEditIconFileInput?.click()" :disabled="shopEditIconUploading">
                                            {{ shopEditIconUploading ? '업로드 중...' : '다시 올리기' }}
                                        </button>
                                    </template>
                                    <span v-else class="admin-label-hint">오브젝트 스토리지 미설정 — 이미지를 못 바꿔요.</span>
                                </div>
                            </template>
                            <template v-else-if="item.category !== 'map_item' && !isCropItem(item)">
                                <label class="admin-label">아이콘 <span class="admin-label-hint">선택</span></label>
                                <div class="admin-icon-row">
                                    <div class="admin-icon-preview">
                                        <NuxtImg v-if="shopEditForm.icon" :src="shopEditForm.icon" class="admin-icon-preview-img" />
                                        <i v-else class="hgi hgi-stroke hgi-image-02"></i>
                                    </div>
                                    <input v-model="shopEditForm.icon" placeholder="https://example.com/icon.png" class="post-input" style="flex:1" />
                                    <template v-if="objectStorageEnabled">
                                        <button class="admin-add-btn" style="margin-left:0" @click="shopEditIconFileInput?.click()" :disabled="shopEditIconUploading">
                                            {{ shopEditIconUploading ? '업로드 중...' : '업로드' }}
                                        </button>
                                    </template>
                                </div>
                            </template>
                            <template v-else-if="isLegacyMapItem(item)">
                                <label class="admin-label">레이어 6장</label>
                                <p class="admin-label-hint">
                                    코드에 내장된 레거시 아이템(itemKey={{ item.itemKey }})과 연결된 상점 등록이라 레이어는 못 바꿔요 —
                                    이름/가격/설명/판매여부만 수정 가능해요. 이 아이템 자체를 새 그림으로 바꾸고 싶으면
                                    삭제하지 말고 아래 "새 아이템 추가"로 따로 등록해주세요(itemKey가 겹치면 코드에 내장된
                                    그림과 충돌해서 화면이 꼬여요).
                                </p>
                            </template>
                            <template v-else>
                                <label class="admin-label">레이어 6장 <span class="admin-label-hint">바꿀 칸만 눌러서 새로 올리면 돼요 — 안 누른 칸은 그대로 유지돼요</span></label>
                                <template v-if="objectStorageEnabled">
                                    <ShopLayerSlots
                                        v-model="shopEditForm.layers"
                                        :existing-layers="cropMetaOf(item)?.layers ?? []"
                                        @error="e => shopEditError = e"
                                    />
                                </template>
                                <p v-else class="admin-label-hint">오브젝트 스토리지 미설정 — 레이어를 못 바꿔요.</p>
                                <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;margin:4px 0">
                                    <input type="checkbox" v-model="shopEditForm.behindAvatar" /> 바닥에 까는 아이템(캐릭터보다 항상 뒤에 표시)
                                </label>
                                <template v-if="isCropItem(item)">
                                    <label class="admin-label">성장 시간(초) <span class="admin-label-hint">심은 뒤 다 자랄 때까지 — 예: 3600 = 1시간</span></label>
                                    <input v-model.number="shopEditForm.growSeconds" type="number" min="1" class="post-input" style="max-width:140px" />
                                    <label class="admin-label">수확 보상(재화) <span class="admin-label-hint">이 범위에서 랜덤 지급</span></label>
                                    <div class="admin-color-row">
                                        <input v-model.number="shopEditForm.rewardMin" type="number" min="0" class="post-input" style="max-width:100px" placeholder="최소" />
                                        <span>~</span>
                                        <input v-model.number="shopEditForm.rewardMax" type="number" min="0" class="post-input" style="max-width:100px" placeholder="최대" />
                                    </div>
                                </template>
                            </template>

                            <p v-if="shopEditError" class="admin-error">{{ shopEditError }}</p>
                            <div style="display:flex;gap:8px">
                                <button class="submit-btn" @click="submitEditShopItem(item)" :disabled="shopEditSaving">
                                    {{ shopEditSaving ? '저장 중...' : '저장' }}
                                </button>
                                <button class="admin-add-btn" style="margin-left:0" @click="editingShopItemId = null">취소</button>
                            </div>
                        </div>
                    </template>
                    <div v-if="!filteredShopItems.length" class="empty" style="padding:14px 0">등록된 아이템이 없습니다.</div>
                </div>

                <!-- 새 아이템 추가 -->
                <label class="admin-label" style="margin-top:16px">새 아이템 추가</label>
                <select v-model="newShopItem.category" class="admin-select">
                    <option value="" disabled>카테고리 선택</option>
                    <optgroup label="아바타">
                        <option v-for="c in shopAvatarCategories" :key="c.id" :value="c.id">{{ c.label }}</option>
                    </optgroup>
                    <optgroup label="아이템">
                        <option v-for="c in shopItemCategories" :key="c.id" :value="c.id">{{ c.label }}</option>
                    </optgroup>
                </select>

                <label v-if="newShopItem.category === 'functional'" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;margin:4px 0">
                    <input type="checkbox" v-model="newShopItem.isCrop" /> 맵에 심는 작물로 만들기
                    <span class="admin-label-hint">(농사 시스템 — 프로필 개인 홈 맵에 심어서 시간이 지나면 다 자라고, 밟으면 수확)</span>
                </label>

                <label class="admin-label">이름</label>
                <input v-model="newShopItem.name" placeholder="상점에 보일 이름" class="post-input" />
                <label class="admin-label">설명 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="newShopItem.description" placeholder="설명..." class="post-textarea" style="min-height:50px"></textarea>

                <label class="admin-label">가격</label>
                <div class="admin-color-row">
                    <input v-model.number="newShopItem.price" type="number" min="0" class="post-input" style="max-width:120px" />
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                        <input type="checkbox" v-model="newShopItem.active" /> 등록하자마자 판매
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                        <input type="checkbox" v-model="newShopItem.isDefault" /> 가입 시 기본 지급
                    </label>
                    <label v-if="newShopItem.category === 'terrain'" style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                        <input type="checkbox" v-model="newShopItem.blocksMovement" /> 캐릭터 통과 불가(막힘)
                    </label>
                    <template v-if="newShopItem.category === 'avatar_deco'">
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                            <input type="radio" value="back" v-model="newShopItem.decoLayer" /> 몸 뒤 레이어
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
                            <input type="radio" value="front" v-model="newShopItem.decoLayer" /> 몸 앞 레이어
                        </label>
                    </template>
                </div>
                <p v-if="newShopItem.isDefault" class="admin-label-hint">앞으로 가입하는 유저에게 자동으로 인벤토리로 지급돼요. 기존 유저한테도 주려면 저장 후 <code>npm run db:seed-shop-items</code>를 다시 돌리세요.</p>

                <template v-if="avatarPartFromCategory(newShopItem.category)">
                    <label v-if="newShopItem.category === 'avatar_deco'" class="admin-label">
                        파츠 이미지 <span class="admin-label-hint">768×1424, 3열×4행 프레임시트(셀 256×356 — 다른 파츠보다 세로로 100px 큼, 각 행 맨 위 100px이 머리 위 여유 공간).
                        <NuxtLink to="/character/deco-guide.png" target="_blank" style="color:var(--accent)">가이드 이미지</NuxtLink> 참고</span>
                    </label>
                    <label v-else class="admin-label">파츠 이미지 <span class="admin-label-hint">768×1024, 정면·측면·후면 3열×4행 프레임시트(캐릭터 시트와 같은 형식)</span></label>
                    <div class="admin-icon-row">
                        <div class="admin-icon-preview">
                            <NuxtImg v-if="newShopItem.icon" :src="newShopItem.icon" class="admin-icon-preview-img" />
                            <i v-else class="hgi hgi-stroke hgi-image-02"></i>
                        </div>
                        <template v-if="objectStorageEnabled">
                            <input type="file" ref="newShopIconFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleNewShopIconFile" />
                            <button class="admin-add-btn" style="margin-left:0" @click="newShopIconFileInput?.click()" :disabled="newShopIconUploading">
                                {{ newShopIconUploading ? '업로드 중...' : (newShopItem.icon ? '다시 선택' : '업로드') }}
                            </button>
                            <span v-if="!newShopItem.icon" class="admin-label-hint">업로드 안 하면, 저장 후 발급되는 itemKey에 맞춰 /character/{{ avatarPartFromCategory(newShopItem.category) }}/{itemKey}.png 경로에 파일을 배포해뒀을 때만 그 그림을 씀</span>
                        </template>
                        <template v-else>
                            <input v-model="newShopItem.icon" placeholder="https://example.com/icon.png" class="post-input" style="flex:1" />
                            <span class="admin-label-hint">오브젝트 스토리지 미설정 — URL을 직접 입력하거나, 비워두고 저장 후 발급되는 itemKey에 맞춰 /character/{{ avatarPartFromCategory(newShopItem.category) }}/{itemKey}.png 경로에 파일을 배포하세요</span>
                        </template>
                    </div>
                </template>
                <template v-else-if="newShopItem.category && !newItemNeedsLayers">
                    <label class="admin-label">아이콘 <span class="admin-label-hint">선택</span></label>
                    <div class="admin-icon-row">
                        <div class="admin-icon-preview">
                            <NuxtImg v-if="newShopItem.icon" :src="newShopItem.icon" class="admin-icon-preview-img" />
                            <i v-else class="hgi hgi-stroke hgi-image-02"></i>
                        </div>
                        <input v-model="newShopItem.icon" placeholder="https://example.com/icon.png" class="post-input" style="flex:1" />
                        <template v-if="objectStorageEnabled">
                            <input type="file" ref="newShopIconFileInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="handleNewShopIconFile" />
                            <button class="admin-add-btn" style="margin-left:0" @click="newShopIconFileInput?.click()" :disabled="newShopIconUploading">
                                {{ newShopIconUploading ? '업로드 중...' : '업로드' }}
                            </button>
                        </template>
                    </div>
                </template>

                <template v-if="newItemNeedsLayers">
                    <label class="admin-label">레이어 이미지 6장 <span class="admin-label-hint">1번 칸이 맨 위(가장 도드라짐), 6번 칸이 맨 아래(바닥/발밑) — 칸을 하나씩 눌러서 채워요. 저장하면 실제로 맵에 놓였을 때처럼 겹친 아이콘을 서버가 자동으로 만들어요</span></label>
                    <template v-if="objectStorageEnabled">
                        <ShopLayerSlots v-model="newShopItem.layers" @error="e => newShopItemError = e" />
                    </template>
                    <p v-else class="admin-label-hint">오브젝트 스토리지가 설정되지 않아 이 아이템을 등록할 수 없어요.</p>

                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;margin:4px 0">
                        <input type="checkbox" v-model="newShopItem.behindAvatar" /> 바닥에 까는 아이템(캐릭터보다 항상 뒤에 표시)
                    </label>

                    <template v-if="isNewCrop">
                        <label class="admin-label">성장 시간(초) <span class="admin-label-hint">심은 뒤 다 자랄 때까지 — 예: 3600 = 1시간</span></label>
                        <input v-model.number="newShopItem.growSeconds" type="number" min="1" class="post-input" style="max-width:140px" />
                        <label class="admin-label">수확 보상(재화) <span class="admin-label-hint">이 범위에서 랜덤 지급</span></label>
                        <div class="admin-color-row">
                            <input v-model.number="newShopItem.rewardMin" type="number" min="0" class="post-input" style="max-width:100px" placeholder="최소" />
                            <span>~</span>
                            <input v-model.number="newShopItem.rewardMax" type="number" min="0" class="post-input" style="max-width:100px" placeholder="최대" />
                        </div>
                    </template>
                </template>

                <p v-if="newShopItemError" class="admin-error">{{ newShopItemError }}</p>
                <button class="submit-btn" style="margin-top:8px;align-self:flex-start" @click="submitNewShopItem" :disabled="newShopItemSaving">
                    {{ newShopItemSaving ? '등록 중...' : '아이템 등록' }}
                </button>
            </div>
        </div>

        <!-- 새 채널 만들기 -->
        <div v-else-if="view === 'create'" id="settings-content">
            <div class="create-form">
                <label class="admin-label">채널 이름</label>
                <input v-model="form.knownas" placeholder="예: 자유 게시판" class="post-input" />

                <label class="admin-label">URL 경로 <span class="admin-label-hint">슬래시 포함, 예: /free</span></label>
                <input v-model="form.path" placeholder="/channel-path" class="post-input" />

                <label class="admin-label">채널 유형</label>
                <select v-model="form.type" class="admin-select">
                    <option value="room">💬 채팅방 (room)</option>
                    <option value="board">📋 게시판 (board)</option>
                    <option value="voice">🔊 음성채팅방 (voice)</option>
                    <option value="wiki">📖 위키 (wiki)</option>
                </select>

                <label class="admin-label">채널 소개 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="form.info" placeholder="채널 설명..." class="post-textarea" style="min-height:70px"></textarea>

                <label v-if="form.type === 'board'" class="admin-checkbox-row">
                    <input type="checkbox" v-model="federatedChecked" />
                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                    <span>연합 게시판으로 지정</span>
                    <span class="admin-label-hint">— 서버당 1개만 지정 가능하며, 이 게시판에 작성된 글만 fediverse로 연합됩니다. 다른 연합 게시판이 있다면 자동 해제됩니다.</span>
                </label>
                <label v-if="form.type === 'board' && !federatedChecked" class="admin-checkbox-row">
                    <input type="checkbox" v-model="form.galleryView" />
                    <i class="hgi hgi-stroke hgi-grid"></i>
                    <span>갤러리 보기로 표시</span>
                    <span class="admin-label-hint">— 글 목록을 2단 그리드 카드로 보여줍니다(정사각형 썸네일 + 제목/작성자/작성시각). 연합 게시판은 지원하지 않아요.</span>
                </label>

                <p v-if="formError" class="admin-error">{{ formError }}</p>
                <button class="submit-btn" style="align-self:flex-start" @click="submitCreate" :disabled="!form.knownas.trim() || !form.path.trim() || saving">
                    {{ saving ? '생성 중...' : '채널 생성' }}
                </button>
            </div>
        </div>

        <!-- 채널 편집 -->
        <div v-else-if="view === 'edit' && editTarget" id="settings-content">
            <div class="create-form">
                <label class="admin-label">채널 이름</label>
                <input v-model="form.knownas" placeholder="채널 이름" class="post-input" />

                <label class="admin-label">URL 경로 <span class="admin-label-hint">슬래시 포함, 예: /free</span></label>
                <input v-model="form.path" placeholder="/channel-path" class="post-input" />

                <label class="admin-label">채널 유형</label>
                <select v-model="form.type" class="admin-select">
                    <option value="room">💬 채팅방 (room)</option>
                    <option value="board">📋 게시판 (board)</option>
                    <option value="voice">🔊 음성채팅방 (voice)</option>
                    <option value="wiki">📖 위키 (wiki)</option>
                </select>

                <label class="admin-label">채널 소개 <span class="admin-label-hint">선택</span></label>
                <textarea v-model="form.info" placeholder="채널 설명..." class="post-textarea" style="min-height:70px"></textarea>

                <label v-if="form.type === 'board'" class="admin-checkbox-row">
                    <input type="checkbox" v-model="federatedChecked" />
                    <i class="hgi hgi-stroke hgi-globe-02"></i>
                    <span>연합 게시판으로 지정</span>
                    <span class="admin-label-hint">— 서버당 1개만 지정 가능하며, 이 게시판에 작성된 글만 fediverse로 연합됩니다. 다른 연합 게시판이 있다면 자동 해제됩니다.</span>
                </label>
                <label v-if="form.type === 'board' && !federatedChecked" class="admin-checkbox-row">
                    <input type="checkbox" v-model="form.galleryView" />
                    <i class="hgi hgi-stroke hgi-grid"></i>
                    <span>갤러리 보기로 표시</span>
                    <span class="admin-label-hint">— 글 목록을 2단 그리드 카드로 보여줍니다(정사각형 썸네일 + 제목/작성자/작성시각). 연합 게시판은 지원하지 않아요.</span>
                </label>

                <p v-if="formError" class="admin-error">{{ formError }}</p>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <button class="submit-btn" style="align-self:flex-start" @click="submitEdit" :disabled="!form.knownas.trim() || !form.path.trim() || saving">
                        {{ saving ? '저장 중...' : '변경사항 저장' }}
                    </button>
                    <button class="admin-add-btn" style="margin-left:0" @click="view = 'map-edit'">
                        <i class="hgi hgi-stroke hgi-map-01"></i> 맵 편집
                    </button>
                </div>
            </div>
        </div>

        <!-- 채널 맵 편집 -->
        <div v-else-if="view === 'map-edit' && editTarget" id="settings-content">
            <WindowMapEditor
                :map-data="editTarget.map ?? null"
                :room-id="editTarget.id"
                @saved="onMapSaved"
                @cancel="closeMapEdit"
            />
        </div>

        <!-- 기본 개인 방 템플릿 편집 -->
        <div v-else-if="view === 'map-edit' && defaultMapEdit" id="settings-content">
            <WindowMapEditor
                :map-data="serverForm.defaultUserMap"
                default-template
                @saved="onMapSaved"
                @cancel="closeMapEdit"
            />
        </div>

        <!-- 삭제 확인 모달 -->
        <div v-if="deleteTarget" class="admin-confirm-overlay" @click.self="deleteTarget = null">
            <div class="admin-confirm-box">
                <p class="admin-confirm-msg">
                    <strong>{{ deleteTarget.knownas }}</strong> 채널을 정말 삭제할까요?<br />
                    <span style="font-size:0.82rem;opacity:0.55">채널 내 메시지·게시물은 남아있지만 채널이 목록에서 사라집니다.</span>
                </p>
                <div class="admin-confirm-actions">
                    <button class="back-btn-header" @click="deleteTarget = null">취소</button>
                    <button class="submit-btn danger-btn" @click="doDelete" :disabled="saving">
                        {{ saving ? '삭제 중...' : '삭제' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 영구정지 확인 모달 -->
        <div v-if="banTarget" class="admin-confirm-overlay" @click.self="banTarget = null">
            <div class="admin-confirm-box">
                <p class="admin-confirm-msg">
                    <strong>{{ banTarget.knownas || banTarget.username }}</strong>님을 정말 영구정지할까요?<br />
                    <span style="font-size:0.82rem;opacity:0.55">로그인 자체가 막히고, 이미 접속 중이면 즉시 끊깁니다.</span>
                </p>
                <input v-model="banReasonDraft" placeholder="사유(선택)" class="post-input" style="margin-bottom:10px" />
                <div class="admin-confirm-actions">
                    <button class="back-btn-header" @click="banTarget = null">취소</button>
                    <button class="submit-btn danger-btn" @click="doBan" :disabled="memberActionBusy">
                        {{ memberActionBusy ? '처리 중...' : '영구정지' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 상점 아이템 삭제 확인 모달 -->
        <div v-if="shopDeleteTarget" class="admin-confirm-overlay" @click.self="shopDeleteTarget = null">
            <div class="admin-confirm-box">
                <p class="admin-confirm-msg">
                    <strong>{{ shopDeleteTarget.name }}</strong> 아이템을 정말 삭제할까요?<br />
                    <span style="font-size:0.82rem;opacity:0.55">이미 보유 중이거나 맵에 놓인 건 그대로 남고, 새로 살 수만 없게 돼요.</span>
                </p>
                <div class="admin-confirm-actions">
                    <button class="back-btn-header" @click="shopDeleteTarget = null">취소</button>
                    <button class="submit-btn danger-btn" @click="doDeleteShopItem" :disabled="shopDeleteSaving">
                        {{ shopDeleteSaving ? '삭제 중...' : '삭제' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { avatarPartFromCategory, decoLayerOf } from '../../lib/shopCategories'

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const slug = config.public.serverSlug
const { enabled: objectStorageEnabled, ensureLoaded: ensureObjectStorageStatusLoaded } = useObjectStorageStatus()

const emit = defineEmits(['close'])

const { userId, isLoggedIn } = useCurrentUser()

// 서버 + 룸 데이터 로드
const { data: serverData, refresh: refreshServer } = await useAsyncData(
    'settings-server',
    () => $fetch(`${apiBaseUrl}/api/getServerBySlug`, {
        method: 'POST',
        body: { slug },
    }).then(res => (Array.isArray(res) ? res[0] : res) ?? null),
)

// 서버 정보 편집
const serverForm = reactive({ title: '', themecolor: '#D21F3C', currencyName: '코코아', signupBonus: 100, info: '', avatar: '', registrationMode: 'open', defaultUserMap: null })
const serverSaving = ref(false)
const serverSaveMsg = ref('')
const serverError = ref('')
const serverIconFileInput = ref(null)
const serverIconUploading = ref(false)

watch(serverData, (data) => {
    if (!data) return
    serverForm.title = data.title ?? ''
    serverForm.themecolor = data.themecolor ?? '#D21F3C'
    serverForm.currencyName = data.currencyName ?? '코코아'
    serverForm.signupBonus = data.signupBonus ?? 100
    serverForm.info = data.info ?? ''
    serverForm.avatar = data.avatar ?? ''
    serverForm.registrationMode = data.registrationMode ?? 'open'
    serverForm.defaultUserMap = data.defaultUserMap ?? null
}, { immediate: true })

// 승인 대기 중인 가입 신청
const { data: pendingUsersData, refresh: refreshPendingUsers } = await useAsyncData(
    'pending-users',
    () => $fetch(`${apiBaseUrl}/api/admin/getPendingUsers`, {
        method: 'POST',
        body: { userid: userId.value },
    }).then(res => Array.isArray(res) ? res : []).catch(() => []),
    // SSR 중엔 일반 $fetch가 브라우저 쿠키를 안 실어 보내서 requireUserId가 401을 던지고
    // 그게 위 .catch(() => [])에 삼켜져 "승인 대기 없음"으로 영구히 고정돼버림(하이드레이션 후에도
    // 재요청 안 함) — 설정 페이지로 직접 진입/새로고침할 때(모바일에서 흔함) 특히 잘 터짐.
    // server:false로 SSR을 건너뛰고 클라이언트(쿠키 있는 상태)에서만 fetch하게 함
    { server: false },
)
const pendingUsers = computed(() => pendingUsersData.value ?? [])
const pendingError = ref('')

async function approveUser(id) {
    pendingError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/approveUser`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await refreshPendingUsers()
    } catch (e) {
        pendingError.value = e?.data?.message ?? '승인에 실패했습니다'
    }
}

async function rejectUser(id) {
    pendingError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/rejectUser`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await refreshPendingUsers()
    } catch (e) {
        pendingError.value = e?.data?.message ?? '거절에 실패했습니다'
    }
}

// ─── 멤버 관리: 재화 지급 / 정지 / 영구정지 ──────────────────────────
const { data: membersForAdminData, refresh: refreshMembersForAdmin } = await useAsyncData(
    'members-for-admin',
    () => $fetch(`${apiBaseUrl}/api/admin/getMembersForAdmin`, {
        method: 'POST',
        body: { userid: userId.value },
    }).then(res => Array.isArray(res) ? res : []).catch(() => []),
    // pending-users와 같은 SSR 쿠키 유실 문제 — server:false로 회피
    { server: false },
)
const membersForAdmin = computed(() => membersForAdminData.value ?? [])
const memberSearch = ref('')
const filteredMembers = computed(() => {
    const q = memberSearch.value.trim().toLowerCase()
    if (!q) return membersForAdmin.value
    return membersForAdmin.value.filter(m =>
        (m.username || '').toLowerCase().includes(q) || (m.knownas || '').toLowerCase().includes(q)
    )
})

const expandedMemberId = ref(null)
function toggleMemberPanel(id) {
    expandedMemberId.value = expandedMemberId.value === id ? null : id
}

function isSuspended(m) {
    return !!m.suspendedUntil && new Date(m.suspendedUntil).getTime() > Date.now()
}
function formatSuspendUntil(until) {
    return new Date(until).toLocaleString('ko-KR')
}
function memberStatusLabel(m) {
    if (m.bannedAt) return '영구정지'
    if (isSuspended(m)) return '정지 중'
    if (!m.approved) return '승인 대기'
    return ''
}

const memberActionBusy = ref(false)
const memberActionError = ref('')

const grantAmountDraft = ref(null)
const grantMsg = reactive({})
async function doGrantCurrency(id) {
    if (!grantAmountDraft.value) return
    memberActionError.value = ''
    try {
        const res = await $fetch(`${apiBaseUrl}/api/admin/grantCurrency`, {
            method: 'POST',
            body: { userid: userId.value, id, serverid: serverData.value?.id, amount: grantAmountDraft.value },
        })
        grantMsg[id] = `지급 완료! 현재 잔액: ${res.balance}`
        grantAmountDraft.value = null
    } catch (e) {
        memberActionError.value = e?.data?.message ?? '지급에 실패했습니다'
    }
}

const suspendDurationDraft = reactive({})
const suspendReasonDraft = reactive({})
async function doSuspend(id) {
    const durationMs = Number(suspendDurationDraft[id] ?? 3600000)
    const until = new Date(Date.now() + durationMs).toISOString()
    memberActionError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/suspendUser`, {
            method: 'POST',
            body: { userid: userId.value, id, until, reason: suspendReasonDraft[id] },
        })
        await refreshMembersForAdmin()
    } catch (e) {
        memberActionError.value = e?.data?.message ?? '정지에 실패했습니다'
    }
}
async function doUnsuspend(id) {
    memberActionError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/unsuspendUser`, { method: 'POST', body: { userid: userId.value, id } })
        await refreshMembersForAdmin()
    } catch (e) {
        memberActionError.value = e?.data?.message ?? '정지 해제에 실패했습니다'
    }
}

const banTarget = ref(null)
const banReasonDraft = ref('')
async function doBan() {
    if (!banTarget.value) return
    memberActionBusy.value = true
    memberActionError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/banUser`, {
            method: 'POST',
            body: { userid: userId.value, id: banTarget.value.id, reason: banReasonDraft.value },
        })
        banTarget.value = null
        banReasonDraft.value = ''
        await refreshMembersForAdmin()
    } catch (e) {
        memberActionError.value = e?.data?.message ?? '영구정지에 실패했습니다'
    } finally {
        memberActionBusy.value = false
    }
}
async function doUnban(id) {
    memberActionError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/unbanUser`, { method: 'POST', body: { userid: userId.value, id } })
        await refreshMembersForAdmin()
    } catch (e) {
        memberActionError.value = e?.data?.message ?? '영구정지 해제에 실패했습니다'
    }
}

async function submitServerInfo() {
    serverSaving.value = true
    serverError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/updateServer`, {
            method: 'POST',
            body: { userid: userId.value, slug, ...serverForm },
        })
        serverSaveMsg.value = '저장되었습니다! 새로고침합니다...'
        // useServer()(ServerHeader 등에서 씀)가 반응형 참조가 아니라 호출 시점 스냅샷이라,
        // refreshNuxtData만으로는 이미 열려있는 다른 화면(헤더 색/이름 등)에 반영이 안 됨 —
        // 그냥 한 번 새로고침해서 확실히 최신 상태로 맞춤
        setTimeout(() => reloadNuxtApp(), 600)
    } catch (e) {
        serverError.value = e?.data?.message ?? '오류가 발생했습니다'
        serverSaving.value = false
    }
}

// 커스텀 이모지 관리
const { list: customEmojiList, categories: customEmojiCategories, ensureLoaded: ensureCustomEmojisLoaded, invalidate: invalidateCustomEmojis } = useCustomEmojis()
const newEmojiShortcode = ref('')
const newEmojiCategory = ref('')
const newEmojiTags = ref('')
const emojiFileInput = ref(null)
const customEmojiUploading = ref(false)
const customEmojiError = ref('')

async function handleCustomEmojiFile(e) {
    const file = e.target.files?.[0]
    if (!file || !newEmojiShortcode.value.trim()) return
    customEmojiUploading.value = true
    customEmojiError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('shortcode', newEmojiShortcode.value.trim())
        formData.append('category', newEmojiCategory.value.trim())
        formData.append('tags', newEmojiTags.value.trim())
        formData.append('file', file)
        await $fetch(`${apiBaseUrl}/api/admin/createCustomEmoji`, {
            method: 'POST',
            body: formData,
        })
        newEmojiShortcode.value = ''
        newEmojiCategory.value = ''
        newEmojiTags.value = ''
        await invalidateCustomEmojis()
    } catch (err) {
        customEmojiError.value = err?.data?.message ?? '업로드에 실패했습니다'
    }
    customEmojiUploading.value = false
    e.target.value = ''
}

async function deleteCustomEmoji(id) {
    customEmojiError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/deleteCustomEmoji`, {
            method: 'POST',
            body: { userid: userId.value, id },
        })
        await invalidateCustomEmojis()
    } catch (err) {
        customEmojiError.value = err?.data?.message ?? '삭제에 실패했습니다'
    }
}

// 이모지별 카테고리/태그 인라인 편집 — 목록이 로드될 때마다 아직 초안이 없는 항목만 채워 넣어서
// (이미 편집 중인 입력값을 재조회가 덮어쓰지 않게) 목록 fetch와 편집 상태가 서로 안 부딪히게 함
const emojiEditDraft = reactive({})
watch(customEmojiList, (list) => {
    for (const e of list) {
        if (!(e.id in emojiEditDraft)) {
            emojiEditDraft[e.id] = { category: e.category ?? '', tags: e.tags ?? '' }
        }
    }
}, { immediate: true })
function isEmojiDirty(e) {
    const d = emojiEditDraft[e.id]
    return !!d && (d.category !== (e.category ?? '') || d.tags !== (e.tags ?? ''))
}
const emojiSaving = reactive({})
async function saveCustomEmojiMeta(e) {
    const d = emojiEditDraft[e.id]
    if (!d) return
    emojiSaving[e.id] = true
    customEmojiError.value = ''
    try {
        const updated = await $fetch(`${apiBaseUrl}/api/admin/updateCustomEmoji`, {
            method: 'POST',
            body: { userid: userId.value, id: e.id, category: d.category, tags: d.tags },
        })
        emojiEditDraft[e.id] = { category: updated.category ?? '', tags: updated.tags ?? '' }
        await invalidateCustomEmojis()
    } catch (err) {
        customEmojiError.value = err?.data?.message ?? '수정에 실패했습니다'
    } finally {
        emojiSaving[e.id] = false
    }
}

// 이메일 설정
const emailForm = reactive({ smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPassword: '', fromAddress: '', fromName: '', enabled: false })
const emailSmtpPasswordSet = ref(false)
// 서버(updateServer.ts)의 가입 방식 제한과 같은 기준 — "가입 방식" 셀렉트에서 open/approval을
// 미리 막아서, 저장 눌렀다가 서버가 거절하는 걸 보기 전에 여기서부터 이유를 알려줌
const mailReady = computed(() => !!(emailForm.enabled && emailForm.smtpHost && emailForm.smtpUser && emailSmtpPasswordSet.value))
const emailSaving = ref(false)
const emailSaveMsg = ref('')
const emailError = ref('')
const emailTesting = ref(false)
const emailTestMsg = ref('')

async function loadEmailSettings() {
    try {
        const data = await $fetch(`${apiBaseUrl}/api/admin/getEmailSettings`, {
            method: 'POST',
            body: { userid: userId.value },
        })
        emailForm.smtpHost = data.smtpHost ?? ''
        emailForm.smtpPort = data.smtpPort ?? 587
        emailForm.smtpSecure = !!data.smtpSecure
        emailForm.smtpUser = data.smtpUser ?? ''
        emailForm.smtpPassword = ''
        emailForm.fromAddress = data.fromAddress ?? ''
        emailForm.fromName = data.fromName ?? ''
        emailForm.enabled = !!data.enabled
        emailSmtpPasswordSet.value = !!data.smtpPasswordSet
    } catch (err) {
        emailError.value = err?.data?.message ?? '이메일 설정을 불러오지 못했습니다'
    }
}

async function submitEmailSettings() {
    emailSaving.value = true
    emailError.value = ''
    emailSaveMsg.value = ''
    try {
        const data = await $fetch(`${apiBaseUrl}/api/admin/updateEmailSettings`, {
            method: 'POST',
            body: { userid: userId.value, ...emailForm },
        })
        emailForm.smtpPassword = ''
        emailSmtpPasswordSet.value = !!data.smtpPasswordSet
        emailSaveMsg.value = '저장되었습니다!'
        setTimeout(() => { emailSaveMsg.value = '' }, 2500)
    } catch (err) {
        emailError.value = err?.data?.message ?? '오류가 발생했습니다'
    }
    emailSaving.value = false
}

async function sendTestEmail() {
    emailTesting.value = true
    emailTestMsg.value = ''
    try {
        const result = await $fetch(`${apiBaseUrl}/api/admin/sendTestEmail`, {
            method: 'POST',
            body: { userid: userId.value },
        })
        emailTestMsg.value = result.ok ? '테스트 메일을 보냈어요! 메일함을 확인해보세요.' : `실패: ${result.error}`
    } catch (err) {
        emailTestMsg.value = `실패: ${err?.data?.message ?? '오류가 발생했습니다'}`
    }
    emailTesting.value = false
}

// 상점 아이템 관리
const { avatarSubTabs: shopAvatarCategories, itemSubTabs: shopItemCategories, categoryLabel: shopCategoryLabel } = useShopCategories()
const ALL_SHOP_CATEGORIES = [...shopAvatarCategories, ...shopItemCategories]
const shopCategoryFilter = ref('all')

const { data: shopItemsData, refresh: refreshShopItems } = await useAsyncData(
    'admin-shop-items',
    () => isLoggedIn.value
        ? $fetch(`${apiBaseUrl}/api/admin/listShopItems`, { method: 'POST', body: { userid: userId.value } }).catch(() => [])
        : [],
    // pending-users와 같은 SSR 쿠키 유실 문제 — server:false로 회피
    { server: false },
)
const shopItems = computed(() => shopItemsData.value ?? [])
const filteredShopItems = computed(() =>
    shopCategoryFilter.value === 'all' ? shopItems.value : shopItems.value.filter((i) => i.category === shopCategoryFilter.value)
)

// meta에 layers 배열이 있는 functional 아이템 = 농사 작물(맵에 심어서 키우는 기능 아이템).
// 순수 기능 아이템(예: 나중에 생길 소모품성 기능)은 layers가 없어서 이 판정에 안 걸림
function cropMetaOf(item) {
    try {
        const m = JSON.parse(item?.meta || '{}')
        return Array.isArray(m?.layers) ? m : null
    } catch { return null }
}
function isCropItem(item) {
    return item.category === 'functional' && !!cropMetaOf(item)
}

// 새 아이템 등록
function emptyShopForm() {
    return {
        category: '', name: '', description: '', price: 0, active: true, isDefault: false, blocksMovement: false, decoLayer: 'back', icon: '', layers: new Array(6).fill(null),
        // 작물(농사 시스템) 전용 — category가 functional일 때만 의미 있음
        isCrop: false, growSeconds: 60, rewardMin: 20, rewardMax: 30,
        // map_item/작물 공통 — 바닥에 까는 아이템(캐릭터보다 항상 뒤에 표시)
        behindAvatar: false,
    }
}
const newShopItem = reactive(emptyShopForm())
const newShopItemError = ref('')
const newShopItemSaving = ref(false)
const newShopIconFileInput = ref(null)
const newShopIconUploading = ref(false)

async function handleNewShopIconFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    newShopIconUploading.value = true
    newShopItemError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/admin/uploadShopIcon`, { method: 'POST', body: formData })
        newShopItem.icon = result.url
    } catch (err) {
        newShopItemError.value = err?.data?.message ?? '업로드에 실패했습니다'
    }
    newShopIconUploading.value = false
    e.target.value = ''
}

// map_item이거나, functional인데 "작물로 만들기"를 켠 경우 — 둘 다 itemKey를 자동 배정하고
// 레이어 6장이 필요함(createShopItem.ts의 isMapPlaceable과 같은 판정)
const isNewCrop = computed(() => newShopItem.category === 'functional' && newShopItem.isCrop)
const newItemNeedsLayers = computed(() => newShopItem.category === 'map_item' || isNewCrop.value)

async function submitNewShopItem() {
    newShopItemError.value = ''
    if (!newShopItem.category) { newShopItemError.value = '카테고리를 선택해주세요'; return }
    if (!newShopItem.name.trim()) { newShopItemError.value = '이름을 입력해주세요' ; return }
    if (newItemNeedsLayers.value && newShopItem.layers.filter(Boolean).length !== 6) { newShopItemError.value = '레이어 6장을 모두 채워주세요'; return }
    if (isNewCrop.value && !newShopItem.growSeconds) { newShopItemError.value = '성장 시간(초)을 입력해주세요'; return }

    newShopItemSaving.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/admin/createShopItem`, {
            method: 'POST',
            body: {
                userid: userId.value,
                category: newShopItem.category,
                name: newShopItem.name.trim(),
                description: newShopItem.description.trim(),
                price: newShopItem.price,
                active: newShopItem.active,
                isDefault: newShopItem.isDefault,
                blocksMovement: newShopItem.blocksMovement,
                decoLayer: newShopItem.category === 'avatar_deco' ? newShopItem.decoLayer : undefined,
                icon: newShopItem.icon || null,
                layers: newItemNeedsLayers.value ? newShopItem.layers : undefined,
                isCrop: isNewCrop.value,
                growSeconds: isNewCrop.value ? newShopItem.growSeconds : undefined,
                rewardMin: isNewCrop.value ? newShopItem.rewardMin : undefined,
                rewardMax: isNewCrop.value ? newShopItem.rewardMax : undefined,
                behindAvatar: newItemNeedsLayers.value ? newShopItem.behindAvatar : undefined,
            },
        })
        Object.assign(newShopItem, emptyShopForm())
        await refreshShopItems()
    } catch (err) {
        newShopItemError.value = err?.data?.message ?? '등록에 실패했습니다'
    }
    newShopItemSaving.value = false
}

// 인라인 수정
const editingShopItemId = ref(null)
const shopEditForm = reactive({ name: '', description: '', price: 0, active: true, isDefault: false, blocksMovement: false, decoLayer: 'back', icon: '', layers: new Array(6).fill(null), growSeconds: 60, rewardMin: 20, rewardMax: 30, behindAvatar: false })
const shopEditError = ref('')
const shopEditSaving = ref(false)
const shopEditIconFileInput = ref(null)
const shopEditIconUploading = ref(false)

// 새로 등록한 맵 아이템은 항상 itemKey가 자기 DB id 문자열과 같음(createShopItem.ts). 그게 안
// 맞으면 코드에 내장된 레거시 카탈로그(useItemCatalog.ts STATIC_ITEM_CATALOG)를 가리키는 것만을
// 위한 "상점 등록용" 행이라는 뜻 — 여기에 레이어를 새로 올리면 그 itemKey 자리를 가로채서
// 레거시 그림과 충돌하니(예: 무지개 기둥 자리에 다른 그림이 겹쳐 보임) 레이어 교체를 막아둠
function isLegacyMapItem(item) {
    return item.category === 'map_item' && String(item.id) !== item.itemKey
}

function toggleEditShopItem(item) {
    if (editingShopItemId.value === item.id) { editingShopItemId.value = null; return }
    editingShopItemId.value = item.id
    shopEditError.value = ''
    shopEditForm.name = item.name
    shopEditForm.description = item.description ?? ''
    shopEditForm.price = item.price
    shopEditForm.active = item.active
    shopEditForm.isDefault = item.isDefault
    shopEditForm.blocksMovement = !!item.blocksMovement
    shopEditForm.decoLayer = item.category === 'avatar_deco' ? decoLayerOf(item.meta) : 'back'
    shopEditForm.icon = item.icon ?? ''
    shopEditForm.layers = new Array(6).fill(null) // 바꾼 칸만 채워짐 — null인 칸은 update 쪽에서 기존 값 유지
    const cropMeta = cropMetaOf(item)
    shopEditForm.growSeconds = cropMeta?.growSeconds ?? 60
    shopEditForm.rewardMin = cropMeta?.rewardMin ?? 20
    shopEditForm.rewardMax = cropMeta?.rewardMax ?? 30
    // behindAvatar는 크롭 전용이 아니라 map_item/functional 둘 다에 적용됨 — cropMetaOf는 이름과
    // 달리 "레이어 있는 meta"면 다 파싱해주니 그대로 재사용
    shopEditForm.behindAvatar = cropMeta?.behindAvatar === true
}

async function handleShopEditIconFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    shopEditIconUploading.value = true
    shopEditError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/admin/uploadShopIcon`, { method: 'POST', body: formData })
        shopEditForm.icon = result.url
    } catch (err) {
        shopEditError.value = err?.data?.message ?? '업로드에 실패했습니다'
    }
    shopEditIconUploading.value = false
    e.target.value = ''
}

async function submitEditShopItem(item) {
    shopEditError.value = ''
    if (!shopEditForm.name.trim()) { shopEditError.value = '이름을 입력해주세요'; return }

    shopEditSaving.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/admin/updateShopItem`, {
            method: 'POST',
            body: {
                userid: userId.value,
                id: item.id,
                name: shopEditForm.name.trim(),
                description: shopEditForm.description.trim(),
                price: shopEditForm.price,
                active: shopEditForm.active,
                isDefault: shopEditForm.isDefault,
                blocksMovement: item.category === 'terrain' ? shopEditForm.blocksMovement : undefined,
                decoLayer: item.category === 'avatar_deco' ? shopEditForm.decoLayer : undefined,
                icon: (item.category === 'map_item' || isCropItem(item)) ? undefined : (shopEditForm.icon || null),
                layers: (item.category === 'map_item' || isCropItem(item)) ? shopEditForm.layers : undefined,
                growSeconds: isCropItem(item) ? shopEditForm.growSeconds : undefined,
                rewardMin: isCropItem(item) ? shopEditForm.rewardMin : undefined,
                rewardMax: isCropItem(item) ? shopEditForm.rewardMax : undefined,
                behindAvatar: (item.category === 'map_item' || isCropItem(item)) ? shopEditForm.behindAvatar : undefined,
            },
        })
        editingShopItemId.value = null
        await refreshShopItems()
    } catch (err) {
        shopEditError.value = err?.data?.message ?? '저장에 실패했습니다'
    }
    shopEditSaving.value = false
}

// 삭제
const shopDeleteTarget = ref(null)
const shopDeleteSaving = ref(false)
async function doDeleteShopItem() {
    if (!shopDeleteTarget.value) return
    shopDeleteSaving.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/admin/deleteShopItem`, {
            method: 'POST',
            body: { userid: userId.value, id: shopDeleteTarget.value.id },
        })
        shopDeleteTarget.value = null
        await refreshShopItems()
    } catch (err) {
        shopDeleteTarget.value = null
    }
    shopDeleteSaving.value = false
}

onMounted(() => {
    ensureCustomEmojisLoaded()
    ensureObjectStorageStatusLoaded()
    loadEmailSettings()
})

async function handleServerIconFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    serverIconUploading.value = true
    serverError.value = ''
    try {
        const formData = new FormData()
        formData.append('userid', String(userId.value))
        formData.append('file', file)
        const result = await $fetch(`${apiBaseUrl}/api/admin/uploadServerIcon`, {
            method: 'POST',
            body: formData,
        })
        serverForm.avatar = result.url
    } catch (e) {
        serverError.value = e?.data?.message ?? '업로드에 실패했습니다'
    }
    serverIconUploading.value = false
    e.target.value = ''
}

const { data: roomsData, refresh: refreshRooms } = await useAsyncData(
    'settings-rooms',
    () => $fetch(`${apiBaseUrl}/api/getRoomsBySlug`, {
        method: 'POST',
        body: { slug },
    }).then(res => Array.isArray(res) ? res : []),
)

// server.rooms 배열 파싱 → 순서대로 채널+제목 목록
const orderedList = ref([])

function buildOrderedList() {
    const rawOrder = serverData.value?.rooms ? JSON.parse(serverData.value.rooms) : []
    const fetched = roomsData.value ?? []
    orderedList.value = rawOrder.map(entry => {
        if (typeof entry === 'number') {
            return fetched.find(r => r.id === entry) ?? null
        }
        return entry  // 제목 구분자 { type: 'title', knownas: '...' }
    }).filter(Boolean)
}

watch([serverData, roomsData], buildOrderedList, { immediate: true })

const view = ref('list')

// 목록 화면(view === 'list')이 섹션 하나에 전부 이어붙어 있던 걸 탭으로 나눠서 보여줌.
// "가입 승인" 탭은 원래 섹션 자체가 조건부로만 보이던 것과 동일하게, 탭 목록에도 조건부로만 노출
const activeTab = ref('server')
const tabs = computed(() => [
    { id: 'server', label: '서버 정보', icon: 'hgi hgi-stroke hgi-setting-07' },
    { id: 'emoji', label: '커스텀 이모지', icon: 'hgi hgi-stroke hgi-smile' },
    ...(serverForm.registrationMode === 'approval' || pendingUsers.value.length
        ? [{ id: 'pending', label: '가입 승인', icon: 'hgi hgi-stroke hgi-tick-01' }]
        : []),
    { id: 'members', label: '멤버 관리', icon: 'hgi hgi-stroke hgi-user-list' },
    { id: 'pinned', label: '기본 페이지', icon: 'hgi hgi-stroke hgi-map-01' },
    { id: 'channels', label: '채널 목록', icon: 'hgi hgi-stroke hgi-grid' },
    { id: 'shop', label: '상점 아이템', icon: 'hgi hgi-stroke hgi-shopping-bag-01' },
    { id: 'email', label: '이메일', icon: 'hgi hgi-stroke hgi-mail-01' },
])
// 가입 승인 탭이 사라졌는데 거기 있던 상태였으면 서버 정보 탭으로 돌려보냄
watch(tabs, (list) => {
    if (!list.some((t) => t.id === activeTab.value)) activeTab.value = 'server'
})
const saving = ref(false)
const saveMsg = ref('')
const formError = ref('')
const deleteTarget = ref(null)
const editTarget = ref(null)
const newTitleName = ref('')
const federatedChecked = ref(false)

// 사이드바에 하드코딩된 고정 페이지 — 채널 목록(servers.rooms)과 무관하게 경로로 바로 맵 편집
const PINNED_PAGES = [
    { path: '/', knownas: '마을', type: 'room' },
    { path: '/noti', knownas: '공지 게시판', type: 'board' },
]
const pinnedEdit = ref(false)
const pinnedLoading = ref('')
const pinnedError = ref('')

// 가입 시 기본 방 템플릿 편집 — 특정 채널(room)이 아니라 servers.defaultUserMap 자체를 편집하는
// 거라 editTarget/pinnedEdit(둘 다 rooms 테이블 대상)이랑 별개 플래그로 관리함
const defaultMapEdit = ref(false)

// 고정 페이지의 실제 현재 이름 — roomsData(getRoomsBySlug)에 이미 다 들어있어서 따로 fetch 안 함
function findPinnedRoom(path) {
    return (roomsData.value ?? []).find((r) => r.path === path)
}

const pinnedNameDraft = reactive({})
watch(roomsData, (rooms) => {
    for (const pinned of PINNED_PAGES) {
        if (pinned.path in pinnedNameDraft) continue
        const room = (rooms ?? []).find((r) => r.path === pinned.path)
        pinnedNameDraft[pinned.path] = room?.knownas ?? pinned.knownas
    }
}, { immediate: true })

const pinnedSaving = ref('')

async function savePinnedName(pinned) {
    const newName = pinnedNameDraft[pinned.path]?.trim()
    if (!newName) return
    pinnedError.value = ''
    pinnedSaving.value = pinned.path
    try {
        let room = findPinnedRoom(pinned.path)
        if (!room) {
            room = await $fetch(`${apiBaseUrl}/api/admin/getOrCreateRoomByPath`, {
                method: 'POST',
                body: { userid: userId.value, ...pinned },
            })
        }
        await $fetch(`${apiBaseUrl}/api/admin/updateRoom`, {
            method: 'POST',
            body: { userid: userId.value, id: room.id, path: room.path, knownas: newName, type: room.type, info: room.info },
        })
        await refreshRooms()
        await refreshNuxtData('rooms-data')
    } catch (e) {
        pinnedError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    pinnedSaving.value = ''
}

const form = reactive({ knownas: '', path: '', type: 'room', info: '', galleryView: false })

// 연합 게시판은 갤러리 보기를 지원 안 하니(정사각형 그리드에 원격 글까지 섞이면 안 어울림),
// 연합 체크를 켜는 순간 갤러리 체크는 자동으로 꺼줌 — 서버(setFederatedRoom.ts)도 같은 규칙을
// 한 번 더 강제하지만, 폼에서도 미리 꺼줘야 저장 직전까지 둘 다 켜진 것처럼 보이지 않음
watch(federatedChecked, (v) => { if (v) form.galleryView = false })

function isTitleEntry(entry) {
    return entry?.type === 'title'
}

function entryKey(entry, i) {
    return isTitleEntry(entry) ? `title-${i}` : `room-${entry.id}`
}

function channelIcon(type) {
    const map = {
        board: 'hgi hgi-stroke hgi-grid',
        voice: 'hgi hgi-stroke hgi-volume-high',
        wiki: 'hgi hgi-stroke hgi-book-open-01',
    }
    return map[type] ?? 'hgi hgi-stroke hgi-meeting-room'
}

function typeLabel(type) {
    const map = { room: '채팅방', board: '게시판', voice: '음성', wiki: '위키' }
    return map[type] ?? type
}

function moveUp(i) {
    if (i === 0) return
    const arr = [...orderedList.value]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    orderedList.value = arr
}

function moveDown(i) {
    if (i >= orderedList.value.length - 1) return
    const arr = [...orderedList.value]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    orderedList.value = arr
}

function addTitleEntry() {
    if (!newTitleName.value.trim()) return
    orderedList.value = [...orderedList.value, { type: 'title', knownas: newTitleName.value.trim() }]
    newTitleName.value = ''
}

function removeTitleEntry(i) {
    orderedList.value = orderedList.value.filter((_, idx) => idx !== i)
}

async function refreshAll() {
    await Promise.all([refreshServer(), refreshRooms()])
    await refreshNuxtData('server-data')
    await refreshNuxtData('rooms-data')
    buildOrderedList()
}

// 순서 배열을 서버에 저장
async function saveOrder() {
    saving.value = true
    saveMsg.value = ''
    const roomsList = orderedList.value.map(entry =>
        isTitleEntry(entry) ? entry : entry.id
    )
    await $fetch(`${apiBaseUrl}/api/admin/updateServerRooms`, {
        method: 'POST',
        body: { userid: userId.value, slug, roomsList },
    })
    await refreshAll()
    saving.value = false
    saveMsg.value = '저장되었습니다!'
    setTimeout(() => { saveMsg.value = '' }, 2500)
}

// 채널 생성 폼 열기
function openCreate() {
    pinnedEdit.value = false
    form.knownas = ''
    form.path = ''
    form.type = 'room'
    form.info = ''
    form.galleryView = false
    federatedChecked.value = false
    formError.value = ''
    view.value = 'create'
}

async function submitCreate() {
    if (!form.knownas.trim() || !form.path.trim()) return
    saving.value = true
    formError.value = ''
    try {
        const created = await $fetch(`${apiBaseUrl}/api/admin/createRoom`, {
            method: 'POST',
            body: { userid: userId.value, slug, ...form },
        })
        if (form.type === 'board' && federatedChecked.value) {
            await $fetch(`${apiBaseUrl}/api/admin/setFederatedRoom`, {
                method: 'POST',
                body: { userid: userId.value, slug, roomid: created.id, federated: true },
            })
        }
        await refreshAll()
        view.value = 'list'
    } catch (e) {
        formError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    saving.value = false
}

function onMapSaved(mapJson) {
    if (defaultMapEdit.value) {
        serverForm.defaultUserMap = mapJson
        view.value = 'list'
        // 이건 특정 room 경로가 아니라 servers 테이블 자체라 RoomMap.vue 캐시랑 무관함 —
        // 새로고침 없이 그냥 서버 데이터만 다시 불러오면 됨
        refreshServer()
        return
    }
    editTarget.value = { ...editTarget.value, map: mapJson }
    view.value = pinnedEdit.value ? 'list' : 'edit'
    // 실제 맵 화면(RoomMap.vue)은 방 경로별로 따로 캐싱된 데이터를 쓰기 때문에 여기서
    // 아무리 갱신해도 반영이 안 됨 — 새로고침해서 방금 저장한 맵이 확실히 보이게 함
    reloadNuxtApp()
}

function closeMapEdit() {
    if (defaultMapEdit.value) {
        view.value = 'list'
        return
    }
    view.value = pinnedEdit.value ? 'list' : 'edit'
}

// 가입 시 기본 방 템플릿 편집 열기
function openDefaultMapEdit() {
    pinnedEdit.value = false
    defaultMapEdit.value = true
    view.value = 'map-edit'
}

// 채널 편집 폼 열기
function openEdit(room) {
    pinnedEdit.value = false
    defaultMapEdit.value = false
    editTarget.value = room
    form.knownas = room.knownas
    form.path = room.path
    form.type = room.type
    form.info = room.info ?? ''
    form.galleryView = !!room.galleryView
    federatedChecked.value = !!room.federated
    formError.value = ''
    view.value = 'edit'
}

// 마을/공지 게시판처럼 고정 경로의 room을 찾거나 생성해서 바로 맵 편집으로 이동
async function openPinnedMapEdit(pinned) {
    pinnedError.value = ''
    pinnedLoading.value = pinned.path
    try {
        const room = await $fetch(`${apiBaseUrl}/api/admin/getOrCreateRoomByPath`, {
            method: 'POST',
            body: { userid: userId.value, ...pinned },
        })
        pinnedEdit.value = true
        defaultMapEdit.value = false
        editTarget.value = room
        view.value = 'map-edit'
    } catch (e) {
        pinnedError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    pinnedLoading.value = ''
}

async function submitEdit() {
    if (!form.knownas.trim() || !form.path.trim()) return
    saving.value = true
    formError.value = ''
    try {
        await $fetch(`${apiBaseUrl}/api/admin/updateRoom`, {
            method: 'POST',
            body: { userid: userId.value, id: editTarget.value.id, ...form },
        })
        if (form.type === 'board') {
            await $fetch(`${apiBaseUrl}/api/admin/setFederatedRoom`, {
                method: 'POST',
                body: { userid: userId.value, slug, roomid: editTarget.value.id, federated: federatedChecked.value },
            })
        }
        await refreshAll()
        view.value = 'list'
    } catch (e) {
        formError.value = e?.data?.message ?? '오류가 발생했습니다'
    }
    saving.value = false
}

// 삭제
function confirmDelete(room) {
    deleteTarget.value = room
}

async function doDelete() {
    if (!deleteTarget.value) return
    saving.value = true
    await $fetch(`${apiBaseUrl}/api/admin/deleteRoom`, {
        method: 'POST',
        body: { userid: userId.value, slug, id: deleteTarget.value.id },
    })
    await refreshAll()
    deleteTarget.value = null
    saving.value = false
}

</script>

<style>
#settings-content {
    padding: 20px 24px;
    font-size: 0.95rem;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.admin-tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding-bottom: 4px;
    margin-bottom: 4px;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
}
.admin-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 0.85rem;
    font-family: inherit;
    font-weight: 600;
    color: rgba(var(--fg-rgb),0.45);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    white-space: nowrap;
}
.admin-tab-btn:hover { background: rgba(var(--fg-rgb),0.06); color: rgba(var(--fg-rgb),0.8); }
.admin-tab-btn.active {
    background: var(--bgaccent);
    color: var(--accent);
}

.admin-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.admin-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}

.admin-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(var(--fg-rgb),0.35);
}

.admin-add-btn {
    margin-left: auto;
    background: rgba(var(--fg-rgb),0.12);
    border: 1px solid rgba(var(--fg-rgb),0.2);
    color: rgba(var(--fg-rgb),0.8);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.1s;
}
.admin-add-btn:hover { background: rgba(var(--fg-rgb),0.2); color: rgba(var(--fg-rgb),1); }
.admin-add-btn:disabled { opacity: 0.35; cursor: default; }

/* 채널 목록 */
.admin-channel-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid rgba(var(--fg-rgb),0.07);
    border-radius: 10px;
    padding: 6px;
    background: rgba(0,0,0,0.15);
}

.admin-channel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 7px;
    background: rgba(var(--fg-rgb),0.04);
    transition: background 0.1s;
    min-height: 38px;
}

.admin-channel-item:hover { background: rgba(var(--fg-rgb),0.07); }

.admin-emoji-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px 10px;
    border-radius: 7px;
    background: rgba(var(--fg-rgb),0.04);
    transition: background 0.1s;
}
.admin-emoji-item:hover { background: rgba(var(--fg-rgb),0.07); }
.admin-emoji-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
}
.admin-emoji-meta-row {
    display: flex;
    gap: 6px;
    padding-left: 36px;
}
.admin-emoji-meta-row .post-input {
    font-size: 0.78rem;
    padding: 5px 8px;
}

.member-action-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    margin: 2px 0 8px;
    border-radius: 7px;
    background: rgba(var(--fg-rgb),0.03);
    border: 1px solid rgba(var(--fg-rgb),0.08);
}

.member-action-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.admin-channel-item.is-title {
    background: rgba(var(--fg-rgb),0.02);
    border: 1px dashed rgba(var(--fg-rgb),0.08);
}

.admin-ch-icon {
    font-size: 0.9rem;
    color: rgba(var(--fg-rgb),0.35);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
}

.admin-ch-name {
    font-size: 0.9rem;
    color: rgba(var(--fg-rgb),0.85);
    flex: 1;
    min-width: 0; /* flex:1만으로는 형제 요소들 때문에 줄어들지 않아 행이 넘칠 수 있음(플렉스박스 기본값 이슈) */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.admin-ch-name.title-entry {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(var(--fg-rgb),0.4);
}

.admin-ch-path {
    font-size: 0.74rem;
    color: rgba(var(--fg-rgb),0.3);
    background: rgba(var(--fg-rgb),0.05);
    border-radius: 4px;
    padding: 1px 6px;
    flex-shrink: 0;
    font-family: monospace;
}

.admin-ch-type-badge {
    font-size: 0.7rem;
    color: rgba(var(--fg-rgb),0.4);
    background: rgba(var(--fg-rgb),0.06);
    border-radius: 4px;
    padding: 1px 7px;
    flex-shrink: 0;
}

.admin-ch-actions {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
}

.admin-icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    color: rgba(var(--fg-rgb),0.45);
    border-radius: 5px;
    font-size: 0.88rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
    font-family: inherit;
}

.admin-icon-btn:hover {
    background: rgba(var(--fg-rgb),0.1);
    color: rgba(var(--fg-rgb),1);
}

.admin-icon-btn:disabled {
    opacity: 0.2;
    cursor: default;
}

.admin-icon-btn.danger:hover {
    background: rgba(210,31,60,0.25);
    color: #ff5070;
}

/* 제목 추가 행 */
.admin-title-add {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    padding-top: 4px;
}

.admin-title-add .admin-add-btn {
    margin-left: 0;
    white-space: nowrap;
}

/* 폼 레이블 */
.admin-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(var(--fg-rgb),0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 6px;
    display: block;
}

.admin-label-hint {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: rgba(var(--fg-rgb),0.3);
    font-size: 0.75rem;
}

.admin-select {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(var(--fg-rgb),0.4)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
}

.admin-select:focus { outline: none; border-color: var(--accent); }
.admin-select option { background: var(--surface-2); }

.admin-ch-federated-badge {
    color: #7cc4ff;
    background: rgba(124,196,255,0.12);
}

.admin-checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.88rem;
    color: rgba(var(--fg-rgb),0.8);
    margin-top: 4px;
    cursor: pointer;
}

.admin-checkbox-row input[type="checkbox"] {
    width: 15px;
    height: 15px;
    cursor: pointer;
}

.admin-color-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.admin-color-input {
    width: 40px;
    height: 38px;
    padding: 2px;
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    background: rgba(var(--fg-rgb),0.06);
    cursor: pointer;
    flex-shrink: 0;
}

.admin-icon-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.admin-icon-preview {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: rgba(var(--fg-rgb),0.06);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--fg-rgb),0.3);
    flex-shrink: 0;
    overflow: hidden;
}

.admin-icon-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.admin-error {
    color: #ff5070;
    font-size: 0.85rem;
    margin: 0;
}

.admin-save-msg {
    font-size: 0.85rem;
    color: #60e080;
    margin: 0;
}

/* 삭제 확인 오버레이 */
.admin-confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: inherit;
}

.admin-confirm-box {
    background: var(--surface-2);
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 12px;
    padding: 24px 28px;
    max-width: 340px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

.admin-confirm-msg {
    margin: 0;
    line-height: 1.6;
    color: rgba(var(--fg-rgb),0.85);
    font-size: 0.95rem;
}

.admin-confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.danger-btn {
    background-color: #c0102a !important;
}
.danger-btn:hover { background-color: #a00020 !important; }
</style>
