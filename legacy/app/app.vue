<template>
  <NuxtLayout>
    <div id="app-wrapper">
      <NuxtPage />
    </div>
  </NuxtLayout>
</template>

<style>

@font-face {
    font-family: 'HancomMalrangmalrang';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2406-1@1.0/HancomMalangMalang-Regular.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
}

@font-face {
    font-family: 'HancomMalrangmalrang';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2406-1@1.0/HancomMalangMalang-Bold.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
}

@font-face {
    font-family: 'cocoartz';
    src: url('https://blog.howeverina.studio/font/cocoartz.woff') format('woff');
    font-weight: 400;
    font-display: swap;
    ascent-override: 80%;  /* 위쪽 여백 줄이기 */
    descent-override: 20%; /* 아래쪽 여백 늘리기 */
}

@font-face {
    font-family: 'cocoartz';
    src: url('https://blog.howeverina.studio/font/cocoartz_b.woff') format('woff');
    font-weight: 700;
    font-display: swap;
    ascent-override: 80%;  /* 위쪽 여백 줄이기 */
    descent-override: 20%; /* 아래쪽 여백 늘리기 */
}

:root {
  --accent: #D21F3c;
  --mapbg: gray;
  --bgaccent: #D21F3c22;
  --bgbanner: #00000077;
}

* {
  box-sizing: border-box;
    font-family: 'cocoartz';
}

body {
  line-height: 1.8;
    margin: 0 !important;
}
</style>