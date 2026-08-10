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
            <div v-if="mergedFeed.length && !galleryView" class="board">
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
                        <button v-if="entry.post.muted === 'soft'" class="cw-hide-btn" @click.stop="revealedMuted[`${entry.kind}-${entry.post.id}`] = false">
                            <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                        </button>
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
                                <span
                                    v-else
                                    class="preview-text"
                                    v-html="stripHtmlKeepEmoji(entry.post.content, entry.post.quoteUrl || entry.post.linkUrl, entry.post.quoteUrl ? '[인용]' : '[링크]')"
                                ></span>
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
                            <button v-if="entry.post.muted === 'soft'" class="cw-hide-btn" @click.stop="revealedMuted[`${entry.kind}-${entry.post.id}`] = false">
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                            </button>
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

            <!-- 갤러리 보기(관리자가 채널 관리에서 켠 게시판만) — 연합 게시판은 galleryView가 서버에서
                 애초에 true로 저장이 안 되니 여기 mergedFeed엔 항상 로컬 글만 있음(feedItems 참고) -->
            <div v-else-if="mergedFeed.length && galleryView" class="board-gallery">
                <template v-for="entry in mergedFeed" :key="`gal-${entry.post.id}`">
                    <div
                        v-if="entry.post.muted === 'soft' && !revealedMuted[`${entry.kind}-${entry.post.id}`]"
                        class="gallery-card gallery-card-muted"
                    >
                        <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트된 게시물입니다</div>
                        <button class="submit-btn" @click.stop="revealedMuted[`${entry.kind}-${entry.post.id}`] = true">그래도 보기</button>
                    </div>
                    <div v-else class="gallery-card" @click="openPost(entry.post.id)">
                        <div class="gallery-thumb">
                            <img v-if="postThumbnail(entry.post.content)" :src="postThumbnail(entry.post.content)" loading="lazy" />
                            <i v-else class="hgi hgi-stroke hgi-image-02"></i>
                        </div>
                        <div class="gallery-card-title">{{ entry.post.title }}</div>
                        <div class="gallery-card-meta">
                            <NuxtLink :to="entry.post.user?.username ? `/@${entry.post.user.username}` : '#'" class="post-author user-name-link" @click.stop>
                                <NuxtImg v-if="entry.post.user?.avatar" class="avatar avatar-sm" :src="entry.post.user.avatar" />
                                <div v-else class="avatar avatar-placeholder avatar-sm">{{ (entry.post.user?.knownas ?? entry.post.user?.username ?? '?')[0] }}</div>
                                {{ entry.post.user?.knownas ?? entry.post.user?.username }}
                            </NuxtLink>
                            <span class="datetime">{{ formatDate(entry.post.createdAt) }}</span>
                        </div>
                        <button v-if="entry.post.muted === 'soft'" class="cw-hide-btn" @click.stop="revealedMuted[`${entry.kind}-${entry.post.id}`] = false">
                            <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                        </button>
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
                <!-- 연합 게시판은 이메일 인증한 유저만 글을 쓸 수 있음 — 제출한 뒤에야 에러로 알게 되면
                     답답하니, 작성 화면에 들어오는 즉시 막혀있다는 걸 알리고 입력 자체를 비활성화함
                     (서버(createPost.ts)도 동일하게 막아주니 이건 UX용, 실제 방어는 서버 쪽) -->
                <p v-if="writeBlocked && currentView === 'create'" class="admin-error">
                    <i class="hgi hgi-stroke hgi-mail-validation-02"></i> 이 게시판은 이메일 인증을 완료한 계정만 글을 쓸 수 있어요.
                    <NuxtLink to="/preferences" style="color:inherit;text-decoration:underline">내 설정에서 인증하기</NuxtLink>
                </p>
                <input v-model="newTitle" placeholder="제목" class="post-input" :disabled="writeBlocked && currentView === 'create'" />
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
                        :disabled="writeBlocked && currentView === 'create'"
                    ></textarea>
                </template>
                <div v-else class="post-content md-content preview-pane" v-html="withCustomEmoji(String(marked.parse(newContent.trim() || '_미리볼 내용이 없습니다._', { breaks: true })))"></div>
                <p v-if="postError" class="admin-error">{{ postError }}</p>
                <button
                    class="submit-btn" @click="submitPost"
                    :disabled="!newTitle.trim() || !newContent.trim() || (writeBlocked && currentView === 'create')"
                >
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
                    <span v-if="likeError" class="admin-error" style="padding:4px 8px">{{ likeError }}</span>
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
                            <div v-if="comment.summary && !revealedCw[`comment-${comment.id}`]" class="remote-cw-gate">
                                <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="comment.summary"></span></div>
                                <button class="submit-btn" @click="revealedCw[`comment-${comment.id}`] = true">내용 보기</button>
                            </div>
                            <template v-else>
                                <div v-if="comment.remoteActorHandle" class="comment-body remote" v-html="stripLeadingMentions(comment.content)"></div>
                                <div v-else class="comment-body" v-html="withCustomEmoji(escapeHtml(comment.content))"></div>
                                <button v-if="comment.summary" class="cw-hide-btn" @click="revealedCw[`comment-${comment.id}`] = false">
                                    <i class="hgi hgi-stroke hgi-alert-02"></i> 다시 숨기기
                                </button>
                            </template>
                            <button v-if="comment.muted === 'soft'" class="cw-hide-btn" @click="revealedMuted[`comment-${comment.id}`] = false">
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                            </button>
                        </template>
                    </div>
                    <div class="empty" v-if="!currentPost.comments?.length">댓글이 없습니다.</div>
                </div>

                <p v-if="writeBlocked" class="admin-error">
                    <i class="hgi hgi-stroke hgi-mail-validation-02"></i> 이 게시판은 이메일 인증을 완료한 계정만 댓글을 쓸 수 있어요.
                    <NuxtLink to="/preferences" style="color:inherit;text-decoration:underline">내 설정에서 인증하기</NuxtLink>
                </p>
                <p v-if="commentError" class="admin-error">{{ commentError }}</p>
                <div class="comment-form">
                    <input v-model="commentContent" placeholder="댓글 작성..." class="post-input" :disabled="writeBlocked" @keydown.enter="submitComment" />
                    <button class="submit-btn" @click="submitComment" :disabled="!commentContent.trim() || writeBlocked">작성</button>
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
                <template v-else>
                    <div class="post-content md-content" v-html="stripEmbeddedLink(currentRemotePost.content, currentRemotePost.quoteUrl || currentRemotePost.linkUrl)"></div>
                    <button v-if="currentRemotePost.summary" class="cw-hide-btn" @click="showRemoteContent = false">
                        <i class="hgi hgi-stroke hgi-alert-02"></i> 다시 숨기기
                    </button>
                </template>

                <!-- 인용글 임베드 -->
                <a
                    v-if="quotedPost"
                    :href="quotedPost.objectId"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="quote-embed-card"
                >
                    <div class="quote-embed-header">
                        <NuxtImg v-if="quotedPost.sourceIconUrl" class="avatar avatar-sm" :src="quotedPost.sourceIconUrl" />
                        <i v-else class="hgi hgi-stroke hgi-globe-02"></i>
                        <span v-if="quotedPost.sourceName" v-html="quotedPost.sourceName"></span>
                        <span v-else>{{ quotedPost.sourceHandle }}</span>
                        <span class="remote-handle">{{ quotedPost.sourceHandle }}</span>
                    </div>
                    <div v-if="quotedPost.summary" class="quote-embed-body"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="quotedPost.summary"></span></div>
                    <div v-else class="quote-embed-body" v-html="quotedPost.content"></div>
                </a>
                <a
                    v-else-if="currentRemotePost.quoteUrl"
                    :href="currentRemotePost.quoteUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="quote-embed-card quote-embed-fallback"
                >
                    인용된 글 보기 <i class="hgi hgi-stroke hgi-arrow-up-right-01"></i>
                </a>

                <!-- 링크 미리보기 / 유튜브·사운드클라우드 임베드 -->
                <div v-else-if="linkPreview && (linkPreview.embedUrl || linkPreview.title || linkPreview.imageUrl)" class="link-preview-card">
                    <iframe
                        v-if="linkPreview.embedUrl && (linkPreview.kind === 'youtube' || linkPreview.kind === 'soundcloud')"
                        :src="linkPreview.embedUrl"
                        class="embed-iframe"
                        :class="linkPreview.kind"
                        frameborder="0"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                    ></iframe>
                    <a v-else :href="linkPreview.url" target="_blank" rel="noopener noreferrer" class="link-preview-body">
                        <NuxtImg v-if="linkPreview.imageUrl" :src="linkPreview.imageUrl" class="link-preview-image" />
                        <div class="link-preview-text">
                            <div v-if="linkPreview.title" class="link-preview-title">{{ linkPreview.title }}</div>
                            <div v-if="linkPreview.description" class="link-preview-desc">{{ linkPreview.description }}</div>
                            <div class="link-preview-site">{{ linkPreview.siteName || remoteServerHost(linkPreview.url) }}</div>
                        </div>
                    </a>
                </div>

                <div v-if="userId" class="post-meta">
                    <button class="like-btn" :class="{ liked: currentRemotePost.liked }" @click="toggleRemoteLike">
                        ♥ {{ currentRemotePost.liked ? '좋아요 취소' : '좋아요' }}
                    </button>
                    <span v-if="likeError" class="admin-error" style="padding:4px 8px">{{ likeError }}</span>
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
                            <div v-if="comment.summary && !revealedCw[`reply-${comment.id}`]" class="remote-cw-gate">
                                <div class="remote-cw-text"><i class="hgi hgi-stroke hgi-alert-02"></i> <span v-html="comment.summary"></span></div>
                                <button class="submit-btn" @click="revealedCw[`reply-${comment.id}`] = true">내용 보기</button>
                            </div>
                            <template v-else>
                                <div v-if="comment.remoteActorHandle" class="comment-body remote" v-html="stripLeadingMentions(comment.content)"></div>
                                <div v-else class="comment-body" v-html="withCustomEmoji(escapeHtml(comment.content))"></div>
                                <button v-if="comment.summary" class="cw-hide-btn" @click="revealedCw[`reply-${comment.id}`] = false">
                                    <i class="hgi hgi-stroke hgi-alert-02"></i> 다시 숨기기
                                </button>
                            </template>
                            <button v-if="comment.muted === 'soft'" class="cw-hide-btn" @click="revealedMuted[`reply-${comment.id}`] = false">
                                <i class="hgi hgi-stroke hgi-volume-mute-01"></i> 뮤트 다시 숨기기
                            </button>
                        </template>
                    </div>
                    <div class="empty" v-if="!remoteReplies.length">댓글이 없습니다.</div>
                </div>

                <template v-if="userId">
                    <p v-if="writeBlocked" class="admin-error">
                        <i class="hgi hgi-stroke hgi-mail-validation-02"></i> 이 게시판은 이메일 인증을 완료한 계정만 댓글을 쓸 수 있어요.
                        <NuxtLink to="/preferences" style="color:inherit;text-decoration:underline">내 설정에서 인증하기</NuxtLink>
                    </p>
                    <p v-if="remoteReplyError" class="admin-error">{{ remoteReplyError }}</p>
                    <div class="comment-form">
                        <input v-model="remoteReplyContent" placeholder="댓글(답글로 전달됨) 작성..." class="post-input" :disabled="writeBlocked" @keydown.enter="submitRemoteReply" />
                        <button class="submit-btn" @click="submitRemoteReply" :disabled="!remoteReplyContent.trim() || writeBlocked">작성</button>
                    </div>
                </template>
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
    // 관리자가 채널 관리에서 켠 값 — 유저가 직접 바꾸는 옵션이 아님. 연합 게시판은 서버에서
    // 애초에 true로 저장이 안 되니(setFederatedRoom.ts) 여기선 별도 방어 없이 그대로 믿고 씀
    galleryView: {
        type: Boolean,
        default: false,
    },
    roomName: {
        type: String,
        default: '',
    },
})

