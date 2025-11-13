<template>
    <div id="profile-bg">
        <div id="profile-wrapper">
            <div id="avatar-wrapper">
                <NuxtImg :src=i.avatar />
            </div>
            <div id="text-wrapper">
                <div class="knownas">{{ i.knownas }}</div>
                <div class="username">{{ i.username }}</div>
            </div>
            <div id="settings-wrapper">
                <i class="hgi hgi-stroke hgi-setting-07"></i>
            </div>
        </div>
    </div>
</template>

<script setup>
const config = useRuntimeConfig();
const apiBaseUrl = config.public.apiBaseUrl;
const route = useRoute();
const slug = route.params.slug

const session = {
    email: "howeverina@proton.me",
}

const { data: iData, error } = await useAsyncData(
    'i-data', async () => {

        const response = await $fetch(`${apiBaseUrl}/api/getUserByEmail`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: session.email
            }),
        })

        return response[0]
    }, {
        watch: [() => route.params.slug ]
    }
)

const i = iData.value

</script>

<style>

#profile-bg {
    background-color: white;
    width: 220px;
    position: fixed;
    bottom: 0;
    left: 0;
    border-top: 1px solid var(--accent);
}

#profile-wrapper {
    width: 220px;
    z-index: 999;
    display: flex;
    gap: 10px;
    padding: 10px 10px 0 10px;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bgaccent);
}

#avatar-wrapper img{
    width: 50px;
    height: 50px;
    object-fit: contain;
    object-position: center;
    border-radius: 50%;
    border: 3px solid var(--accent);
}

#text-wrapper {
    flex-grow: 1;
}

.knownas {
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
}

.username {
    font-size: 0.8rem;
}

</style>