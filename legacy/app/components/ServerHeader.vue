<template>
    <div id="header-wrapper">
        <div id="title-wrapper">
            <NuxtLink :to=fullPath id="title-link">
                <NuxtImg id="serveravatar" :src=props.avatar />
                <span>{{ props.title }}</span>
            </NuxtLink>
        </div>
        <div id="shortcut-wrapper">
            <div class="shoutcuts"><NuxtLink :to=infoPath><i class="hgi hgi-stroke hgi-information-square"></i></NuxtLink></div>
            <div class="shoutcuts"><NuxtLink :to=membersPath><i class="hgi hgi-stroke hgi-user-group"></i></NuxtLink></div>
            <div class="shoutcuts"><NuxtLink :to=settingsPath><i class="hgi hgi-stroke hgi-setting-07"></i></NuxtLink></div>
        </div>
        <div class="bycocoartz">
            <NuxtLink to="/">By COCOARTZ</NuxtLink>
        </div>
    </div>
</template>

<script setup>

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true
  },
  avatar: String
});

const fullPath = `/${props.slug}/`
const infoPath = fullPath + 'info'
const membersPath = fullPath + 'members'
const settingsPath = fullPath + 'settings'

</script>

<style>

#header-wrapper {
    padding: 0 20px;
    width: 100%;
    height: 3rem;
    display: flex;
    align-items: center;
    position: fixed;
    z-index: 9999;
    top: 0;
    left: 0;
    color: white;
    background-color: var(--accent);
}

#header-wrapper a {
    text-decoration: none;
    color: inherit;
    display: flex;
    gap: 10px;
    align-items: center;
}

#serveravatar {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 5px;
}

#title-wrapper {
    font-weight: 700;
    width: 300px;
    font-size: 1.2rem;
    overflow-x: hidden;
}

#shortcut-wrapper {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
}

.bycocoartz {
    font-size: 0.8rem;
}

</style>