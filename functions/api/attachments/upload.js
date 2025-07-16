import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const onRequestPost = async (context) => {
    const { request, env } = context;
    try {
        const { boardId, fileName, contentType } = await request.json();
        if (!boardId || !fileName || !contentType) {
            return new Response('Missing required fields: boardId, fileName, contentType.', { status: 400 });
        }
        const s3 = new S3Client({
            region: 'auto',
            endpoint: env.R2_S3_ENDPOINT,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY_ID,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            },
        });
        const r2Key = `board_attachments/${boardId}/${uuidv4()}/${fileName}`;
        const bucketName = env.BUCKET_NAME;
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: r2Key,
            ContentType: contentType,
        });
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return new Response(JSON.stringify({ presignedUrl, r2Key }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (e) {
        console.error(e);
        return new Response('Internal Server Error: ' + e.message, { status: 500 });
    }
};