const { userId } = useCurrentUser()

// 연합 게시판은 이메일 인증한 유저만 글/댓글을 쓸 수 있음(createPost.ts가 최종 방어) — 여기선
// 작성 화면에 들어오자마자 막혀있다는 걸 미리 보여주고 입력 자체를 막기 위한 상태만 가져옴.
// 연합 게시판이 아니면 아예 관련 없는 값이니 fetch 자체를 안 함.
const { data: emailVerificationData } = await useAsyncData(
    'board-email-verification-status',
    () => (props.isFederated && userId.value)
        ? $fetch(`${apiBaseUrl}/api/getEmailVerificationStatus`, { method: 'POST', body: { userid: userId.value } })
        : Promise.resolve({ required: false, verified: true }),
    { watch: [userId] },
)
const writeBlocked = computed(() => {
    if (!props.isFederated) return false
    const d = emailVerificationData.value
    return !!d?.required && !d?.verified
})

// 우리 서버 커스텀 이모지(:shortcode:) — 글/댓글/리액션 표시 시점에 치환
const { map: customEmojiMap, ensureLoaded: ensureCustomEmojisLoaded } = useCustomEmojis()
function withCustomEmoji(html) {
    return renderCustomEmojiText(html, customEmojiMap.value)
}

// 뮤트 — 소프트(내용 대신 "뮤트된 게시물입니다" 게이트, "그래도 보기"로 펼침) / 하드(서버가
// 애초에 응답에 안 실어주므로 프론트에서 따로 처리할 게 없음). 뮤트 건 사람 화면에만 영향.
const activeMuteKey = ref(null)
const revealedMuted = ref({})
// CW(요약/스포일러) 공개 여부 — 댓글/답글 id별로 관리. 뮤트 게이트(revealedMuted)와 달리
// 한 번 보고 나서 다시 숨길 수도 있어야 해서 true/false를 왔다갔다하는 토글로 씀
const revealedCw = ref({})
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

