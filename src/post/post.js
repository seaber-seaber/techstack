let editor;
const API_BASE = "http://localhost:8000";
const token = localStorage.getItem("access_token");

/* =========================
   初始化 Monaco
========================= */
function initMonaco() {
    // 校验全局require是否存在（loader已提前通过script引入）
    if (!window.require) {
        alert("Monaco编辑器加载失败，请刷新页面重试");
        return;
    }
    require.config({
        paths: {
            vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs"
        }
    });
    require(["vs/editor/editor.main"], function () {
        editor = monaco.editor.create(document.getElementById("monacoContainer"), {
            value: "# 开始你的创作\n\n在这里输入Markdown内容右侧实时预览\n",
            language: "markdown",
            theme: "vs-dark",
            automaticLayout: true,
            wordWrap: "on"
        });
        // 内容变化监听
        editor.onDidChangeModelContent(() => {
            updatePreview();
            updateStats();
            markSaving();
            debounceAutoSave();
        });
        bindPasteUpload();
    });
}

/* =========================
   Markdown 预览渲染
========================= */
function updatePreview() {
    const md = editor.getValue();
    const safeHtml = DOMPurify.sanitize(marked.parse(md));
    document.getElementById("previewContainer").innerHTML = safeHtml;
}

/* =========================
   字数统计
========================= */
function updateStats() {
    const text = editor.getValue();
    const charCount = text.length;
    const wordCount = text.replace(/\s/g, "").length;
    const readTime = Math.max(1, Math.round(wordCount / 400));
    document.getElementById("charCount").innerText = charCount;
    document.getElementById("wordCount").innerText = wordCount;
    document.getElementById("readTime").innerText = readTime;
}

/* =========================
   保存状态提示
========================= */
function markSaving() {
    const el = document.getElementById("saveStatus");
    el.innerHTML = `<i class="fa fa-spinner fa-spin"></i> 保存中...`;
    el.className = "save-status saving";
}

/* =========================
   防抖本地自动保存草稿
========================= */
let autoSaveTimer;
function debounceAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        const data = {
            title: document.getElementById("articleTitle").value,
            content: editor.getValue(),
            time: Date.now()
        };
        localStorage.setItem("draft_temp", JSON.stringify(data));
        const el = document.getElementById("saveStatus");
        el.innerHTML = `<i class="fa fa-check-circle"></i> 已自动保存`;
        el.className = "save-status saved";
    }, 1500);
}

/* =========================
   粘贴图片上传【修复版】
========================= */
function bindPasteUpload() {
    // 监听编辑器容器的paste，而非全局document，减少冲突
    const editorDom = document.getElementById("monacoContainer");
    editorDom.addEventListener("paste", async (e) => {
        const items = e.clipboardData?.items;
        if (!items || items.length === 0) return;

        let hasImage = false;
        // 遍历剪贴板
        for (const item of items) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
                hasImage = true;
                const file = item.getAsFile();
                console("捕获粘贴图片：", file);
                await uploadImage(file);
            }
        }

        // 如果检测到图片，阻止默认粘贴，避免编辑器乱插入文本
        if (hasImage) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

/* =========================
   上传图片接口
========================= */
async function uploadImage(file) {
    if (!token) {
        alert("请先登录！");
        return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch(`${API_BASE}/post/upload`, {
            method: "POST",
            headers: {
                Authorization: "Bearer " + token
            },
            body: formData
        });
        const json = await res.json();
        if (json.code === 200) {
            insertImage(json.data);
        } else {
            alert(json.msg || "图片上传失败");
        }
    } catch (err) {
        console.error("上传图片异常", err);
        alert("上传接口请求失败，请检查后端服务");
    }
}

/* 插入图片Markdown语法到光标处 */
function insertImage(url) {
    const pos = editor.getPosition();
    editor.executeEdits("", [
        {
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: `![](${url})\n`
        }
    ]);
}

/* =========================
   工具栏快捷键插入Markdown语法
========================= */
function bindToolbar() {
    const cmdMap = {
        bold: "**加粗文字**",
        italic: "*斜体文字*",
        strike: "~~删除线~~",
        h1: "# 一级标题",
        h2: "## 二级标题",
        h3: "### 三级标题",
        ul: "- 无序列表项",
        ol: "1. 有序列表项",
        quote: "> 引用文本",
        inlinecode: "`行内代码`",
        codeblock: "\n```markdown\n代码内容\n```\n",
        link: "[链接文字](https://xxx.com)",
        image: "![图片描述](图片地址)"
    };
    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cmd = btn.dataset.cmd;
            if (!cmdMap[cmd]) return;
            const pos = editor.getPosition();
            editor.executeEdits("", [
                {
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    text: cmdMap[cmd]
                }
            ]);
        });
    });
}

/* =========================
   加载文章分类下拉框
========================= */
async function loadCategories() {
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/category/list`, {
            method: "POST", // 改为POST
            headers: {
                Authorization: "Bearer " + token
            }
        });
        const json = await res.json();
        const select = document.getElementById("categorySelect");
        select.innerHTML = `<option value="">请选择分类</option>`;
        if (json.code === 200 && Array.isArray(json.data)) {
            json.data.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.cate_id;
                opt.innerText = item.cate_name;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("加载分类失败", e);
    }
}

/* =========================
   发布/草稿/私密提交
   status: 0草稿 1公开 2私密
========================= */
async function publish(status) {
    const title = document.getElementById("articleTitle").value.trim();
    const content = editor.getValue();
    const category_id = Number(document.getElementById("categorySelect").value);

    if (!title || title.length < 5) {
        alert("标题至少输入5个字符");
        return;
    }
    if (!content.trim()) {
        alert("文章内容不能为空");
        return;
    }
    if (!token) {
        alert("请登录后操作");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/post/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
            },
            body: JSON.stringify({ title, content, category_id, status })
        });
        const json = await res.json();
        if (json.code === 200) {
            alert("操作成功！");
            // 可选：清空本地草稿 localStorage.removeItem("draft_temp");
        } else {
            alert(json.msg || "提交失败");
        }
    } catch (e) {
        console.error("发布接口异常", e);
        alert("后端服务连接失败，请检查localhost:8000是否启动");
    }
}

/* =========================
   底部按钮绑定事件
========================= */
function bindActions() {
    document.getElementById("saveDraftBtn").addEventListener("click", () => publish(0));
    document.getElementById("privateBtn").addEventListener("click", () => publish(2));
    document.getElementById("publishingBtn").addEventListener("click", () => publish(1));
}

/* =========================
   页面初始化入口
========================= */
window.addEventListener("DOMContentLoaded", () => {
    initMonaco();
    bindToolbar();
    bindActions();
    loadCategories();
});