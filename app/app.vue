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

:root {
  --accent: #FA4E79;
  --bgaccent: #FA4E7922;
}

* {
  box-sizing: border-box;
  font-family: 'HancomMalrangmalrang';
}

body {
  line-height: 1.8;
}

h1, h2, h3 {
  border-bottom: 1px solid #00000022;
}

</style>