// 연합 방은 새 통합 endpoint(getFederatedBoardFeed)로 로컬 글 + 서버 전체 연합 타임라인을
// 한 번에(UNION으로 정렬해서) 페이징함 — 예전엔 두 소스를 각자 offset/limit으로 따로 가져와서
// 프론트에서 합친 뒤 재정렬했는데, 원격(전체 서버 팔로잉 firehose)이 로컬(이 방 글만)보다 훨씬
// 촘촘해서 "각자 20개"를 합치면 로컬 글이 항상 그 배치의 오래된 쪽 끝에 몰려 보이는 문제가
// 있었음. 서버에서 진짜 최신 N개를 한 번에 잘라오면 이 문제 자체가 없어짐.
// 비연합 방은 그냥 로컬 글만(getPostsByRoomId) 페이징 — 기존과 동일.
const feedItems = ref([])  // [{ kind: 'local'|'remote', post }] — 서버가 이미 정렬해서 줌
const feedOffset = ref(0)
const hasMoreFeed = ref(false)
const loadingMore = ref(false)

async function fetchFeedPage(offset) {
    if (props.isFederated) {
        const res = await $fetch(`${apiBaseUrl}/api/getFederatedBoardFeed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...props.ids, offset, viewerUserId: userId.value ?? null }),
        }).catch(() => null)
        return res && Array.isArray(res.items) ? res : { items: [], hasMore: false }
    }
    const res = await $fetch(`${apiBaseUrl}/api/getPostsByRoomId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...props.ids, offset, viewerUserId: userId.value ?? null }),
    }).catch(() => null)
    const posts = res && Array.isArray(res.posts) ? res.posts : []
    return { items: posts.map((post) => ({ kind: 'local', post })), hasMore: res?.hasMore ?? false }
}

