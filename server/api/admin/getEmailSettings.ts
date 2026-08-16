import { db } from '../../utils/db'
import { emailSettings } from '../../db/schema'
import { requirePermission } from '../../utils/permissions'

export default eventHandler(async (event) => {
    await requirePermission(event, 'accessAdminSettings')

    const [row] = await db.select().from(emailSettings).limit(1)
    if (!row) {
        return { smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPasswordSet: false, fromAddress: '', fromName: '', enabled: false }
    }

    // smtpPassword 원문은 절대 다시 클라이언트로 안 내려주고, 설정 여부만 알려줌
    const { smtpPassword, ...rest } = row
    return { ...rest, smtpPasswordSet: !!smtpPassword }
})
