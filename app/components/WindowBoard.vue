<template>
    <div class="modal-base">

        <!-- 헤더 (뷰에 따라 변경) -->
        <div class="window-header">
            <i class="hgi hgi-stroke hgi-grid"></i>
            <span v-if="currentView === 'create'" class="board-header-title">새 글 작성</span>
            <span v-else-if="currentView === 'edit'" class="board-header-title">글 수정</span>
            <span v-else class="board-header-title">{{ props.roomName || '게시판' }}</span>
            <div class="board-header-actions">
                <button v-if="currentView === 'list'" class="write-btn-header" @click="currentView = 'create'; postEditorTab = 'write'">+ 새 글</button>
                <button v-else class="back-btn-header" @click="goBack">← {{ currentView === 'edit' ? '취소' : '목록' }}</button>
                <button class="window-close-btn board-close-btn" @click="$emit('close')">✕</button>
            </div>
        </div>

        <!-- 목록 -->
        <div v-if="currentView === 'list'" id="board-wrapper">
            <div v-if="mergedFeed.length" class="board">
                <template v-for="entry in mergedFeed" :key="`${entry.kind}-${entry.post.id}`">
                    <!-- 뮤트(소프트)된 글 게이트 — 로컬/원격 공통 -->
                    <div
                        v-if="entry.post.muted === 'soft' && !revealedMuted[`${entry.kind}-${entry.post.id}`]"
                        class="post-card remote-cw-gate"
                    >
                        <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 게시물입니다</div>
                        <button class="submit-btn" @click.stop="revealedMuted[`${entry.kind}-${entry.post.id}`] = true">그래도 보기</button>
                    </div>
                    <!-- 로컬 글 -->
                    <div v-else-if="entry.kind === 'local'" class="post-card" @click="openPost(entry.post.id)">
                        <div class="post-card-title">{{ entry.post.title }}</div>
                        <div class="post-card-meta">
                            <NuxtLink :to="entry.post.user?.username ? `/@${entry.post.user.username}` : '#'" class="post-author user-name-link" @click.stop>
                                <NuxtImg v-if="entry.post.user?.avatar" class="avatar avatar-sm" :src="entry.post.user.avatar" />
                                <div v-else class="avatar avatar-placeholder avatar-sm">{{ (entry.post.user?.knownas ?? entry.post.user?.username ?? '?')[0] }}</div>
                                {{ entry.post.user?.knownas ?? entry.post.user?.username }}
                            </NuxtLink>
                            <span class="datetime">{{ formatDate(entry.post.createdAt) }}</span>
                        </div>
                    </div>
                    <!-- 연합 팔로잉 피드(외부) 글 -->
                    <div
                        v-else
                        class="post-card external-post-card"
                        :style="{ borderLeftColor: badgeBg(remoteServerHost(entry.post.sourceActorUrl)) }"
                        @click="openRemotePost(entry.post)"
                    >
                        <div class="external-post-body">
                            <div v-if="entry.post.boostedByName || entry.post.boostedByHandle" class="boost-banner">
                                <i class="hgi hgi-stroke hgi-arrow-reload-horizontal"></i>
                                <span v-if="entry.post.boostedByName" v-html="entry.post.boostedByName"></span><span v-else>{{ entry.post.boostedByHandle }}</span>님이 재게시했습니다
                            </div>
                            <div class="post-card-title">
                                <i class="hgi hgi-stroke hgi-globe-02"></i>
                                <template v-if="entry.post.summary">
                                    <i class="hgi hgi-stroke hgi-alert-02 cw-icon" title="열람주의(CW)"></i>
                                    <span v-html="entry.post.summary"></span>
                                </template>
                                <span v-else class="preview-text" v-html="stripHtmlKeepEmoji(entry.post.content)"></span>
                            </div>
                            <div class="post-card-meta">
                                <span class="post-author remote-handle">
                                    <NuxtImg v-if="entry.post.sourceIconUrl" class="avatar avatar-sm" :src="entry.post.sourceIconUrl" />
                                    <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                                    <span v-if="entry.post.sourceName" v-html="entry.post.sourceName"></span>
                                    <span v-else>{{ entry.post.sourceHandle }}</span>
                                </span>
                                <span class="datetime">{{ formatDate(entry.post.published) }}</span>
                            </div>
                        </div>
                        <a
                            class="remote-server-badge"
                            :href="`https://${remoteServerHost(entry.post.sourceActorUrl)}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            :title="remoteServerInfo[remoteServerHost(entry.post.sourceActorUrl)]?.name || remoteServerHost(entry.post.sourceActorUrl)"
                            :style="{ background: badgeBg(remoteServerHost(entry.post.sourceActorUrl)) }"
                            @click.stop
                        >
                            <img
                                v-if="badgeImgSrc(remoteServerHost(entry.post.sourceActorUrl))"
                                :src="badgeImgSrc(remoteServerHost(entry.post.sourceActorUrl))"
                                alt=""
                                @error="onBadgeImgError(badgeImgSrc(remoteServerHost(entry.post.sourceActorUrl)))"
                            />
                            <span v-else>{{ remoteServerHost(entry.post.sourceActorUrl)[0]?.toUpperCase() }}</span>
                        </a>
                    </div>
                </template>
            </div>
            <div v-else class="empty">게시물이 없습니다.</div>
            <button v-if="hasMoreToShow" class="load-more-btn" :disabled="loadingMore" @click="loadMore">
                {{ loadingMore ? '불러오는 중...' : '더보기' }}
            </button>
        </div>

        <!-- 글 작성 / 수정 -->
        <div v-else-if="currentView === 'create' || currentView === 'edit'" id="board-wrapper">
            <div class="create-form">
                <input v-model="newTitle" placeholder="제목" class="post-input" />
                <div class="editor-tabs">
                    <button class="editor-tab-btn" :class="{ active: postEditorTab === 'write' }" @click="postEditorTab = 'write'">작성</button>
                    <button class="editor-tab-btn" :class="{ active: postEditorTab === 'preview' }" @click="postEditorTab = 'preview'">미리보기</button>
                </div>
                <template v-if="postEditorTab === 'write'">
                    <div class="wiki-toolbar">
                        <button class="toolbar-btn" @click="insertPostMarkdown('**', '**')" title="굵게"><b>B</b></button>
                        <button class="toolbar-btn" @click="insertPostMarkdown('*', '*')" title="기울임"><i>I</i></button>
                        <button class="toolbar-btn" @click="insertPostMarkdown('## ', '')" title="제목">H</button>
                        <button class="toolbar-btn" @click="insertPostMarkdown('- ', '')" title="목록">•</button>
                        <div class="toolbar-emoji-wrap" ref="postEmojiWrapRef">
                            <button ref="postEmojiBtnRef" class="toolbar-btn" @click.stop="showPostEmojiPicker = !showPostEmojiPicker" title="이모지">
                                <i class="hgi hgi-stroke hgi-smile"></i>
                            </button>
                            <EmojiPicker
                                v-if="showPostEmojiPicker"
                                placement="bottom"
                                :anchor="postEmojiBtnRef"
                                @select="(e) => { insertPostMarkdown(e, ''); showPostEmojiPicker = false }"
                            />
                        </div>
                        <span class="toolbar-sep"></span>
                        <span class="toolbar-hint">마크다운 지원</span>
                    </div>
                    <textarea
                        ref="postEditorRef"
                        v-model="newContent"
                        placeholder="내용을 입력하세요... (마크다운 사용 가능)"
                        class="post-textarea wiki-textarea"
                    ></textarea>
                </template>
                <div v-else class="post-content md-content preview-pane" v-html="withCustomEmoji(String(marked.parse(newContent.trim() || '_미리볼 내용이 없습니다._', { breaks: true })))"></div>
                <button class="submit-btn" @click="submitPost" :disabled="!newTitle.trim() || !newContent.trim()">
                    {{ currentView === 'edit' ? '수정 완료' : '작성 완료' }}
                </button>
            </div>
        </div>

        <!-- 게시물 상세 -->
        <div v-else-if="currentView === 'detail' && currentPost" id="board-wrapper">
            <div class="post-detail">
                <div v-if="props.roomName" class="pd-room-tag">
                    <i class="hgi hgi-stroke hgi-grid"></i>
                    {{ props.roomName }}
                </div>
                <div class="post-title-large">{{ currentPost.title }}</div>
                <div class="post-meta">
                    <NuxtLink :to="currentPost.user?.username ? `/@${currentPost.user.username}` : '#'" class="post-author user-name-link">
                        <NuxtImg v-if="currentPost.user?.avatar" class="avatar avatar-sm" :src="currentPost.user.avatar" />
                        <div v-else class="avatar avatar-placeholder avatar-sm">{{ (currentPost.user?.knownas ?? currentPost.user?.username ?? '?')[0] }}</div>
                        {{ currentPost.user?.knownas ?? currentPost.user?.username }}
                    </NuxtLink>
                    <span class="datetime">{{ formatDate(currentPost.createdAt) }}</span>
                    <button class="like-btn" :class="{ liked: currentPost.isLiked }" @click="toggleLike">
                        ♥ {{ currentPost.likeCount }}
                    </button>
                    <span v-if="currentPost.boostCount" class="boost-count" title="fediverse 부스트"><i class="hgi hgi-stroke hgi-arrow-reload-horizontal"></i> {{ currentPost.boostCount }}</span>
                    <div class="post-meta-actions">
                        <div class="share-btn-wrap">
                            <button class="post-icon-btn" @click="sharePost" title="공유">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </button>
                            <span v-if="shareCopied" class="share-toast">링크 복사됨</span>
                        </div>
                        <button v-if="isOwnPost && !props.isFederated" class="post-icon-btn" @click="startEditPost" title="수정">
                            <i class="hgi hgi-stroke hgi-pencil-edit-02"></i>
                        </button>
                        <button v-if="isOwnPost" class="post-icon-btn danger" @click="showDeleteConfirm = true" title="삭제">
                            <i class="hgi hgi-stroke hgi-delete-02"></i>
                        </button>
                        <div v-if="!isOwnPost && userId" class="mute-action-wrap">
                            <button class="post-icon-btn" @click.stop="toggleMuteMenu({ userid: currentPost.userid })" title="뮤트">
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                            </button>
                            <div v-if="activeMuteKey === muteKeyFor({ userid: currentPost.userid })" class="mute-menu" @click.stop>
                                <button @click="confirmMute({ userid: currentPost.userid }, 'soft')">소프트 뮤트</button>
                                <button @click="confirmMute({ userid: currentPost.userid }, 'hard')">하드 뮤트</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="post-content md-content" v-html="withCustomEmoji(String(marked.parse(currentPost.content ?? '', { breaks: true })))"></div>

                <!-- 이모지 리액션 -->
                <div class="reactions-row">
                    <button
                        v-for="r in currentPost.reactions"
                        :key="r.emoji"
                        class="reaction-pill"
                        :class="{ reacted: r.reacted }"
                        @click="toggleReaction(r.emoji)"
                    >
                        <span v-html="withCustomEmoji(escapeHtml(r.emoji))"></span> {{ r.count }}
                    </button>
                    <div class="emoji-picker-wrap" ref="pickerWrapRef">
                        <button ref="reactionBtnRef" class="reaction-add-btn" @click.stop="showPicker = !showPicker">+</button>
                        <EmojiPicker v-if="showPicker" :anchor="reactionBtnRef" @select="(e) => { toggleReaction(e); showPicker = false }" />
                    </div>
                </div>

                <div class="comments-section">
                    <div class="comments-title">댓글 {{ currentPost.comments?.length ?? 0 }}</div>
                    <div v-for="comment in currentPost.comments" :key="comment.id" class="comment">
                        <div v-if="comment.muted === 'soft' && !revealedMuted[`comment-${comment.id}`]" class="remote-cw-gate">
                            <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 댓글입니다</div>
                            <button class="submit-btn" @click="revealedMuted[`comment-${comment.id}`] = true">그래도 보기</button>
                        </div>
                        <template v-else>
                            <div class="comment-meta">
                                <template v-if="comment.remoteActorHandle">
                                    <a :href="comment.remoteActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author" title="fediverse에서 온 답글">
                                        <NuxtImg v-if="comment.remoteActorIconUrl" class="avatar avatar-sm" :src="comment.remoteActorIconUrl" />
                                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                                        <span v-if="comment.remoteActorName" v-html="comment.remoteActorName"></span>
                                        <span v-else>{{ comment.remoteActorHandle }}</span>
                                        <span class="remote-handle">{{ comment.remoteActorHandle }}</span>
                                    </a>
                                </template>
                                <NuxtLink v-else :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="post-author user-name-link">
                                    <NuxtImg v-if="comment.user?.avatar" class="avatar avatar-sm" :src="comment.user.avatar" />
                                    <div v-else class="avatar avatar-placeholder avatar-sm">{{ (comment.user?.knownas ?? comment.user?.username ?? '?')[0] }}</div>
                                    {{ comment.user?.knownas ?? comment.user?.username }}
                                </NuxtLink>
                                <span class="datetime">{{ formatDate(comment.createdAt) }}</span>
                                <div
                                    v-if="userId && (comment.remoteActorHandle || comment.userid !== userId)"
                                    class="mute-action-wrap"
                                >
                                    <button
                                        class="post-icon-btn"
                                        @click.stop="toggleMuteMenu(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid })"
                                        title="뮤트"
                                    >
                                        <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                                    </button>
                                    <div
                                        v-if="activeMuteKey === muteKeyFor(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid })"
                                        class="mute-menu"
                                        @click.stop
                                    >
                                        <button @click="confirmMute(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid }, 'soft')">소프트 뮤트</button>
                                        <button @click="confirmMute(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid }, 'hard')">하드 뮤트</button>
                                    </div>
                                </div>
                            </div>
                            <div v-if="comment.remoteActorHandle" class="comment-body remote" v-html="comment.content"></div>
                            <div v-else class="comment-body" v-html="withCustomEmoji(escapeHtml(comment.content))"></div>
                        </template>
                    </div>
                    <div class="empty" v-if="!currentPost.comments?.length">댓글이 없습니다.</div>
                </div>

                <div class="comment-form">
                    <input v-model="commentContent" placeholder="댓글 작성..." class="post-input" @keydown.enter="submitComment" />
                    <button class="submit-btn" @click="submitComment" :disabled="!commentContent.trim()">작성</button>
                </div>
            </div>
        </div>

        <!-- 연합 팔로잉 피드 글 상세 (원격) -->
        <div v-else-if="currentView === 'remote-detail' && currentRemotePost" id="board-wrapper">
            <div class="post-detail">
                <div v-if="currentRemotePost.boostedByName || currentRemotePost.boostedByHandle" class="boost-banner">
                    <i class="hgi hgi-stroke hgi-arrow-reload-horizontal"></i>
                    <span v-if="currentRemotePost.boostedByName" v-html="currentRemotePost.boostedByName"></span><span v-else>{{ currentRemotePost.boostedByHandle }}</span>님이 재게시했습니다
                </div>
                <div class="post-meta">
                    <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author">
                        <NuxtImg v-if="currentRemotePost.sourceIconUrl" class="avatar avatar-sm" :src="currentRemotePost.sourceIconUrl" />
                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                        <span v-if="currentRemotePost.sourceName" v-html="currentRemotePost.sourceName"></span>
                        <span v-else>{{ currentRemotePost.sourceHandle }}</span>
                        <span class="remote-handle">{{ currentRemotePost.sourceHandle }}</span>
                    </a>
                    <span class="datetime">{{ formatDate(currentRemotePost.published) }}</span>
                    <div v-if="userId" class="mute-action-wrap">
                        <button class="post-icon-btn" @click.stop="toggleMuteMenu({ actorUrl: currentRemotePost.sourceActorUrl })" title="뮤트">
                            <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                        </button>
                        <div v-if="activeMuteKey === muteKeyFor({ actorUrl: currentRemotePost.sourceActorUrl })" class="mute-menu" @click.stop>
                            <button @click="confirmMute({ actorUrl: currentRemotePost.sourceActorUrl }, 'soft')">소프트 뮤트</button>
                            <button @click="confirmMute({ actorUrl: currentRemotePost.sourceActorUrl }, 'hard')">하드 뮤트</button>
                        </div>
                    </div>
                </div>

                <div v-if="currentRemotePost.summary && !showRemoteContent" class="remote-cw-gate">
                    <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="currentRemotePost.summary"></span></div>
                    <button class="submit-btn" @click="showRemoteContent = true">내용 보기</button>
                </div>
                <div v-else class="post-content md-content" v-html="currentRemotePost.content"></div>

                <div v-if="userId" class="post-meta">
                    <button class="like-btn" :class="{ liked: currentRemotePost.liked }" @click="toggleRemoteLike">
                        ♥ {{ currentRemotePost.liked ? '좋아요 취소' : '좋아요' }}
                    </button>
                </div>

                <a :href="currentRemotePost.sourceActorUrl" target="_blank" rel="noopener noreferrer" class="remote-original-link">
                    원 계정에서 보기 <i class="hgi hgi-stroke hgi-arrow-up-right-01"></i>
                </a>

                <div class="comments-section">
                    <div class="comments-title">댓글 {{ remoteReplies.length }}</div>
                    <div v-for="comment in remoteReplies" :key="comment.id" class="comment">
                        <div v-if="comment.muted === 'soft' && !revealedMuted[`reply-${comment.id}`]" class="remote-cw-gate">
                            <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 댓글입니다</div>
                            <button class="submit-btn" @click="revealedMuted[`reply-${comment.id}`] = true">그래도 보기</button>
                        </div>
                        <template v-else>
                            <div class="comment-meta">
                                <template v-if="comment.remoteActorHandle">
                                    <a :href="comment.remoteActorUrl" target="_blank" rel="noopener noreferrer" class="post-author remote-author" title="fediverse에서 온 답글">
                                        <NuxtImg v-if="comment.remoteActorIconUrl" class="avatar avatar-sm" :src="comment.remoteActorIconUrl" />
                                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                                        <span v-if="comment.remoteActorName" v-html="comment.remoteActorName"></span>
                                        <span v-else>{{ comment.remoteActorHandle }}</span>
                                        <span class="remote-handle">{{ comment.remoteActorHandle }}</span>
                                    </a>
                                </template>
                                <NuxtLink v-else :to="comment.user?.username ? `/@${comment.user.username}` : '#'" class="post-author user-name-link">
                                    <NuxtImg v-if="comment.user?.avatar" class="avatar avatar-sm" :src="comment.user.avatar" />
                                    <div v-else class="avatar avatar-placeholder avatar-sm">{{ (comment.user?.knownas ?? comment.user?.username ?? '?')[0] }}</div>
                                    {{ comment.user?.knownas ?? comment.user?.username }}
                                </NuxtLink>
                                <span class="datetime">{{ formatDate(comment.createdAt) }}</span>
                                <div
                                    v-if="userId && (comment.remoteActorHandle || comment.userid !== userId)"
                                    class="mute-action-wrap"
                                >
                                    <button
                                        class="post-icon-btn"
                                        @click.stop="toggleMuteMenu(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid })"
                                        title="뮤트"
                                    >
                                        <i class="hgi hgi-stroke hgi-volume-mute-01"></i>
                                    </button>
                                    <div
                                        v-if="activeMuteKey === muteKeyFor(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid })"
                                        class="mute-menu"
                                        @click.stop
                                    >
                                        <button @click="confirmMute(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid }, 'soft')">소프트 뮤트</button>
                                        <button @click="confirmMute(comment.remoteActorHandle ? { actorUrl: comment.remoteActorUrl } : { userid: comment.userid }, 'hard')">하드 뮤트</button>
                                    </div>
                                </div>
                            </div>
                            <div v-if="comment.remoteActorHandle" class="comment-body remote" v-html="comment.content"></div>
                            <div v-else class="comment-body" v-html="withCustomEmoji(escapeHtml(comment.content))"></div>
                        </template>
                    </div>
                    <div class="empty" v-if="!remoteReplies.length">댓글이 없습니다.</div>
                </div>

                <div v-if="userId" class="comment-form">
                    <input v-model="remoteReplyContent" placeholder="댓글(답글로 전달됨) 작성..." class="post-input" @keydown.enter="submitRemoteReply" />
                    <button class="submit-btn" @click="submitRemoteReply" :disabled="!remoteReplyContent.trim()">작성</button>
                </div>
                <div v-else class="empty" style="padding:8px 0">로그인 후 좋아요/댓글을 남길 수 있어요.</div>
            </div>
        </div>

        <!-- 삭제 확인 -->
        <div v-if="showDeleteConfirm" class="admin-confirm-overlay" @click.self="showDeleteConfirm = false">
            <div class="admin-confirm-box">
                <p class="admin-confirm-msg">이 글을 정말 삭제할까요?<br /><span style="font-size:0.82rem;opacity:0.55">삭제하면 되돌릴 수 없습니다.</span></p>
                <div class="admin-confirm-actions">
                    <button class="back-btn-header" @click="showDeleteConfirm = false">취소</button>
                    <button class="submit-btn danger-btn" @click="doDeletePost" :disabled="deletingPost">
                        {{ deletingPost ? '삭제 중...' : '삭제' }}
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { marked } from 'marked'
const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBaseUrl
const route = useRoute()
defineEmits(['close'])

