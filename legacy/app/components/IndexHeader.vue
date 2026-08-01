<template>
    <div id="index-header-wrapper">
        <div id="title-wrapper">
            <NuxtLink to="/" id="title-link">
                <span>COCOARTZ</span>
            </NuxtLink>
        </div>
        <div id="shortcut-wrapper">
            <div class="shoutcuts"><NuxtLink to="/">소개</NuxtLink></div>
            <div class="shoutcuts"><NuxtLink to="/">문서</NuxtLink></div>
            <div class="shoutcuts"><NuxtLink to="/">개발 블로그</NuxtLink></div>
        </div>
        <div id="login-info-wrapper">
            로그인
        </div>
    </div>
</template>

<script setup>
</script>

<style>

#index-header-wrapper {
    padding: 0 20px;
    width: 100%;
    height: 5rem;
    display: flex;
    align-items: center;
    color: white;
    background-color: var(--accent);
    gap: 4rem;
    font-size: 1.2rem;
}

#index-header-wrapper a {
    text-decoration: none;
    color: inherit;
    display: flex;
    gap: 10px;
    align-items: center;
}

#title-wrapper {
    font-weight: 700;
    width: 300px;
    font-size: 1.2rem;
    overflow-x: hidden;
}

#index-header-wrapper #shortcut-wrapper {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2rem;
}

#login-info-wrapper {
    display: flex;
    justify-content: flex-end;
    gap: 2rem;
}

</style>