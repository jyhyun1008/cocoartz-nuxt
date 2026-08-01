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