const props = defineProps({
    ids: {
        type: Object,
        default: () => ({ serverid: 0, roomid: 0 }),
    },
    isFederated: {
        type: Boolean,
        default: false,
    },
    roomName: {
        type: String,
        default: '',
    },
})

const { userId } = useCurrentUser()

// 우리 서버 커스텀 이모지(:shortcode:) — 글/댓글/리액션 표시 시점에 치환
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
function withCustomEmoji(html) {
    return renderCustomEmojiText(html, customEmojiMap.value)
}

// 뮤트 — 소프트(내용 대신 "뮤트된 게시물입니다" 게이트, "그래도 보기"로 펼침) / 하드(서버가
// 애초에 응답에 안 실어주므로 프론트에서 따로 처리할 게 없음). 뮤트 건 사람 화면에만 영향.
const activeMuteKey = ref(null)
const revealedMuted = ref({})
function muteKeyFor(target) {
    return target.userid != null ? `local-${target.userid}` : `remote-${target.actorUrl}`
}
function toggleMuteMenu(target) {
    const key = muteKeyFor(target)
    activeMuteKey.value = activeMuteKey.value === key ? null : key
}
async function confirmMute(target, level) {
    if (!userId.value) return
    await $fetch(`${apiBaseUrl}/api/muteUser`, {
        method: 'POST',
        body: {
            userid: userId.value,
            targetUserId: target.userid ?? undefined,
            targetActorUrl: target.actorUrl ?? undefined,
            level,
        },
    }).catch(() => {})
    activeMuteKey.value = null
    await loadFirstPage()
    if (currentView.value === 'detail' && currentPost.value) await openPost(currentPost.value.id)
    if (currentView.value === 'remote-detail' && currentRemotePost.value) await refreshRemoteReplies()
}

