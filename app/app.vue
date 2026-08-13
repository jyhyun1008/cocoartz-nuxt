<script setup>
// nuxt.config.ts의 app.head.htmlAttrs.lang(정적, 빌드 시점에 굳음)과 달리 이건 런타임 설정
// (config.public.locale, NUXT_PUBLIC_LOCALE로 배포 시점에 덮어씀)을 반영해야 해서 여기서
// 따로 다시 세팅함 — 안 그러면 언어를 바꿔도 <html lang>은 항상 "ko"로 굳어있어서, 브라우저가
// 시스템 폰트의 CJK 한자를 엉뚱한 지역(한국식) 자형으로 그려버림
const config = useRuntimeConfig()
useHead({ htmlAttrs: { lang: config.public.locale } })

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
/* 한국어/라틴 문자용 — 예전엔 'cocoartz' 하나로 일본어 폰트까지 unicode-range로 묶여있었는데,
   같은 family 이름 아래 여러 실제 폰트 파일이 걸리니까 브라우저가 line-height(strut) 계산에
   쓸 대표 메트릭을 헷갈려하면서 ascent/descent-override가 안 먹히는 것처럼 보였음.
   family를 언어별로 쪼개서 각자 자기 override만 확실히 적용받게 함 */
@font-face {
    font-family: 'cocoartz-kr';
    src: url('https://blog.howeverina.studio/font/Griun_Cocoartz-Rg.woff2') format('woff2');
    unicode-range: U+AC00-D7A3, U+1100-11FF, U+3130-318F, U+0020-007E;
    font-weight: 400;
    font-display: swap;
    ascent-override: 80%;
    descent-override: 20%;
}

@font-face {
    font-family: 'cocoartz-kr';
    src: url('https://blog.howeverina.studio/font/Griun_DarkCocoartz-Rg.woff2') format('woff2');
    unicode-range: U+AC00-D7A3, U+1100-11FF, U+3130-318F, U+0020-007E;
    font-weight: 700;
    font-display: swap;
    ascent-override: 80%;
    descent-override: 20%;
}

/* 일본어용 */
@font-face {
    font-family: "cocoartz-jp"; src:
    url("https://raw.githubusercontent.com/jyhyun1008/font/main/ZenMaruGothic-Medium.ttf") format("truetype");
    font-weight: 400;
    font-display: swap;
    unicode-range: U+3000-303F, U+3040-309F, U+30A0-30FF, U+FF00-FFEF, U+4E00-9FAF;
    ascent-override: 80%;
    descent-override: 20%;
}

@font-face {
    font-family: "cocoartz-jp";
    src: url("https://raw.githubusercontent.com/jyhyun1008/font/main/ZenMaruGothic-Bold.ttf") format("truetype");
    font-weight: 700;
    font-display: swap;
    unicode-range: U+3000-303F, U+3040-309F, U+30A0-30FF, U+FF00-FFEF, U+4E00-9FAF;
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
    font-family: 'cocoartz-kr', 'cocoartz-jp', sans-serif;
}

body {
    line-height: 1.8;
    margin: 0;
    /* 안쪽 어딘가에서 요소가 뷰포트보다 넓어져도(모바일에서 특히) 페이지 전체가 옆으로
       스크롤되면서 내용이 화면 밖으로 밀려나 보이는 걸 막는 안전장치 — 넓은 콘텐츠는
       각자의 컨테이너 안에서만 스크롤돼야 함 */
    overflow-x: hidden;
    background-color: var(--page-bg);
    transition: background-color 0.15s;
    /* 모바일 사파리가 v-if로 숨겼다 다시 보여지는 텍스트(목록↔상세 전환 등)의 폰트 크기를
       자기 나름대로 "읽기 편하게" 자동 확대(text size adjust)하면서, 같은 목록 안에서도
       요소마다 다르게 계산돼 들쭉날쭉해지는 문제가 있음 — 자동 조정을 꺼서 항상 지정한 크기 그대로 표시 */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
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

/* 모바일에서는 좌우 여백을 줄여서 화면 폭을 최대한 활용하고(조이스틱과 겹칠 일이 없는
   큰 모달들이라 그냥 넓혀도 됨 — 겹칠 수 있는 채팅 작은창은 RoomMap.vue에서 별도 처리),
   위아래로도 길게 늘여서 작은창의 아래쪽 선(bottom:14px)과 맞춤 */
@media (max-width: 768px) {
    .modal-base {
        left: 12px;
        right: 12px;
        top: 12px;
        bottom: 14px;
        transform: none;
        width: auto;
        max-width: none;
        height: auto;
    }
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

/* twemoji.client.ts가 유니코드 이모지 자리에 삽입하는 이미지 — 글자 크기에 맞춰 인라인으로 보이게 함 */
img.twemoji {
    height: 1em;
    width: 1em;
    margin: 0 0.05em 0 0.1em;
    vertical-align: -0.1em;
}
</style>
