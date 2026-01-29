document.addEventListener('DOMContentLoaded', function() {
    // 读取配置
    const config = window.REDIRECT_CONFIG || {};
    const rulesIntermediate = window.RULES_INTERMEDIATE || {};
    const rulesDirect = window.RULES_DIRECT || {};
    const fallbackBase = config.fallback || "https://0sla.de";

    // 获取当前路径
    const path = window.location.pathname;
    
    // 处理路径匹配 (移除末尾的斜杠，除非是根路径)
    let lookupPath = path;
    if (path.length > 1 && path.endsWith('/')) {
        lookupPath = path.slice(0, -1);
    }

    // 辅助函数：解析规则值 (支持字符串或对象)
    function getRuleData(ruleValue) {
        if (typeof ruleValue === 'string') {
            return { url: ruleValue };
        } else if (typeof ruleValue === 'object' && ruleValue !== null) {
            return ruleValue;
        }
        return null;
    }

    // 检查是否过期
    function isExpired(ruleData) {
        if (!ruleData || !ruleData.expired_at) return false;
        
        try {
            const expireDate = new Date(ruleData.expired_at);
            if (isNaN(expireDate.getTime())) return false;
            
            const now = new Date();
            return now > expireDate;
        } catch (e) {
            console.error("Error parsing expiration date", e);
            return false;
        }
    }

    // 查找规则
    let target = null;
    let mode = 'fallback'; // direct, intermediate, fallback, error
    let ruleData = null;

    // 特殊逻辑：处理 /no/* 路径
    if (path.startsWith('/no/')) {
        mode = 'error';
    } else {
        // 正常匹配逻辑
        if (rulesDirect[lookupPath]) {
            ruleData = getRuleData(rulesDirect[lookupPath]);
            if (ruleData && !isExpired(ruleData)) {
                target = ruleData.url;
                mode = 'direct';
            }
        } 
        
        if (!target && rulesIntermediate[lookupPath]) {
            ruleData = getRuleData(rulesIntermediate[lookupPath]);
            if (ruleData && !isExpired(ruleData)) {
                target = ruleData.url;
                mode = 'intermediate';
            }
        }
        
        if (!target) {
            let base = fallbackBase;
            if (base.endsWith('/') && path.startsWith('/')) {
                base = base.slice(0, -1);
            } else if (!base.endsWith('/') && !path.startsWith('/')) {
                base = base + '/';
            }
            target = base + path;
            mode = 'direct'; 
        }
    }

    // URL 构建与安全检查逻辑 (仅在非 error 模式下运行)
    let finalUrl = target;
    if (mode !== 'error') {
        const search = window.location.search;
        const hash = window.location.hash;
        try {
            const url = new URL(target);
            const currentParams = new URLSearchParams(search);
            currentParams.forEach((value, key) => {
                url.searchParams.set(key, value);
            });
            if (hash) {
                url.hash = hash;
            }
            finalUrl = url.toString();
        } catch (e) {
            finalUrl = target + search + hash;
        }

        try {
            const checkUrl = new URL(finalUrl, window.location.origin);
            if (checkUrl.protocol !== 'http:' && checkUrl.protocol !== 'https:') {
                finalUrl = "https://0sla.de"; 
                target = null;
            }
        } catch (e) {
            console.error("URL check failed:", e);
        }
    }

    // 获取 UI 元素
    const urlDisplay = document.getElementById('url-display');
    const redirectLink = document.getElementById('redirect-link');
    const card = document.querySelector('.card');
    const title = document.querySelector('h2');
    const statusText = document.getElementById('status-text');

    // 执行逻辑
    if (mode === 'error') {
        // 错误模式
        if (card) card.style.display = 'block';
        if (title) title.textContent = "提示";
        if (statusText) statusText.textContent = "未找到该短链接";
        // 修改后的提示文字
        if (urlDisplay) urlDisplay.textContent = "该链接可能尚未部署，请1分钟后重试";
        
        if (redirectLink) {
            redirectLink.textContent = "重试";
            redirectLink.classList.add('btn-danger');
            redirectLink.href = "javascript:void(0)";
            redirectLink.onclick = function() {
                // 跳转到删除 /no 的路径
                const currentPath = window.location.pathname;
                const newPath = currentPath.replace(/^\/no/, '') || '/';
                const search = window.location.search;
                const hash = window.location.hash;
                window.location.href = newPath + search + hash;
            };
        }
    } else if (mode === 'direct') {
        // 直接跳转
        if (urlDisplay) urlDisplay.textContent = "Redirecting to " + finalUrl;
        if (target !== null) {
            window.location.replace(finalUrl);
        }
    } else {
        // 中间页
        if (card) card.style.display = 'block';
        if (urlDisplay) urlDisplay.textContent = finalUrl;
        if (redirectLink) {
            if (target !== null) {
                redirectLink.href = finalUrl;
            } else {
                redirectLink.removeAttribute('href');
                redirectLink.style.pointerEvents = 'none';
                redirectLink.style.opacity = '0.5';
                redirectLink.textContent = "Unsafe Link";
            }
        }
    }
});
