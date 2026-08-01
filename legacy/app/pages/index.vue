<template>

    <div class="parant-wrapper">
        <IndexHeader />
        <div class="imagebg">
            <div class="banner">
                <h1>여기에 모여라, 코코아츠</h1>
                <div>코코아츠는 사이버 부동산(?)에 여러분만의 커뮤니티를 구축할 수 있도록 도와주는 새로운 플랫폼입니다.</div>
                <div>사실 비싼 돈 주고 만들었던 코코아체를 이대로 남기기 아쉬워서 제작하고 있어요.</div>
            </div>
        </div>
        <div class="bgaccentbg">
            <div class="content-wrapper">
                <h2>새로운 메타버스</h2>
                <div>사실 그런 건 없습니다.</div>
            </div>
        </div>
        <div class="nobg">
            <div class="content-wrapper">
                <h2>코코아츠의 기능들</h2>
                <div class="sections-wrapper">
                    <div class="section-item">
                        <i class="hgi hgi-stroke hgi-comment-01"></i>
                        <div>커뮤니티를 구축하세요</div>
                    </div>
                    <div class="section-item">
                        <i class="hgi hgi-stroke hgi-bed-bunk"></i>
                        <div>아이템을 배치하세요</div>
                    </div>
                    <div class="section-item">
                        <i class="hgi hgi-stroke hgi-coins-01"></i>
                        <div>이것저것 하세요</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="accentbg">
            <div class="content-wrapper">
                <h2>출시 알림을 받아보세요.</h2>
                <div class="button">구글 폼 제출</div>
            </div>
        </div>
        <IndexFooter />
    </div>

</template>

<style scoped>

.banner {
    width: 100%;
    height: 100%;
    background-color: var(--bgbanner);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    font-size: 1.2rem;
    text-align: center;
}

.banner h1 {
    font-size: 4rem;
    line-height: 1;
}

.content-wrapper h2 {
    font-size: 3rem;
    margin-top: 0;
    border-bottom: 0;
}

.bgaccentbg h2 {
    color: var(--accent);
}

.imagebg {
    width: 100%;
    height: 50dvh;
    background-image: url('/bg.jpg');
    background-size: cover;
    background-position: center;
}

.nobg {
    width: 100%;
    height: 80dvh;
}

.accentbg {
    width: 100%;
    height: 80dvh;
    background-color: var(--accent);
    color: white;
}

.bgaccentbg {
    width: 100%;
    height: 80dvh;
    background-color: var(--bgaccent);
}

.content-wrapper {
    width: 100%;
    height: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 50px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-size: 1.2rem;
}

.sections-wrapper {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 30px;
}

.section-item {
    flex-grow: 1;
    background-color: var(--bgaccent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    border-radius: 20px;
    padding: 50px 10px;
}

.section-item i {
    font-size: 4rem;
    color: var(--accent);
}

.accentbg .button {
    background-color: white;
    color: var(--accent);
    padding: 10px 40px;
    font-size: 1.5rem;
    border-radius: 10px;
}

</style>