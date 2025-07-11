/**
 * 处理 API 请求的 Worker
 * GET /api/messages/[board_id] - 获取留言
 * POST /api/messages/[board_id] - 新增留言
 */
export async function onRequest(context) {
    const { request, env, params } = context;
    const db = env.DB; // 从 context 中获取 D1 数据库绑定

    // 从路径参数中解析 board_id。因为是 [[board_id]]，所以它是一个数组。
    const boardId = params.board_id.join('/');
    if (!boardId) {
        return new Response('Missing board ID.', { status: 400 });
    }

    try {
        if (request.method === 'GET') {
            // 查询与 board_id 匹配的所有留言，并按时间倒序排列
            const stmt = db.prepare('SELECT * FROM board_messages WHERE board_id = ? ORDER BY created_at DESC');
            const { results } = await stmt.bind(boardId).all();

            return new Response(JSON.stringify(results), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (request.method === 'POST') {
            const { content } = await request.json();

            if (!content) {
                return new Response('Missing message content.', { status: 400 });
            }

            // 插入新留言
            const stmt = db.prepare('INSERT INTO board_messages (board_id, content, created_at) VALUES (?, ?, ?)');
            await stmt.bind(boardId, content, new Date().toISOString()).run();

            return new Response('Message posted successfully!', { status: 201 });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (e) {
        console.error(e);
        return new Response('Internal Server Error: ' + e.message, { status: 500 });
    }
}