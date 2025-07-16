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
    const attachFileButton = document.getElementById('attach-file-button') as HTMLButtonElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const attachmentInfo = document.getElementById('attachment-info') as HTMLDivElement;

    let selectedFile: File | null = null;

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
        messagesContainer.innerHTML = '';
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<p>这里还没有留言，快来发布第一条吧！</p>';
            return;
        }

        messages.forEach(msg => {
            let originalContent = '';
            try {
                // Assuming content is gzipped and base64 encoded on the server
                const compressedData = base64ToUint8Array(msg.content);
                originalContent = pako.ungzip(compressedData, { to: 'string' });
            } catch (e: any) {
                // Fallback for non-gzipped or plain text content for backward compatibility
                originalContent = msg.content;
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

            if (msg.has_attachment) {
                const attachmentContainer = document.createElement('div');
                attachmentContainer.className = 'attachment-container';

                const attachmentLink = document.createElement('a');
                attachmentLink.href = '#';
                attachmentLink.textContent = `下载附件: ${msg.filename}`;
                attachmentLink.className = 'attachment-link';
                attachmentLink.onclick = (e) => {
                    e.preventDefault();
                    handleDownload(msg.r2_key, msg.filename);
                };
                attachmentContainer.appendChild(attachmentLink);

                const expirySpan = document.createElement('span');
                expirySpan.className = 'attachment-expiry';

                const createdAt = new Date(msg.created_at);
                const expiryDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 1 day later
                const now = new Date();
                const remainingMillis = expiryDate.getTime() - now.getTime();

                if (remainingMillis > 0) {
                    const remainingHours = Math.floor(remainingMillis / (1000 * 60 * 60));
                    const remainingMinutes = Math.floor((remainingMillis % (1000 * 60 * 60)) / (1000 * 60));
                    expirySpan.textContent = `(还剩 ${remainingHours} 小时 ${remainingMinutes} 分钟)`;
                } else {
                    expirySpan.textContent = '(已过期)';
                }
                attachmentContainer.appendChild(expirySpan);
                metaDiv.appendChild(attachmentContainer);
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'timestamp';
            timeSpan.textContent = `发布于: ${new Date(msg.created_at).toLocaleString()}`;
            metaDiv.appendChild(timeSpan);

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

            item.appendChild(contentDiv);
            item.appendChild(copyButton);
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

    const handleDownload = async (r2Key: string, filename: string) => {
        try {
            const response = await fetch(`/api/attachments/download?key=${r2Key}`);
            if (!response.ok) throw new Error('获取下载链接失败');
            const { presignedUrl } = await response.json() as {
                presignedUrl: string, r2Key: string;
            };

            // 创建一个临时的 a 标签来触发下载
            const link = document.createElement('a');
            link.href = presignedUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error: any) {
            console.error('下载失败:', error);
            alert(error.message);
        }
    };

    const handlePostMessage = async () => {
        if (!boardId) {
            alert('无效的留言板 ID！');
            return;
        }
        const content = messageInput.value.trim();
        if (!content && !selectedFile) {
            alert('留言内容和附件不能都为空！');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = '提交中...';

        try {
            let attachmentData = null;
            if (selectedFile) {
                submitButton.textContent = '正在上传附件...';
                // 1. 获取预签名 URL
                const uploadResponse = await fetch('/api/attachments/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        boardId: boardId,
                        fileName: selectedFile.name,
                        contentType: selectedFile.type || 'application/octet-stream '
                    }),
                });
                if (!uploadResponse.ok) throw new Error('获取上传URL失败');
                const { presignedUrl, r2Key } = await uploadResponse.json() as {
                    presignedUrl: string, r2Key: string;
                };

                // 2. 上传文件到 R2
                await fetch(presignedUrl, { method: 'PUT', body: selectedFile });

                attachmentData = { r2Key: r2Key, filename: selectedFile.name };
            }

            submitButton.textContent = '正在提交留言...';
            const compressedContent = pako.gzip(content);
            const contentBase64 = btoa(String.fromCharCode.apply(null, Array.from(compressedContent)));

            const postBody = {
                content: contentBase64,
                attachment: attachmentData
            };

            const response = await fetch(`/api/messages/${boardId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postBody),
            });

            if (!response.ok) {
                throw new Error(`提交失败: ${response.statusText}`);
            }

            messageInput.value = '';
            fileInput.value = '';
            selectedFile = null;
            updateAttachmentInfo();
            await fetchAndRenderMessages();

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '提交';
        }
    };

    const updateAttachmentInfo = () => {
        if (selectedFile) {
            attachmentInfo.textContent = `已选择文件: ${selectedFile.name}`;
            const removeButton = document.createElement('button');
            removeButton.textContent = '移除';
            removeButton.onclick = () => {
                selectedFile = null;
                fileInput.value = ''; // 清空 file input
                updateAttachmentInfo();
            };
            attachmentInfo.appendChild(removeButton);
        } else {
            attachmentInfo.textContent = '';
        }
    };

    attachFileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
            selectedFile = files[0];
            updateAttachmentInfo();
        } else {
            selectedFile = null;
        }
    });

    submitButton.addEventListener('click', handlePostMessage);

    // 初始加载
    fetchAndRenderMessages();
});