import nodemailer from 'nodemailer'
import { db } from './db'
import { emailSettings } from '../db/schema'

type MailInput = {
    to: string
    subject: string
    text: string
    html?: string
}

type MailResult = { ok: boolean; error?: string }

async function getSettings() {
    const [row] = await db.select().from(emailSettings).limit(1)
    return row ?? null
}

// 회원가입/승인 알림처럼 "메일이 안 가도 그 자체 기능은 정상 동작해야 하는" 흐름에서 쓰라고
// 절대 throw하지 않음 — 설정이 안 됐거나 SMTP 전송이 실패해도 { ok:false, error } 로만 알려줌
export async function sendMail({ to, subject, text, html }: MailInput): Promise<MailResult> {
    const settings = await getSettings()
    if (!settings?.enabled || !settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
        return { ok: false, error: '이메일 설정이 완료되지 않았습니다' }
    }

    try {
        const transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort ?? 587,
            secure: settings.smtpSecure,
            auth: { user: settings.smtpUser, pass: settings.smtpPassword },
        })
        const from = settings.fromName
            ? `"${settings.fromName}" <${settings.fromAddress || settings.smtpUser}>`
            : (settings.fromAddress || settings.smtpUser)
        await transporter.sendMail({ from, to, subject, text, html })
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}