async function loadFirstPage() {
    feedOffset.value = 0
    const res = await fetchFeedPage(0)
    feedItems.value = res.items
    hasMoreFeed.value = res.hasMore
}

async function loadMore() {
    if (loadingMore.value || !hasMoreFeed.value) return
    loadingMore.value = true
    try {
        const nextOffset = feedOffset.value + PAGE_SIZE
        const res = await fetchFeedPage(nextOffset)
        feedOffset.value = nextOffset
        feedItems.value = [...feedItems.value, ...res.items]
        hasMoreFeed.value = res.hasMore
    } finally {
        loadingMore.value = false
    }
}

const hasMoreToShow = computed(() => hasMoreFeed.value)

// 연합 게시판 실시간 스트리밍 — 새 글/재게시가 도착하면(server/routes/_ws.ts의
// broadcastFederatedBoardPost) 목록을 다시 불러오지 않고 맨 앞에 바로 꽂아 넣음. 배열 전체를
// 히스토리로 재생하는 게 아니라 "바뀔 때마다 맨 뒤(방금 도착한 것)만" 보면 됨 — 히스토리 재생이
// 필요 없는 이유는 마운트 시점 이전 것들은 이미 loadFirstPage로 받아왔기 때문
const { federatedPostFeed } = useRoomSocket()
watch(federatedPostFeed, (feed) => {
    if (!props.isFederated || !feed.length) return
    const entry = feed[feed.length - 1]
    if (!entry?.post) return
    const alreadyThere = feedItems.value.some((e) => e.kind === entry.kind && e.post?.id === entry.post.id)
    if (alreadyThere) return
    feedItems.value = [entry, ...feedItems.value]
})

