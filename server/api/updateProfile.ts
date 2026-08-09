import { db } from '../utils/db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { publishProfileUpdate } from '../utils/ap/publishProfileUpdate'
import { requireUserId } from '../utils/session'

export default eventHandler(async (event) => {
    const { knownas, bio, avatar, banner, requireFollowApproval } = await readBody(event)
    const userid = await requireUserId(event)
    if (!userid) throw createError({ statusCode: 400, message: '로그인이 필요합니다' })

    const [updated] = await db.update(users).set({
        ...(knownas !== undefined ? { knownas: knownas.trim() || null } : {}),
        ...(bio !== undefined ? { bio: bio.trim() || null } : {}),
        ...(avatar !== undefined ? { avatar: avatar.trim() || null } : {}),
        ...(banner !== undefined ? { banner: banner.trim() || null } : {}),
        ...(requireFollowApproval !== undefined ? { requireFollowApproval: !!requireFollowApproval } : {}),
    }).where(eq(users.id, Number(userid)))
    .returning({ username: users.username })

    // AP 액터 객체(Person)에 실제로 반영되는 필드(이름/소개/아바타/배너)가 바뀐 경우에만
    // 팔로워들에게 Update 액티비티를 보냄 — requireFollowApproval은 액터 객체에 안 실리는
    // 로컬 전용 값이라 굳이 알릴 필요 없음
    if (knownas !== undefined || bio !== undefined || avatar !== undefined || banner !== undefined) {
        const config = useRuntimeConfig()
        await publishProfileUpdate(Number(userid), config.domain as string)
            .catch((e) => console.error('[updateProfile] 연합 프로필 업데이트 배포 실패', e))
    }

    return { ok: true, username: updated.username }
})