// 게시판 글은 20개씩 페이지네이션 — 로컬 글/연합 팔로잉 피드 두 소스를 각각 페이징해서
// 합친 뒤 날짜순으로 정렬해 보여줌 ("더보기" 클릭 시 두 소스 모두 다음 페이지를 불러옴)
const PAGE_SIZE = 20

const localPosts = ref([])
const localOffset = ref(0)
const hasMoreLocal = ref(false)

const remotePosts = ref([])
const remoteOffset = ref(0)
const hasMoreRemote = ref(false)

const loadingMore = ref(false)

async function fetchLocalPage(offset) {
    const res = await $fetch(`${apiBaseUrl}/api/getPostsByRoomId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...props.ids, offset, viewerUserId: userId.value ?? null }),
    }).catch(() => null)
    return res && Array.isArray(res.posts) ? res : { posts: [], hasMore: false }
}

async function fetchRemotePage(offset) {
    if (!props.isFederated) return { posts: [], hasMore: false }
    const res = await $fetch(`${apiBaseUrl}/api/getRemoteFeedPosts`, {
        method: 'POST',
        body: { viewerUserId: userId.value ?? null, offset },
    }).catch(() => null)
    return res && Array.isArray(res.posts) ? res : { posts: [], hasMore: false }
}

async function loadFirstPage() {
    localOffset.value = 0
    remoteOffset.value = 0
    const [localRes, remoteRes] = await Promise.all([fetchLocalPage(0), fetchRemotePage(0)])
    localPosts.value = localRes.posts
    hasMoreLocal.value = localRes.hasMore
    remotePosts.value = remoteRes.posts
    hasMoreRemote.value = remoteRes.hasMore
}

async function loadMore() {
    if (loadingMore.value) return
    loadingMore.value = true
    try {
        const tasks = []
        if (hasMoreLocal.value) {
            const nextOffset = localOffset.value + PAGE_SIZE
            tasks.push(fetchLocalPage(nextOffset).then((res) => {
                localOffset.value = nextOffset
                localPosts.value = [...localPosts.value, ...res.posts]
                hasMoreLocal.value = res.hasMore
            }))
        }
        if (hasMoreRemote.value) {
            const nextOffset = remoteOffset.value + PAGE_SIZE
            tasks.push(fetchRemotePage(nextOffset).then((res) => {
                remoteOffset.value = nextOffset
                remotePosts.value = [...remotePosts.value, ...res.posts]
                hasMoreRemote.value = res.hasMore
            }))
        }
        await Promise.all(tasks)
    } finally {
        loadingMore.value = false
    }
}

const hasMoreToShow = computed(() => hasMoreLocal.value || hasMoreRemote.value)

await loadFirstPage()
// props.ids(roomid)도 감시해야 함 — 다른 게시판으로 넘어가도 이 컴포넌트가 언마운트되지 않고
// 재사용되는 경우(v-if 조건은 그대로 true인 채 부모의 roomData만 바뀌는 경우) roomid가 바뀌었는데
// 새로고침을 안 해서 이전 방 글이 계속 보이는 문제가 있었음
watch([() => route.params.page, () => props.isFederated, () => props.ids?.roomid, userId], loadFirstPage)

function stripHtml(html) {
    return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// 제목/미리보기 줄에서도 커스텀 이모지(:shortcode:)는 살리고 싶어서, 그 img 태그만 플레이스홀더로
// 빼놨다가 나머지 태그를 다 지운 뒤 다시 끼워넣음 — v-html로 렌더링해야 실제 이미지로 보임
function stripHtmlKeepEmoji(html) {
    if (!html) return ''
    const emojiTags = []
    const withPlaceholders = html.replace(/<img[^>]*class="[^"]*custom-emoji[^"]*"[^>]*>/g, (match) => {
        emojiTags.push(match)
        return ` EMOJI${emojiTags.length - 1} `
    })
    const stripped = withPlaceholders.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return stripped.replace(/ EMOJI(\d+) /g, (_, i) => emojiTags[Number(i)])
}

// 원격 글 작성자의 서버 뱃지 — actorUrl에서 호스트만 뽑아서 서버 홈으로 링크 연결
function remoteServerHost(actorUrl) {
    try { return new URL(actorUrl).host } catch { return '' }
}

// manifest.json에 theme_color가 없는 구현체(마스토돈 등)를 위한 대체 색 — 호스트 이름을
// 해시해 항상 같은 색이 나오게 해서 "그 서버만의" 색처럼 보이게 함
function remoteServerFallbackColor(host) {
    let hash = 0
    for (let i = 0; i < host.length; i++) hash = host.charCodeAt(i) + ((hash << 5) - hash)
    return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`
}
function badgeBg(host) {
    return remoteServerInfo.value[host]?.themeColor || remoteServerFallbackColor(host)
}

// 미스키(그리고 대체로 마스토돈)가 /manifest.json으로 내려주는 진짜 서버 이름/로고/테마색.
// 서버별로 한 번만 조회해서 캐싱 — 없거나 실패하면 null로 채워지고 해시색+파비콘으로 대체됨
const remoteServerInfo = ref({})
async function loadRemoteServerInfo(host) {
    if (!host || host in remoteServerInfo.value) return
    remoteServerInfo.value = { ...remoteServerInfo.value, [host]: null }
    const info = await $fetch(`${apiBaseUrl}/api/getRemoteServerInfo`, {
        method: 'POST',
        body: { host },
    }).catch(() => null)
    remoteServerInfo.value = { ...remoteServerInfo.value, [host]: info }
}

// 뱃지 이미지: manifest 아이콘 → 실패하면 favicon.ico → 그마저 실패하면 글자 뱃지로 폴백
const failedBadgeSrcs = ref(new Set())
function badgeImgSrc(host) {
    const iconUrl = remoteServerInfo.value[host]?.iconUrl
    if (iconUrl && !failedBadgeSrcs.value.has(iconUrl)) return iconUrl
    const favicon = `https://${host}/favicon.ico`
    if (!failedBadgeSrcs.value.has(favicon)) return favicon
    return null
}
function onBadgeImgError(src) {
    failedBadgeSrcs.value = new Set(failedBadgeSrcs.value).add(src)
}

const mergedFeed = computed(() => {
    const local = localPosts.value.map(p => ({ kind: 'local', sortDate: p.createdAt, post: p }))
    if (!props.isFederated) return local
    const remote = remotePosts.value.map(p => ({ kind: 'remote', sortDate: p.published, post: p }))
    return [...local, ...remote].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
})

watch(mergedFeed, (feed) => {
    for (const entry of feed) {
        if (entry.kind !== 'remote') continue
        const host = remoteServerHost(entry.post.sourceActorUrl)
        loadRemoteServerInfo(host)
    }
}, { immediate: true })

const currentView = ref('list')
const currentPost = ref(null)
const currentRemotePost = ref(null)
const showRemoteContent = ref(false)
const remoteReplies = ref([])
const remoteReplyContent = ref('')
const newTitle = ref('')
const newContent = ref('')
const commentContent = ref('')
const showPicker = ref(false)
const pickerWrapRef = ref(null)
const reactionBtnRef = ref(null)

const postEditorTab = ref('write')
const showPostEmojiPicker = ref(false)
const postEmojiWrapRef = ref(null)
const postEmojiBtnRef = ref(null)
const postEditorRef = ref(null)
function insertPostMarkdown(before, after) {
    const el = postEditorRef.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = newContent.value.slice(start, end)
    newContent.value = newContent.value.slice(0, start) + before + selected + after + newContent.value.slice(end)
    nextTick(() => {
        el.focus()
        el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
}

async function openPost(postid) {
    const data = await $fetch(`${apiBaseUrl}/api/getPostById`, {
        method: 'POST',
        body: { postid, userid: userId.value },
    })
    currentPost.value = data
    currentView.value = 'detail'
}

const isOwnPost = computed(() => !!currentPost.value?.userid && currentPost.value.userid === userId.value)

const shareCopied = ref(false)
async function sharePost() {
    if (!currentPost.value) return
    await navigator.clipboard.writeText(`${window.location.origin}/post/${currentPost.value.id}`)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 1500)
}

function goBack() {
    currentView.value = currentView.value === 'edit' && currentPost.value ? 'detail' : 'list'
}

function startEditPost() {
    if (!currentPost.value) return
    newTitle.value = currentPost.value.title
    newContent.value = currentPost.value.content
    postEditorTab.value = 'write'
    currentView.value = 'edit'
}

const showDeleteConfirm = ref(false)
const deletingPost = ref(false)

async function doDeletePost() {
    if (!currentPost.value || deletingPost.value) return
    deletingPost.value = true
    try {
        await $fetch(`${apiBaseUrl}/api/deletePost`, {
            method: 'POST',
            body: { postid: currentPost.value.id, userid: userId.value },
        })
        showDeleteConfirm.value = false
        currentPost.value = null
        await loadFirstPage()
        currentView.value = 'list'
    } finally {
        deletingPost.value = false
    }
}

async function openRemotePost(post) {
    currentRemotePost.value = post
    showRemoteContent.value = false
    remoteReplyContent.value = ''
    currentView.value = 'remote-detail'
    await refreshRemoteReplies()
}

async function refreshRemoteReplies() {
    if (!currentRemotePost.value) return
    remoteReplies.value = await $fetch(`${apiBaseUrl}/api/getRemoteFeedPostReplies`, {
        method: 'POST',
        body: { objectId: currentRemotePost.value.objectId, viewerUserId: userId.value ?? null },
    }).catch(() => [])
}

async function toggleRemoteLike() {
    if (!currentRemotePost.value) return
    const result = await $fetch(`${apiBaseUrl}/api/likeRemoteFeedPost`, {
        method: 'POST',
        body: { id: currentRemotePost.value.id, userid: userId.value },
    })
    currentRemotePost.value.liked = result.liked
}

async function submitRemoteReply() {
    if (!remoteReplyContent.value.trim() || !currentRemotePost.value) return
    const content = remoteReplyContent.value.trim()
    remoteReplyContent.value = ''
    const reply = await $fetch(`${apiBaseUrl}/api/replyToRemoteFeedPost`, {
        method: 'POST',
        body: {
            ...props.ids,
            userid: userId.value,
            remoteFeedPostId: currentRemotePost.value.id,
            content,
        },
    })
    remoteReplies.value = [...remoteReplies.value, reply]
}

async function submitPost() {
    if (!newTitle.value.trim() || !newContent.value.trim()) return
    if (currentView.value === 'edit' && currentPost.value) {
        const updated = await $fetch(`${apiBaseUrl}/api/editPost`, {
            method: 'POST',
            body: {
                postid: currentPost.value.id,
                userid: userId.value,
                title: newTitle.value.trim(),
                content: newContent.value.trim(),
            },
        })
        currentPost.value = { ...currentPost.value, ...updated }
        newTitle.value = ''
        newContent.value = ''
        await loadFirstPage()
        currentView.value = 'detail'
        return
    }
    await $fetch(`${apiBaseUrl}/api/createPost`, {
        method: 'POST',
        body: {
            ...props.ids,
            userid: userId.value,
            title: newTitle.value.trim(),
            content: newContent.value.trim(),
        },
    })
    newTitle.value = ''
    newContent.value = ''
    await loadFirstPage()
    currentView.value = 'list'
}

async function submitComment() {
    if (!commentContent.value.trim() || !currentPost.value) return
    const content = commentContent.value.trim()
    commentContent.value = ''
    await $fetch(`${apiBaseUrl}/api/createPost`, {
        method: 'POST',
        body: {
            ...props.ids,
            userid: userId.value,
            title: content.slice(0, 50),
            content,
            replyto: currentPost.value.id,
        },
    })
    await openPost(currentPost.value.id)
}

async function toggleReaction(emoji) {
    if (!currentPost.value) return
    const result = await $fetch(`${apiBaseUrl}/api/reactPost`, {
        method: 'POST',
        body: { postid: currentPost.value.id, userid: userId.value, emoji },
    })
    const existing = currentPost.value.reactions?.find(r => r.emoji === emoji)
    if (existing) {
        existing.reacted = result.reacted
        existing.count += result.reacted ? 1 : -1
        if (existing.count <= 0)
            currentPost.value.reactions = currentPost.value.reactions.filter(r => r.emoji !== emoji)
    } else if (result.reacted) {
        currentPost.value.reactions = [...(currentPost.value.reactions ?? []), { emoji, count: 1, reacted: true }]
    }
}

async function toggleLike() {
    if (!currentPost.value) return
    const result = await $fetch(`${apiBaseUrl}/api/likePost`, {
        method: 'POST',
        body: { postid: currentPost.value.id, userid: userId.value },
    })
    currentPost.value.isLiked = result.liked
    currentPost.value.likeCount += result.liked ? 1 : -1
}

onMounted(() => {
    ensureCustomEmojisLoaded()
    document.addEventListener('click', (e) => {
        // 이모지 피커는 <body>로 teleport돼서 wrap의 DOM 자손이 아니므로 따로 예외 처리해야 함
        if (e.target.closest('.emoji-picker-popover')) return
        if (pickerWrapRef.value && !pickerWrapRef.value.contains(e.target))
            showPicker.value = false
        if (postEmojiWrapRef.value && !postEmojiWrapRef.value.contains(e.target))
            showPostEmojiPicker.value = false
        if (!e.target.closest('.mute-action-wrap'))
            activeMuteKey.value = null
    })
})
</script>

<style>
#board-wrapper {
    padding: 20px 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.95rem;
}

/* 목록 (카드형) */
.board {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.post-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    background: rgba(var(--fg-rgb),0.03);
    border: 1px solid rgba(var(--fg-rgb),0.06);
    text-decoration: none;
    color: inherit;
}

.post-card:hover { background: rgba(var(--fg-rgb),0.06); border-color: rgba(var(--fg-rgb),0.12); }

/* .avatar(40px, RoomMap.vue 전역 스타일)와 동일한 우선순위(단일 클래스)라 로드 순서에 따라
   덮어써질 수 있어서, 확실히 이기도록 .avatar와 묶어 명시도를 높임 */
.avatar.avatar-sm { width: 18px; height: 18px; font-size: 0.5rem; border-width: 1px; }

.post-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
    font-size: 0.98rem;
    color: rgba(var(--fg-rgb),0.9);
}