await loadFirstPage()
// props.ids(roomid)도 감시해야 함 — 다른 게시판으로 넘어가도 이 컴포넌트가 언마운트되지 않고
// 재사용되는 경우(v-if 조건은 그대로 true인 채 부모의 roomData만 바뀌는 경우) roomid가 바뀌었는데
// 새로고침을 안 해서 이전 방 글이 계속 보이는 문제가 있었음
watch([() => route.params.page, () => props.isFederated, () => props.ids?.roomid, userId], loadFirstPage)

function stripHtml(html) {
    return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// 갤러리 보기 썸네일 — 별도 썸네일 필드가 없어서 본문(마크다운) 안 첫 번째 이미지를 그대로 씀.
// 없으면 카드에 자리표시 아이콘만 보여줌(gallery-thumb-placeholder)
function postThumbnail(content) {
    const match = content?.match(/!\[[^\]]*\]\(([^)\s]+)/)
    return match ? match[1] : null
}

// 제목/미리보기 줄에서도 커스텀 이모지(:shortcode:)는 살리고 싶어서, 그 img 태그만 플레이스홀더로
// 빼놨다가 나머지 태그를 다 지운 뒤 다시 끼워넣음 — v-html로 렌더링해야 실제 이미지로 보임
// embedUrl(인용/링크 대상 URL)이 있으면 본문 속 그 <a href>를 통째로 작은 칩으로 바꿔서
// 목록 미리보기에 원본 URL이 그대로 노출되지 않게 함 — 본문에 그 링크가 안 보이는 경우(예:
// 인용 필드가 content 텍스트엔 안 들어있는 구현체)엔 칩을 미리보기 끝에 덧붙임
function stripHtmlKeepEmoji(html, embedUrl, embedLabel) {
    if (!html) return ''
    const emojiTags = []
    let processed = html.replace(/<img[^>]*class="[^"]*custom-emoji[^"]*"[^>]*>/g, (match) => {
        emojiTags.push(match)
        return ` EMOJI${emojiTags.length - 1} `
    })
    let chipInlined = false
    if (embedUrl) {
        const escaped = embedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // 미스키 등이 인용 링크 앞에 붙이는 "RE:" 표시도 칩으로 같이 치환(링크만 지우면 "RE:"만 남아 어색해짐)
        processed = processed.replace(new RegExp(`(?:RE:?\\s*)?<a\\s[^>]*href=["']${escaped}["'][^>]*>[\\s\\S]*?</a>`, 'i'), () => {
            chipInlined = true
            return ' EMBEDCHIP '
        })
    }
    const stripped = processed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    let result = stripped.replace(/ EMOJI(\d+) /g, (_, i) => emojiTags[Number(i)])
    if (embedUrl) {
        const chip = `<span class="preview-embed-chip">${embedLabel}</span>`
        result = chipInlined ? result.replace('EMBEDCHIP', chip) : (result ? `${result} ${chip}` : chip)
    }
    return result
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

// 서버가 이미 정렬해서 준 순서 그대로 씀 — 템플릿이 mergedFeed란 이름을 그대로 참조하고 있어서
// 이름만 유지(더 이상 여기서 다시 합치거나 정렬할 필요 없음)
const mergedFeed = computed(() => feedItems.value)

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
const quotedPost = ref(null)
const linkPreview = ref(null)
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
    quotedPost.value = null
    linkPreview.value = null
    await refreshRemoteReplies()
    loadEmbed(post)
}

