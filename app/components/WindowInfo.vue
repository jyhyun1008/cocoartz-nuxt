<template>
    <div id ="page-wrapper" class="large">
        <div id="enlarge"><i class="hgi hgi-stroke hgi-arrow-diagonal"></i></div>
        <div id="info-wrapper">
            <h1>일단 뭐라도 적어보기</h1>
            <p>이 서버는... 왜 갑자기 여기는 글씨가 작아졌을까요 하하허허 아니네...</p>
        </div>
    </div>
</template>

<script setup>

onMounted(() => {
    document.querySelector('#map').classList.add('blur')
})

</script>

<style>

#info-wrapper {
    padding: 20px;
    font-size: 18px;
}

#info-wrapper h1 {
    margin-top: 0;
    color: var(--accent);
}

</style>