.post-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
}

.external-post-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-left: 2px solid rgba(124,196,255,0.4); /* 서버 색 로딩 전 기본값 — 로딩되면 인라인 style로 덮어씀 */
}
.external-post-card .hgi-globe-02 { color: #7cc4ff; flex-shrink: 0; }

.external-post-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1;
}

.boost-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: rgba(var(--fg-rgb),0.5);
}
.boost-banner .hgi-arrow-reload-horizontal { color: #7cc4ff; }

.remote-server-badge {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: white;
    font-weight: 700;
    font-size: 0.9rem;
    text-decoration: none;
    transition: transform 0.1s;
}
.remote-server-badge:hover { transform: scale(1.06); }
.remote-server-badge img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cw-icon {
    color: #ffb454;
    flex-shrink: 0;
}

.preview-text {
    font-weight: 400;
    color: rgba(var(--fg-rgb),0.65);
}

.post-author {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
    font-weight: 700;
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
}

.datetime {
    font-size: 0.75rem;
    color: rgba(var(--fg-rgb),0.3);
    white-space: nowrap;
}

.empty {
    color: rgba(var(--fg-rgb),0.3);
    padding: 20px 0;
    font-size: 0.9rem;
}

.load-more-btn {
    margin: 12px auto 4px;
    display: block;
    background: rgba(var(--fg-rgb),0.05);
    border: 1px solid rgba(var(--fg-rgb),0.1);
    color: rgba(var(--fg-rgb),0.6);
    border-radius: 8px;
    padding: 8px 20px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
}
.load-more-btn:hover:not(:disabled) { background: rgba(var(--fg-rgb),0.1); }
.load-more-btn:disabled { opacity: 0.5; cursor: default; }

/* 헤더 버튼 (항상 악센트 색 헤더 위라 배경 밝기에 맞춰 자동 대비되는 --accent-fg-rgb 사용) */
.write-btn-header {
    margin-left: auto;
    background: rgba(var(--accent-fg-rgb),0.2);
    border: 1px solid rgba(var(--accent-fg-rgb),0.35);
    color: rgba(var(--accent-fg-rgb),1);
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
}

.write-btn-header:hover { background: rgba(var(--accent-fg-rgb),0.3); }

.back-btn-header {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(var(--accent-fg-rgb),0.8);
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    padding: 3px 6px;
}

.back-btn-header:hover { color: rgba(var(--accent-fg-rgb),1); }

.board-header-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.board-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.board-close-btn {
    margin-left: 0 !important;
}

/* 작성 폼 */
.create-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-grow: 1;
}

