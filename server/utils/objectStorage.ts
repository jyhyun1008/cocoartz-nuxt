import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createId } from '@paralleldrive/cuid2'

const EXT_BY_MIME: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
}

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_MIME)
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

export function isObjectStorageConfigured(): boolean {
    const s3 = useRuntimeConfig().s3
    return !!(s3.bucket && s3.accessKeyId && s3.secretAccessKey && s3.publicUrlBase)
}

function getClient() {
    const s3 = useRuntimeConfig().s3
    return new S3Client({
        region: s3.region,
        endpoint: s3.endpoint || undefined,
        forcePathStyle: s3.forcePathStyle,
        credentials: {
            accessKeyId: s3.accessKeyId,
            secretAccessKey: s3.secretAccessKey,
        },
    })
}

export async function uploadImage(buffer: Buffer, contentType: string, prefix: string): Promise<string> {
    const s3 = useRuntimeConfig().s3
    const ext = EXT_BY_MIME[contentType]
    if (!ext) throw createError({ statusCode: 400, message: '지원하지 않는 이미지 형식입니다' })

    const key = `${prefix}/${createId()}.${ext}`
    await getClient().send(new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }))

    return `${s3.publicUrlBase.replace(/\/$/, '')}/${key}`
}

// 게시판/위키 본문에 첨부하는 일반 파일 — 이미지 전용인 uploadImage와 달리 문서/압축파일/음원 등
// 폭넓은 확장자를 받되, 실행/스크립트 파일(.exe/.sh/.html 등)처럼 위험하거나 브라우저가 그대로
// 실행할 수 있는 형식은 막음. content-type을 신뢰하지 않고 파일명 확장자 기준으로 판단함
// (브라우저가 보내는 MIME은 파일마다 들쭉날쭉해서 안 맞는 경우가 많음).
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
    'png', 'jpg', 'jpeg', 'webp', 'gif', // 이미지 — 게시판/위키에서 마크다운 인라인으로도 그대로 씀
    'pdf', 'txt', 'md', 'csv',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip',
    'mp3', 'wav', 'ogg',
    'mp4', 'webm',
]
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024 // 20MB

export function attachmentExtOf(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    return ext
}

export async function uploadAttachment(buffer: Buffer, filename: string, contentType: string, prefix: string): Promise<string> {
    const s3 = useRuntimeConfig().s3
    const ext = attachmentExtOf(filename)
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        throw createError({ statusCode: 400, message: `지원하지 않는 파일 형식입니다(.${ext})` })
    }

    const key = `${prefix}/${createId()}.${ext}`
    await getClient().send(new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: buffer,
        // 파일명 확장자로만 판단하고 실제 전송은 브라우저가 보낸 content-type 그대로 씀 —
        // 없으면(일부 브라우저/확장자) 다운로드 시 무난하게 처리되는 기본값으로 폴백
        ContentType: contentType || 'application/octet-stream',
    }))

    return `${s3.publicUrlBase.replace(/\/$/, '')}/${key}`
}
