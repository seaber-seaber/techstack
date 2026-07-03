// 全局变量：当前选中分类ID、分类映射、搜索关键词
let currentCatId = 0;
let categoryMap = new Map();
let searchKeyword = "";
const baseUrl = "http://localhost:8000";

// 1. 页面初始化执行
document.addEventListener('DOMContentLoaded', async () => {
    // 加载分类标签并缓存分类映射
    await loadCategoryList();
    // 加载默认全部文章
    await loadPostList(currentCatId);
    // 绑定分类点击事件委托
    bindCategoryClick();
    // 绑定文章卡片点击跳转
    bindArticleClick();
    // 新增：绑定搜索框事件
    bindSearchInput();
});

/**
 * 获取分类列表并渲染标签，同时缓存id与名称映射
 */
async function loadCategoryList() {
    try {
        const res = await axios.post(`${baseUrl}/category/list`);
        const result = res.data;
        if (result.code !== 200) return alert(result.msg);
        const categoryArr = result.data;
        const catNavEl = document.querySelector('.category-nav');
        // 清空写死的静态标签，只保留【全部】
        catNavEl.innerHTML = '<span class="cat-tag active">全部</span>';
        // 构建id-name映射 + 渲染标签
        categoryArr.forEach(item => {
            categoryMap.set(item.cate_id, item.cate_name);
            const span = document.createElement('span');
            span.className = 'cat-tag';
            span.dataset.catId = item.cate_id;
            span.innerText = item.cate_name;
            catNavEl.appendChild(span);
        });
    } catch (err) {
        console.error('加载分类失败', err);
    }
}

/**
 * 根据分类ID + 搜索关键词加载文章列表
 * @param {number} catId 分类id，0=全部
 */
async function loadPostList(catId) {
    try {
        // 拼接请求参数：分类 + 搜索关键词
        const params = {};
        if (catId !== 0) params.category_id = catId;
        if (searchKeyword.trim() !== "") params.keyword = searchKeyword.trim();

        const res = await axios.post(`${baseUrl}/post/list`, params);
        const result = res.data;
        if (result.code !== 200) return alert(result.msg);
        const articleGrid = document.querySelector('.article-grid');
        // 清空原有卡片
        articleGrid.innerHTML = '';
        const postItems = result.data.items;
        if (!postItems.length) {
            articleGrid.innerHTML = '<p style="color:var(--text-muted);">暂无文章</p>';
            return;
        }
        // 循环渲染文章卡片
        postItems.forEach(post => {
            const card = document.createElement('div');
            card.className = 'article-card';
            card.dataset.postId = post.post_id;
            // 从map根据category_id取出分类名称展示
            const tagName = categoryMap.get(post.category_id) || '未知分类';
            card.innerHTML = `
        <span class="card-tag" data-field="tag">${tagName}</span>
        <h3 data-field="title">${post.title}</h3>
        <p data-field="desc">${post.summary || '暂无简介'}</p>
        <div class="card-meta">
          <span data-type="view"><i class="far fa-eye"></i> ${post.view_count}</span>
          <span data-type="like"><i class="far fa-heart"></i> ${post.like_count}</span>
          <span data-type="comment"><i class="far fa-comment"></i> ${post.comment_count}</span>
          <span data-type="share"><i class="far fa-share-square"></i> ${post.share_count}</span>
          <span data-type="create_at"><i class="far fa-calendar-alt"></i>${formatDate(post.created_at)}</span>
        </div>
      `;
            articleGrid.appendChild(card);
        });
    } catch (err) {
        console.error('加载文章失败', err);
    }
}

/**
 * 分类标签点击事件委托
 */
function bindCategoryClick() {
    const catNavEl = document.querySelector('.category-nav');
    catNavEl.addEventListener('click', async (e) => {
        const targetTag = e.target.closest('.cat-tag');
        if (!targetTag) return;
        // 移除所有active
        document.querySelectorAll('.cat-tag').forEach(tag => tag.classList.remove('active'));
        targetTag.classList.add('active');
        // 获取选中分类id
        const catId = targetTag.dataset.catId ? Number(targetTag.dataset.catId) : 0;
        currentCatId = catId;
        // 重新加载文章（保留当前搜索词）
        await loadPostList(catId);
    });
}

/**
 * 文章卡片点击跳转详情页，携带post_id参数
 */
function bindArticleClick() {
    const articleGrid = document.querySelector('.article-grid');
    articleGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.article-card');
        if (!card) return;
        const postId = card.dataset.postId;
        // 跳转详情页，路由自行替换为你的详情页面地址
        location.href = `../../src/detail/detail.html?post_id=${postId}`;
    });
}

/**
 * 新增：搜索框绑定事件（回车搜索、失去焦点搜索）
 */
function bindSearchInput() {
    const searchInput = document.querySelector('.search-box input');
    if (!searchInput) return;

    // 回车触发搜索
    searchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            searchKeyword = searchInput.value;
            await loadPostList(currentCatId);
        }
    });

    // 失去焦点也触发搜索
    searchInput.addEventListener('blur', async () => {
        searchKeyword = searchInput.value;
        await loadPostList(currentCatId);
    });
}

/**
 * 格式化日期 2026-06-28T00:32:37 → 2026-06-28
 */
function formatDate(timeStr) {
    if (!timeStr) return '未知时间';
    return timeStr.split('T')[0];
}