.post-input {
    /* input은 flex 자식일 때 기본값이 min-width:auto라서, 버튼과 한 줄에 나란히 있으면
       내용 크기 밑으로 안 줄어들고 좁은 화면에서 행 전체를 밀어버림 — 항상 줄어들 수 있게 함 */
    min-width: 0;
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    transition: border-color 0.15s, background 0.15s;
}

.post-input::placeholder { color: rgba(var(--fg-rgb),0.3); }

.post-input:focus {
    outline: none;
    border-color: var(--accent);
    background: rgba(var(--fg-rgb),0.1);
}

.post-textarea {
    min-width: 0;
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    min-height: 110px;
    flex-grow: 1;
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.85);
    transition: border-color 0.15s, background 0.15s;
}

.post-textarea::placeholder { color: rgba(var(--fg-rgb),0.3); }

.post-textarea:focus {
    outline: none;
    border-color: var(--accent);
    background: rgba(var(--fg-rgb),0.1);
}

.editor-tabs {
    display: flex;
    gap: 4px;
}

.editor-tab-btn {
    background: none;
    border: none;
    border-radius: 6px 6px 0 0;
    padding: 6px 12px;
    font-size: 0.85rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.45);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
}
.editor-tab-btn:hover { color: rgba(var(--fg-rgb),0.8); }
.editor-tab-btn.active {
    background: rgba(var(--fg-rgb),0.06);
    color: rgba(var(--fg-rgb),0.9);
    font-weight: 600;
}

