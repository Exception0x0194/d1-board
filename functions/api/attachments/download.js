import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const onRequestGet = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const r2Key = url.searchParams.get('key');
    if (!r2Key) {
        return new Response('Missing required query parameter: key.', { status: 400 });
    }
    try {
        const s3 = new S3Client({
            region: 'auto',
            endpoint: env.R2_S3_ENDPOINT,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY_ID,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            },
        });
        const bucketName = env.BUCKET_NAME;
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: r2Key,
        });
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return new Response(JSON.stringify({ presignedUrl }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (e) {
        console.error(e);
        return new Response('Internal Server Error: ' + e.message, { status: 500 });
    }
};
