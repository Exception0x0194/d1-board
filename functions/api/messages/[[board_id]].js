/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export async function onRequest(context) {
    const { request, env, params } = context;
    const db = env.DB;

    const boardId = params.board_id.join('/');
    if (!boardId) {
        return new Response('Missing board ID.', { status: 400 });
    }

    try {
        if (request.method === 'GET') {
            const stmt = db.prepare('SELECT id, board_id, content, created_at FROM board_messages WHERE board_id = ? ORDER BY created_at DESC');
            const { results } = await stmt.bind(boardId).all();

            // D1 返回的 BLOB 是 ArrayBuffer。我们需要将其转换为 Base64 才能放入 JSON。
            const messagesWithBase64Content = results.map(msg => ({
                ...msg,
                content: bufferToBase64(msg.content), // 将 ArrayBuffer 转换为 Base64
            }));

            return new Response(JSON.stringify(messagesWithBase64Content), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (request.method === 'POST') {
            // 检查 Content-Type，确保我们收到的是 gzip 压缩数据
            if (request.headers.get('content-type') !== 'application/gzip') {
                return new Response('Unsupported Media Type. Expecting application/gzip.', { status: 415 });
            }

            // 直接读取请求体为 ArrayBuffer
            const compressedContent = await request.arrayBuffer();

            if (!compressedContent || compressedContent.byteLength === 0) {
                return new Response('Missing message content.', { status: 400 });
            }

            // 将压缩后的 ArrayBuffer (BLOB) 直接存入数据库
            const stmt = db.prepare('INSERT INTO board_messages (board_id, content, created_at) VALUES (?, ?, ?)');
            await stmt.bind(boardId, compressedContent, new Date().toISOString()).run();

            return new Response('Message posted successfully!', { status: 201 });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (e) {
        console.error(e);
        return new Response('Internal Server Error: ' + e.message, { status: 500 });
    }
}