.wiki-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(var(--fg-rgb),0.05);
    border: 1px solid rgba(var(--fg-rgb),0.1);
    border-radius: 8px 8px 0 0;
    border-bottom: none;
}

.toolbar-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    color: rgba(var(--fg-rgb),0.6);
    border-radius: 5px;
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
}
.toolbar-btn:hover {
    background: rgba(var(--fg-rgb),0.1);
    color: rgba(var(--fg-rgb),1);
}

.toolbar-sep {
    width: 1px;
    height: 18px;
    background: rgba(var(--fg-rgb),0.12);
    margin: 0 4px;
}

.toolbar-emoji-wrap {
    position: relative;
    display: flex;
}

.toolbar-hint {
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.25);
    margin-left: auto;
}

.wiki-textarea {
    border-radius: 0 0 8px 8px !important;
}

.preview-pane {
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    padding: 10px 14px;
    min-height: 110px;
    flex-grow: 1;
    background: rgba(var(--fg-rgb),0.03);
}

.submit-btn {
    align-self: flex-end;
    background-color: var(--accent);
    color: rgba(var(--accent-fg-rgb),1);
    border: 0;
    padding: 8px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
    transition: opacity 0.15s;
}

.submit-btn:hover { opacity: 0.88; }
.submit-btn:disabled { opacity: 0.35; cursor: default; }

