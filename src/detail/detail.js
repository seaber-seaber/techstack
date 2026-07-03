// 从url获取post_id
const urlParams = new URLSearchParams(location.search);
const postId = urlParams.get("post_id");
const API_BASE = "http://localhost:8000";

// 页面初始化
window.addEventListener("DOMContentLoaded", async () => {
    console.log("页面DOM加载完成，准备加载文章");
    if (!postId) {
        alert("文章ID不存在");
        location.href = "../index.html";
        return;
    }
    // 等待全局库加载完成
    await waitLibReady();
    await loadArticleDetail();
});

/** 等待axios、marked、DOMPurify加载完成 */
function waitLibReady() {
    return new Promise(resolve => {
        const timer = setInterval(() => {
            if (window.axios && window.marked && window.DOMPurify) {
                clearInterval(timer);
                resolve();
            }
        }, 100);
    });
}

/** 请求后端文章详情接口 POST /post/detail */
async function loadArticleDetail() {
    try {
        const res = await axios.post(`${API_BASE}/post/detail`, {
            post_id: Number(postId)
        });
        const resData = res.data;
        console.log("后端返回文章数据：", resData);
        if (resData.code !== 200) {
            alert(resData.msg || "文章加载失败");
            return;
        }
        renderArticle(resData.data);
    } catch (err) {
        console.error("详情接口请求失败", err);
        alert("后端服务连接失败，请检查");
    }
}

/**
 * 渲染文章：兼容纯文本 + Markdown两种内容
 * @param {Object} data 后端返回data
 */
function renderArticle(data) {
    const { title, content, created_at } = data;
    // 渲染标题
    document.getElementById("articleTitle").innerText = title;
    // 格式化发布时间
    const createDate = new Date(created_at);
    document.getElementById("createTime").innerText = createDate.toLocaleString();

    let htmlStr;
    // 判断是否为纯文本（无# ## ### 等markdown标题标记）
    const isMarkdown = /^#{1,3}\s/m.test(content);
    if (isMarkdown) {
        htmlStr = parseMarkdownWithAnchor(content);
    } else {
        // 纯文本直接换行处理，不经过md解析
        htmlStr = `<p>${content.replaceAll("\n", "<br>")}</p>`;
    }
    document.getElementById("articleContent").innerHTML = htmlStr;

    // 只有markdown内容才生成目录，纯文本不渲染目录
    if (isMarkdown) buildToc();
    else document.getElementById("tocList").innerHTML = "<div class='empty-toc'>本文暂无目录</div>";
}

/** Markdown转换，自动给标题添加锚点ID */
function parseMarkdownWithAnchor(mdText) {
    let processed = mdText
        .replace(/^\s*# (.*?)\s*$/gm, (match, txt) => `<h1 id="${getId(txt)}">${txt}</h1>`)
        .replace(/^\s*## (.*?)\s*$/gm, (match, txt) => `<h2 id="${getId(txt)}">${txt}</h2>`)
        .replace(/^\s*### (.*?)\s*$/gm, (match, txt) => `<h3 id="${getId(txt)}">${txt}</h3>`);
    const rawHtml = marked.parse(processed);
    return DOMPurify.sanitize(rawHtml);
}

/** 根据标题生成唯一锚点 */
function getId(text) {
    return "anchor-" + text.replace(/[^\u4e00a-zA-Z0-9]/g, "-");
}

/** 生成侧边目录（修复h3选择器bug） */
/** 生成侧边目录 */
function buildToc() {
    const tocWrap = document.getElementById("tocList");
    const headings = document.querySelectorAll(".article-content h1, .article-content h2, .article-content h3");
    tocWrap.innerHTML = "";
    if (headings.length === 0) {
        tocWrap.innerHTML = "<div class='empty-toc'>本文暂无目录</div>";
        return;
    }
    headings.forEach(h => {
        const item = document.createElement("div");
        item.className = `toc-item toc-${h.tagName.toLowerCase()}`;
        item.innerText = h.innerText;
        item.dataset.targetId = h.id;
        // 点击只负责滚动跳转，不处理高亮
        item.addEventListener("click", () => {
            document.getElementById(h.id).scrollIntoView({ behavior: "smooth" });
            // 移除此行：不再手动添加 active 类
            // document.querySelectorAll(".toc-item").forEach(i => i.classList.remove("active"));
            // item.classList.add("active");
        });
        tocWrap.appendChild(item);
    });
    // 滚动时自动高亮
    window.addEventListener("scroll", setActiveTocItem);
    // 初始化时执行一次，高亮当前可见标题
    setTimeout(setActiveTocItem, 100);
}

/** 滚动自动高亮当前目录 */
function setActiveTocItem() {
    const headings = document.querySelectorAll(".article-content h1, .article-content h2, .article-content h3");
    const items = document.querySelectorAll(".toc-item");
    let currentId = "";
    headings.forEach(h => {
        const top = h.getBoundingClientRect().top;
        if (top <= 80) currentId = h.id;
    });
    items.forEach(item => item.classList.toggle("active", item.dataset.targetId === currentId));
}