import { db } from './db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from './session'
import type { H3Event } from 'h3'

// isAdmin(전체 관리자, boolean) 하나뿐이던 권한 체계에, isAdmin이 아니어도 관리자가 콕 집어
// 부여할 수 있는 세부 권한을 추가함(users.permissions, JSON 문자열 배열). isAdmin=true인 유저는
// 이 배열과 무관하게 아래 모든 키를 항상 가진 것으로 취급함(하위호환 — 기존 관리자는 그대로 전부 가능).
export const PERMISSION_KEYS = [
    // 본인 글이 아니어도 게시판/위키 글·댓글을 삭제/수정할 수 있음(deletePost.ts/editPost.ts)
    'deletePosts',
    // rooms.isAnnouncement=true인 공지게시판에 글을 쓸 수 있음(createPost.ts)
    'postAnnouncements',
    // 유저 정지/영구정지/차단 해제(suspendUser.ts 등 4종)
    'moderateUsers',
    // 상점/맵/서버 설정 등 관리자 설정 페이지(WindowSettings.vue) 전체 접근 — server/api/admin/*.ts
    'accessAdminSettings',
] as const

export type PermissionKey = typeof PERMISSION_KEYS[number]

function parsePermissions(raw: string | null): PermissionKey[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((k): k is PermissionKey => PERMISSION_KEYS.includes(k)) : []
    } catch {
        return []
    }
}

// userId가 주어진 권한(들) 중 하나라도 가졌는지 — isAdmin이면 무조건 true.
// keys를 배열로 주면 "그중 하나라도 있으면" 판정(예: 정지 기능은 moderateUsers 또는 accessAdminSettings 둘 중 하나만 있어도 됨)
export async function hasPermission(userId: number, keys: PermissionKey | PermissionKey[]): Promise<boolean> {
    const [user] = await db.select({ isAdmin: users.isAdmin, permissions: users.permissions }).from(users).where(eq(users.id, userId))
    if (!user) return false
    if (user.isAdmin) return true
    const granted = parsePermissions(user.permissions)
    const wanted = Array.isArray(keys) ? keys : [keys]
    return wanted.some((k) => granted.includes(k))
}

// admin/*.ts 엔드포인트에서 쓰는 공용 게이트 — 로그인 확인 + 권한 확인을 한 번에.
// 통과하면 userId를 돌려줌(엔드포인트가 그 뒤에 또 쓸 수 있게).
export async function requirePermission(event: H3Event, keys: PermissionKey | PermissionKey[]): Promise<number> {
    const userId = await requireUserId(event)
    if (!(await hasPermission(userId, keys))) {
        throw createError({ statusCode: 403, message: '권한이 없습니다' })
    }
    return userId
}

// 진짜 전체 관리자(isAdmin)만 — accessAdminSettings 권한 보유자로는 대체 불가.
// updateUserPermissions.ts 전용: accessAdminSettings 보유자가 이 엔드포인트까지 쓸 수 있으면
// 자기 자신이나 남에게 권한을 더 얹어서(자기 자신에게 moderateUsers를 주는 등) 권한을 스스로
// 확장할 수 있어버림 — 권한을 "부여하는" 행위 자체는 진짜 관리자만 하게 좁혀둠.
export async function requireAdmin(event: H3Event): Promise<number> {
    const userId = await requireUserId(event)
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId))
    if (!user?.isAdmin) throw createError({ statusCode: 403, message: '관리자 권한이 필요합니다' })
    return userId
}