// 인용글/링크 미리보기 — 목록에서는 배지만 보여주고, 상세 화면 열 때만 실제로 가져옴
async function loadEmbed(post) {
    if (post.quoteUrl) {
        quotedPost.value = await $fetch(`${apiBaseUrl}/api/getQuotedPost`, {
            method: 'POST',
            body: { quoteUrl: post.quoteUrl },
        }).catch(() => null)
    } else if (post.linkUrl) {
        linkPreview.value = await $fetch(`${apiBaseUrl}/api/getLinkPreview`, {
            method: 'POST',
            body: { url: post.linkUrl },
        }).catch(() => null)
    }
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
    likeError.value = ''
    let result
    try {
        result = await $fetch(`${apiBaseUrl}/api/likeRemoteFeedPost`, {
            method: 'POST',
            body: { id: currentRemotePost.value.id, userid: userId.value },
        })
    } catch (e) {
        likeError.value = e?.data?.message ?? '좋아요 처리에 실패했습니다'
        return
    }
    currentRemotePost.value.liked = result.liked
}

async function submitRemoteReply() {
    if (!remoteReplyContent.value.trim() || !currentRemotePost.value) return
    remoteReplyError.value = ''
    const content = remoteReplyContent.value.trim()
    try {
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
    } catch (e) {
        remoteReplyError.value = e?.data?.message ?? '댓글 작성에 실패했습니다'
        return
    }
    remoteReplyContent.value = ''
}

// 연합 게시판은 이메일 인증 안 한 유저가 글/댓글을 못 쓰게 서버(createPost.ts/replyToRemoteFeedPost.ts)에서
// 막아뒀는데, 예전엔 이 폼들에 에러 표시 자체가 없어서(성공이든 실패든 그냥 아무 반응 없어 보임) 새로 추가함
const postError = ref('')
const commentError = ref('')
const remoteReplyError = ref('')
const likeError = ref('')

async function submitPost() {
    if (!newTitle.value.trim() || !newContent.value.trim()) return
    postError.value = ''
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
    try {
        await $fetch(`${apiBaseUrl}/api/createPost`, {
            method: 'POST',
            body: {
                ...props.ids,
                userid: userId.value,
                title: newTitle.value.trim(),
                content: newContent.value.trim(),
            },
        })
    } catch (e) {
        postError.value = e?.data?.message ?? '글 작성에 실패했습니다'
        return
    }
    newTitle.value = ''
    newContent.value = ''
    await loadFirstPage()
    currentView.value = 'list'
}

async function submitComment() {
    if (!commentContent.value.trim() || !currentPost.value) return
    commentError.value = ''
    const content = commentContent.value.trim()
    try {
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
    } catch (e) {
        commentError.value = e?.data?.message ?? '댓글 작성에 실패했습니다'
        return
    }
    commentContent.value = ''
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
    likeError.value = ''
    let result
    try {
        result = await $fetch(`${apiBaseUrl}/api/likePost`, {
            method: 'POST',
            body: { postid: currentPost.value.id, userid: userId.value },
        })
    } catch (e) {
        likeError.value = e?.data?.message ?? '좋아요 처리에 실패했습니다'
        return
    }
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

/* 갤러리 보기 — 관리자가 채널 관리에서 켠 게시판만(연합 게시판은 지원 안 함). 2단 고정 그리드 +
   정사각형 썸네일 카드 */
.board-gallery {
    display: grid;
    /* 1fr는 기본적으로 minmax(auto,1fr)이라 트랙 최소폭이 content(특히 줄바꿈 없는 텍스트)의
       min-content로 정해짐 — 닉네임처럼 안 끊기는 텍스트가 있으면 카드가 화면보다 넓어져서
       모바일에서 가로 스크롤이 생겼음. minmax(0,1fr)로 최소폭을 0으로 못박아야 grid item 안의
       overflow:hidden/ellipsis가 실제로 트랙 폭 기준으로 작동함 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.gallery-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    background: rgba(var(--fg-rgb),0.03);
    border: 1px solid rgba(var(--fg-rgb),0.06);
    min-width: 0;
}

.gallery-card:hover { background: rgba(var(--fg-rgb),0.06); border-color: rgba(var(--fg-rgb),0.12); }

.gallery-card-muted {
    align-items: center;
    justify-content: center;
    text-align: center;
    aspect-ratio: 1;
    cursor: default;
    gap: 8px;
}

.gallery-thumb {
    aspect-ratio: 1;
    border-radius: 7px;
    overflow: hidden;
    background: rgba(var(--fg-rgb),0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    color: rgba(var(--fg-rgb),0.25);
}

.gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.gallery-card-title {
    font-weight: 600;
    font-size: 0.88rem;
    color: rgba(var(--fg-rgb),0.9);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.3;
}

.gallery-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-size: 0.72rem;
    color: rgba(var(--fg-rgb),0.45);
}

.gallery-card-meta .post-author {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    color: inherit;
    text-decoration: none;
}

.gallery-card-meta .datetime { flex-shrink: 0; }

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

.cw-hide-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 0;
    background: none;
    border: none;
    font-size: 0.78rem;
    font-family: inherit;
    color: #ffb454;
    cursor: pointer;
    opacity: 0.8;
}
.cw-hide-btn:hover { opacity: 1; text-decoration: underline; }

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

/* 목록 카드의 (인용)/(링크) 배지 */
/* 목록 미리보기 안에서 원본 URL 대신 보여주는 작은 칩 — 버튼/텍스트박스 같은 독립된 서식 */
.preview-embed-chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(var(--fg-rgb),0.08);
    border: 1px solid rgba(var(--fg-rgb),0.15);
    font-size: 0.78rem;
    font-weight: 600;
    color: rgba(var(--fg-rgb),0.55);
    vertical-align: middle;
}

/* 인용글 임베드 카드 — remote-cw-gate와 같은 톤(테두리+둥근 카드)이되 경고색 대신 중립색 */
.quote-embed-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(var(--fg-rgb),0.03);
    border: 1px solid rgba(var(--fg-rgb),0.12);
    text-decoration: none;
    color: inherit;
}
.quote-embed-card:hover { background: rgba(var(--fg-rgb),0.06); }
.quote-embed-fallback {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    color: rgba(var(--fg-rgb),0.5);
    font-size: 0.9rem;
}
.quote-embed-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 0.85rem;
    color: rgba(var(--fg-rgb),0.5);
}
.quote-embed-body {
    font-size: 0.9rem;
    line-height: 1.6;
    color: rgba(var(--fg-rgb),0.8);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
}

