document.addEventListener('DOMContentLoaded', () => {
    const boardIdDisplay = document.getElementById('board-id-display');
    const messageInput = document.getElementById('message-input');
    const submitButton = document.getElementById('submit-button');
    const messagesContainer = document.getElementById('messages-container');

    // 从 URL 路径中解析出 board-id
    // 例如，从 "/b/my-secret-board" 中解析出 "my-secret-board"
    const getBoardIdFromPath = () => {
        const path = window.location.pathname;
        if (path.startsWith('/b/')) {
            return path.substring(3); // 移除 '/b/'
        }
        // 如果是根路径，可以给个默认值或提示
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
            const messages = await response.json();
            renderMessages(messages);
        } catch (error) {
            console.error(error);
            messagesContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    };

    // 将留言数据渲染到页面上
    const renderMessages = (messages) => {
        messagesContainer.innerHTML = ''; // 清空容器
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<p>这里还没有留言，快来发布第一条吧！</p>';
            return;
        }

        messages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'message-item';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'markdown-body';
            // 使用 DOMPurify 清理 Markdown 输出，防止 XSS
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(msg.content));

            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-meta';

            const timeSpan = document.createElement('span');
            timeSpan.textContent = `发布于: ${new Date(msg.created_at).toLocaleString()}`;

            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.textContent = '复制文本';
            copyButton.onclick = () => {
                navigator.clipboard.writeText(msg.content)
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
    };

    // 处理提交按钮点击事件
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
            const response = await fetch(`/api/messages/${boardId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                throw new Error(`提交失败: ${response.statusText}`);
            }

            messageInput.value = ''; // 清空输入框
            await fetchAndRenderMessages(); // 重新加载留言

        } catch (error) {
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