/* 상세 */
.post-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.pd-room-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: fit-content;
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.4);
    text-decoration: none;
}

.post-title-large {
    font-size: 1.3rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.92);
    line-height: 1.4;
}

.post-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.08);
}

.post-meta-actions {
    display: flex;
    gap: 2px;
}

.post-icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    border-radius: 6px;
    color: rgba(var(--fg-rgb),0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
}
.post-icon-btn:hover { background: rgba(var(--fg-rgb),0.08); color: rgba(var(--fg-rgb),0.8); }
.post-icon-btn.danger:hover { background: rgba(192,16,42,0.12); color: #e0304a; }

.share-btn-wrap { position: relative; display: flex; }

.share-toast {
    position: absolute;
    bottom: 130%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 0.72rem;
    white-space: nowrap;
    pointer-events: none;
    animation: share-toast-fade 1.5s ease forwards;
}

@keyframes share-toast-fade {
    0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
}

.mute-action-wrap { position: relative; display: flex; }

.mute-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--surface-2);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 8px;
    box-shadow: var(--modal-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 20;
    white-space: nowrap;
}

.mute-menu button {
    background: none;
    border: none;
    padding: 8px 14px;
    font-size: 0.82rem;
    font-family: inherit;
    color: rgba(var(--fg-rgb),0.75);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
}
.mute-menu button:hover { background: rgba(var(--fg-rgb),0.07); }