/* 링크 미리보기 카드 / 유튜브·사운드클라우드 임베드 */
.link-preview-card {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(var(--fg-rgb),0.12);
}
.link-preview-body {
    display: flex;
    text-decoration: none;
    color: inherit;
    background: rgba(var(--fg-rgb),0.03);
}
.link-preview-body:hover { background: rgba(var(--fg-rgb),0.06); }
.link-preview-image {
    width: 120px;
    height: 120px;
    object-fit: cover;
    flex-shrink: 0;
}
.link-preview-text {
    padding: 10px 14px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
}
.link-preview-title {
    font-weight: 700;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}
.link-preview-desc {
    font-size: 0.82rem;
    color: rgba(var(--fg-rgb),0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}
.link-preview-site {
    font-size: 0.76rem;
    color: rgba(var(--fg-rgb),0.35);
}
.embed-iframe {
    display: block;
    width: 100%;
    border: none;
}
.embed-iframe.youtube { aspect-ratio: 16 / 9; }
.embed-iframe.soundcloud { height: 166px; }

.post-content {
    line-height: 1.8;
    font-size: 0.95rem;
    color: rgba(var(--fg-rgb),0.82);
    overflow-wrap: break-word;
    word-break: break-word;
}

.post-content a,
.comment-body a,
.quote-embed-body a {
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
.comment-body img,
.quote-embed-body img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    display: block;
    margin: 6px 0;
}

/* 위 규칙(.post-content img 등)이 twemoji.client.ts가 유니코드 이모지 자리에 넣는 img.twemoji까지
   싹 걸어서 display:block으로 만들어버리는 바람에, 문장 중간의 이모지가 앞뒤 텍스트와 분리돼
   자기 혼자 한 줄을 차지해버리는 버그가 있었음 — 선택자 특이도를 올려서(3파트 vs 2파트) 다시
   인라인으로 되돌림. app.vue의 전역 img.twemoji 크기값과 동일하게 맞춤 */
.post-content img.twemoji,
.comment-body img.twemoji,
.quote-embed-body img.twemoji {
    display: inline;
    width: 1em;
    height: 1em;
    max-width: none;
    border-radius: 0;
    margin: 0 0.05em 0 0.1em;
    vertical-align: -0.1em;
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
