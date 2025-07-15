declare const pako: any;
declare const marked: any;
declare const DOMPurify: any;
declare const hljs: any;
declare const renderMathInElement: any;

document.addEventListener('DOMContentLoaded', () => {
    const boardIdDisplay = document.getElementById('board-id-display') as HTMLSpanElement;
    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    const submitButton = document.getElementById('submit-button') as HTMLButtonElement;
    const messagesContainer = document.getElementById('messages-container') as HTMLDivElement;

    const base64ToUint8Array = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const getBoardIdFromPath = (): string | null => {
        const path = window.location.pathname;
        if (path.startsWith('/b/')) {
            return path.substring(3);
        }
        messagesContainer.innerHTML = '<p>请访问 <code>/b/你的留言板ID</code> 来查看或创建留言板。</p>';
        boardIdDisplay.textContent = '无';
        return null;
    };

    const boardId = getBoardIdFromPath();

    // 获取并渲染留言
    const fetchAndRenderMessages = async () => {
        if (!boardId) return;
        boardIdDisplay.textContent = `/b/${boardId}`;
        messagesContainer.innerHTML = '<p>加载中...</p>';

        try {
            const response = await fetch(`/api/messages/${boardId}`);
            if (!response.ok) {
                throw new Error(`获取留言失败: ${response.statusText}`);
            }
            const messages: any[] = await response.json();
            renderMessages(messages);
        } catch (error: any) {
            console.error(error);
            messagesContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    };

    const renderMessages = (messages: any[]) => {
        messagesContainer.innerHTML = ''; // 清空容器
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<p>这里还没有留言，快来发布第一条吧！</p>';
            return;
        }

        messages.forEach(msg => {
            let originalContent = '';
            try {
                const compressedData = base64ToUint8Array(msg.content);
                originalContent = pako.ungzip(compressedData, { to: 'string' });
            } catch (e: any) {
                console.error('解压失败:', e);
                originalContent = '[内容解压失败]';
            }

            const item = document.createElement('div');
            item.className = 'message-item';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'markdown-body';
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(originalContent));

            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });

            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-meta';

            const timeSpan = document.createElement('span');
            timeSpan.textContent = `发布于: ${new Date(msg.created_at).toLocaleString()}`;

            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.textContent = '复制文本';
            copyButton.onclick = () => {
                navigator.clipboard.writeText(originalContent)
                    .then(() => {
                        copyButton.textContent = '已复制!';
                        setTimeout(() => { copyButton.textContent = '复制文本'; }, 2000);
                    })
                    .catch(err => console.error('复制失败: ', err));
            };

            metaDiv.appendChild(timeSpan);
            metaDiv.appendChild(copyButton);

            item.appendChild(contentDiv);
            item.appendChild(metaDiv);

            messagesContainer.appendChild(item);
        });

        renderMathInElement(messagesContainer, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    };

    const handlePostMessage = async () => {
        if (!boardId) {
            alert('无效的留言板 ID！');
            return;
        }
        const content = messageInput.value.trim();
        if (!content) {
            alert('留言内容不能为空！');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = '提交中...';

        try {
            const compressedContent = pako.gzip(content);

            const response = await fetch(`/api/messages/${boardId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/gzip',
                },
                body: compressedContent,
            });

            if (!response.ok) {
                throw new Error(`提交失败: ${response.statusText}`);
            }

            messageInput.value = '';
            await fetchAndRenderMessages();

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '提交';
        }
    };

    submitButton.addEventListener('click', handlePostMessage);

    // 初始加载
    fetchAndRenderMessages();
});