.like-btn {
    background: none;
    border: 1px solid rgba(var(--fg-rgb),0.15);
    border-radius: 20px;
    padding: 2px 12px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    margin-left: auto;
    transition: all 0.15s;
    color: rgba(var(--fg-rgb),0.45);
}

.like-btn:hover { border-color: var(--accent); color: var(--accent); }

.like-btn.liked {
    background-color: var(--bgaccent);
    border-color: var(--accent);
    color: var(--accent);
}

.boost-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb),0.4);
}

.remote-author {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    text-decoration: none;
}

.remote-author:hover { text-decoration: underline; }

.remote-handle {
    font-weight: 400;
    color: rgba(var(--fg-rgb),0.35);
}

.remote-cw-gate {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    padding: 16px;
    border-radius: 10px;
    background: rgba(255,180,84,0.08);
    border: 1px solid rgba(255,180,84,0.25);
}

.remote-cw-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #ffb454;
}

.remote-original-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    margin-top: 8px;
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.4);
    text-decoration: none;
}
.remote-original-link:hover { color: rgba(var(--fg-rgb),0.7); text-decoration: underline; }

.post-content {
    line-height: 1.8;
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.82);
    overflow-wrap: break-word;
    word-break: break-word;
}

.post-content a,
.comment-body a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(var(--fg-rgb),0.25);
}

.post-content p { margin: 0.5em 0; }
.post-content p:first-child { margin-top: 0; }
.post-content p:last-child { margin-bottom: 0; }

.post-content blockquote {
    margin: 0.6em 0;
    padding: 2px 14px;
    border-left: 3px solid rgba(var(--fg-rgb),0.2);
    color: rgba(var(--fg-rgb),0.6);
    font-style: italic;
}
.post-content blockquote p { margin: 0.4em 0; }

.post-content img,
.comment-body img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    display: block;
    margin: 6px 0;
}

/* 리모트 커스텀 이모지(:shortcode:) — 본문 사진과 달리 글자 크기에 맞춰 인라인으로.
   제목/CW 줄(.post-card-title)에도 나오므로 특정 부모 클래스에 안 묶고 전역으로 잡음 */
img.custom-emoji {
    display: inline-block;
    width: 1.35em;
    height: 1.35em;
    max-width: 1.35em;
    border-radius: 0;
    margin: 0 0.05em;
    vertical-align: middle;
    transition: transform 0.15s ease;
}
img.custom-emoji:hover {
    transform: scale(1.8);
}

.comments-section { border-top: 1px solid rgba(var(--fg-rgb),0.08); padding-top: 4px; }

.comments-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: rgba(var(--fg-rgb),0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 0 6px;
}

.comment {
    padding: 8px 0;
    border-bottom: 1px solid rgba(var(--fg-rgb),0.06);
    font-size: 0.9rem;
}

.comment-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 2px;
    align-items: center;
}

.comment-body { color: rgba(var(--fg-rgb),0.7); white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; }
.comment-body.remote { white-space: normal; }
.comment-body.remote p { margin: 0.5em 0; }
.comment-body.remote p:first-child { margin-top: 0; }
.comment-body.remote p:last-child { margin-bottom: 0; }

.comment-form {
    display: flex;
    gap: 8px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--fg-rgb),0.08);
}

.comment-form .post-input { flex-grow: 1; }

/* 이모지 리액션 */
.reactions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 4px 0 8px;
}

.reaction-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(var(--fg-rgb),0.07);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    color: rgba(var(--fg-rgb),0.7);
    transition: all 0.1s;
}

.reaction-pill:hover {
    background: rgba(var(--fg-rgb),0.13);
    border-color: rgba(var(--fg-rgb),0.25);
}

.reaction-pill.reacted {
    background: var(--bgaccent);
    border-color: var(--accent);
    color: var(--accent);
}

.emoji-picker-wrap {
    position: relative;
}

.reaction-add-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px dashed rgba(var(--fg-rgb),0.2);
    background: none;
    color: rgba(var(--fg-rgb),0.4);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
}

.reaction-add-btn:hover {
    border-color: rgba(var(--fg-rgb),0.5);
    color: rgba(var(--fg-rgb),0.8);
}

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
