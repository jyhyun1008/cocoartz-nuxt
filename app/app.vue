<script setup>
onMounted(() => useTheme().init())
</script>

<template>
  <NuxtLayout>
    <div id="app-wrapper">
      <NuxtPage />
    </div>
  </NuxtLayout>
  <VitePwaManifest />
</template>

<style>
@font-face {
    font-family: 'cocoartz';
    src: url('https://blog.howeverina.studio/font/Griun_Cocoartz-Rg.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
    ascent-override: 80%;
    descent-override: 20%;
}

@font-face {
    font-family: 'cocoartz';
    src: url('https://blog.howeverina.studio/font/Griun_DarkCocoartz-Rg.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
    ascent-override: 80%;
    descent-override: 20%;
}

:root {
    --accent: #D21F3C;
    --accent-hover: #b81a33;
    --accent-fg-rgb: 255,255,255;
    --mapbg: #888888;
    --bgaccent: #D21F3C22;
    --bgbanner: #00000077;
    --sidebar-bg: #1e1e26;
    --sidebar-bg2: #161619;
    --sidebar-text: rgba(255,255,255,0.6);
    --sidebar-text-hover: rgba(255,255,255,0.9);
    --modal-shadow: 0 24px 64px rgba(0,0,0,0.35);

    /* 컴포넌트 전반에서 rgba(255,255,255,X) 형태(텍스트/은은한 배경 겸용)로 하드코딩된 걸
       rgba(var(--fg-rgb),X)로 바꿔뒀음 — 이 값 하나만 뒤집으면 테마가 같이 뒤집힘.
       악센트(빨강) 헤더 위의 흰 텍스트/아이콘은 테마 무관하게 항상 밝아야 해서 대상에서 뺌 */
    --fg-rgb: 255,255,255;
    --page-bg: #14141a;
    --surface-0: #16161e;
    --surface-1: #1a1a22;
    --surface-1-blur: #1a1a22f0;
    --surface-2: #1e1e26;
    --surface-3: #1a1a2e;
    color-scheme: dark;
}

:root[data-theme="light"] {
    --mapbg: #c7cad0;
    --bgbanner: #ffffffcc;
    --sidebar-bg: #eef0f3;
    --sidebar-bg2: #e3e5e9;
    --sidebar-text: rgba(var(--fg-rgb),0.6);
    --sidebar-text-hover: rgba(var(--fg-rgb),0.9);
    --modal-shadow: 0 24px 64px rgba(0,0,0,0.12);

    --fg-rgb: 30,30,38;
    --page-bg: #f2f3f5;
    --surface-0: #f5f6f8;
    --surface-1: #ffffff;
    --surface-1-blur: #ffffffee;
    --surface-2: #eceef1;
    --surface-3: #e7e9ee;
    color-scheme: light;
}

* {
    box-sizing: border-box;
    font-family: 'cocoartz', sans-serif;
}

body {
    line-height: 1.8;
    margin: 0;
    background-color: var(--page-bg);
    transition: background-color 0.15s;
}

/* 공통 모달 헤더 */
.window-header {
    background-color: var(--accent);
    color: rgba(var(--accent-fg-rgb),1);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    height: 2.75rem;
    flex-shrink: 0;
    font-weight: 700;
    font-size: 0.95rem;
}

.window-close-btn {
    background: none;
    border: none;
    color: rgba(var(--accent-fg-rgb),0.7);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 6px;
    margin-left: auto;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.1s, background 0.1s;
}

/* 뒤로 버튼이 있을 때는 뒤로 버튼 쪽에서만 남는 공간을 밀어내고,
   닫기 버튼은 뒤로 버튼 바로 옆에 붙도록 함 (둘 다 margin-left:auto면 공간이 반으로 나뉘어 중간에 뜸) */
.back-btn-header + .window-close-btn {
    margin-left: 0;
}

.window-close-btn:hover {
    color: rgba(var(--accent-fg-rgb),1);
    background: rgba(var(--accent-fg-rgb),0.15);
}

/* 공통 모달 베이스 (다크) */
.modal-base {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 99;
    background-color: var(--surface-1-blur);
    backdrop-filter: blur(4px);
    color: rgba(var(--fg-rgb),0.85);
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: var(--modal-shadow);
    width: calc(100% - 100px);
    max-width: 800px;
    height: 60dvh;
}

/* 전역 스크롤바 (밝은 배경용) */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.35); }

/* 유저 프로필 링크 (채팅/게시판 등) */
.user-name-link {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
}
.user-name-link:hover { text-decoration: underline; opacity: 0.85; }

.user-avatar-link {
    display: contents;
    cursor: pointer;
}

/* 다크 모달 내부 스크롤바 */
.modal-base ::-webkit-scrollbar-thumb,
#infowindow-wrapper ::-webkit-scrollbar-thumb,
#voiceroom-wrapper ::-webkit-scrollbar-thumb,
#chatroom-wrapper.large ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }
.modal-base ::-webkit-scrollbar-thumb:hover,
#infowindow-wrapper ::-webkit-scrollbar-thumb:hover,
#voiceroom-wrapper ::-webkit-scrollbar-thumb:hover,
#chatroom-wrapper.large ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
</style>
