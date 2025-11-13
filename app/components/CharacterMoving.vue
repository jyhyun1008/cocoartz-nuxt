<template>
    <div id="character-wrapper">
        <div id="character">
            <NuxtImg id="characterimg" :src=props.character />
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue';

const props = defineProps({
  character: String
});

onMounted(() => {

    var isodd = 0
    window.addEventListener('keydown', (e)=>{

        let interval = setInterval(() => {

            if (e.code == 'KeyS' && e.repeat === false) {
                if (isodd == 0) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:0; left:0;')
                    isodd = 1
                } else if (isodd == 1) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:0; left:-128px;')
                    isodd = 2
                } else if (isodd == 2) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:0; left:-256px;')
                    isodd = 3
                } else {
                    document.querySelector('#characterimg').setAttribute('style', 'top:0; left:-128px;')
                    isodd = 0
                }
            } else if (e.code == 'KeyW' && e.repeat === false) {
                if (isodd == 0) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-384px; left:0;')
                    isodd = 1
                } else if (isodd == 1) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-384px; left:-128px;')
                    isodd = 2
                } else if (isodd == 2) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-384px; left:-256px;')
                    isodd = 3
                } else {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-384px; left:-128px;')
                    isodd = 0
                }
            } else if (e.code == 'KeyD' && e.repeat === false) {
                if (isodd == 0) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-128px; left:0;')
                    isodd = 1
                } else if (isodd == 1) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-128px; left:-128px;')
                    isodd = 2
                } else if (isodd == 2) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-128px; left:-256px;')
                    isodd = 3
                } else {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-128px; left:-128px;')
                    isodd = 0
                }
            } else if (e.code == 'KeyA' && e.repeat === false) {
                if (isodd == 0) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-256px; left:0;')
                    isodd = 1
                } else if (isodd == 1) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-256px; left:-128px;')
                    isodd = 2
                } else if (isodd == 2) {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-256px; left:-256px;')
                    isodd = 3
                } else {
                    document.querySelector('#characterimg').setAttribute('style', 'top:-256px; left:-128px;')
                    isodd = 0
                }
            }
        }, 150);

        window.addEventListener('keyup', (e)=>{
            clearInterval(interval)
            document.querySelector('#characterimg').setAttribute('style', 'top:0; left:-128px;')
        })
    })
});


</script>

<style>
#character-wrapper {
    width: calc(100vw - 300px);
    height: calc(100dvh - 3rem);
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 9;
    display: flex;
    justify-content: center;
    align-items: center;
}

#character {
    position: relative;
    width: 128px;
    height: 128px;
    overflow: hidden;
}

#character img {
    position: absolute;
    aspect-ratio: 1;
    width: 384px;
    height: 512px;
    top:0;
    left: -128px;
}

</style>