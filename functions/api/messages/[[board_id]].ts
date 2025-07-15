import { z } from 'zod';

// Zod schema for validating the request body when posting a message
const PostBodySchema = z.object({
    content: z.string().min(1, 'Message content cannot be empty.'),
    attachment: z.object({
        r2Key: z.string(),
        filename: z.string(),
    }).optional(),
});

// Environment bindings
interface Env {
    DB: D1Database;
}

// Main handler for all requests
export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env, params } = context;
    const boardId = params.board_id.toString();

    if (!boardId) {
        return new Response('Missing board ID.', { status: 400 });
    }

    switch (request.method) {
        case 'GET':
            return handleGetRequest(boardId, env.DB);
        case 'POST':
            return handlePostRequest(request, boardId, env.DB);
        default:
            return new Response('Method Not Allowed', { status: 405 });
    }
};

/**
 * Handles GET requests to fetch all messages and their attachments for a board.
 */
async function handleGetRequest(boardId: string, db: D1Database): Promise<Response> {
    try {
        const sql = `
            SELECT
                m.id, m.board_id, m.content, m.created_at, m.has_attachment,
                a.r2_key, a.filename
            FROM board_messages AS m
            LEFT JOIN board_attachment AS a ON m.id = a.message_id
            WHERE m.board_id = ?
            ORDER BY m.created_at DESC;
        `;
        const { results } = await db.prepare(sql).bind(boardId).all();

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('Failed to fetch messages:', e);
        return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
    }
}

/**
 * Handles POST requests to create a new message, with an optional attachment.
 */
async function handlePostRequest(request: Request, boardId: string, db: D1Database): Promise<Response> {
    try {
        const body = await request.json();
        const validation = PostBodySchema.safeParse(body);

        if (!validation.success) {
            return new Response(JSON.stringify(validation.error.flatten()), { status: 400 });
        }

        const { content, attachment } = validation.data;
        const hasAttachment = !!attachment;
        const now = new Date().toISOString();

        // D1 does not support transactions directly in the traditional sense over HTTP.
        // We have to perform operations sequentially and handle potential inconsistencies.
        const messageInsertResult = await db.prepare(
            'INSERT INTO board_messages (board_id, content, created_at, has_attachment) VALUES (?, ?, ?, ?)'
        ).bind(boardId, content, now, hasAttachment ? 1 : 0).run();

        const messageId = messageInsertResult.meta.last_row_id;

        if (!messageId) {
            return new Response('Failed to create message.', { status: 500 });
        }

        if (hasAttachment) {
            await db.prepare(
                'INSERT INTO board_attachment (message_id, r2_key, filename, uploaded_at) VALUES (?, ?, ?, ?)'
            ).bind(messageId, attachment.r2Key, attachment.filename, now).run();
        }

        return new Response('Message posted successfully!', { status: 201 });

    } catch (e: any) {
        console.error('Failed to post message:', e);
        // If attachment insert fails after message insert, we have an orphaned message.
        // A more robust solution would involve a cleanup process.
        return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
    }
}