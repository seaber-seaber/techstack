// ========== 配置 ==========
const API_BASE = 'http://localhost:8000';

// ========== 状态 ==========
let currentUser = null;
let categoryList = [];
let currentTab = 'articles';
let currentPage = 1;
let pageSize = 10;
let selectedCategory = '';
let selectedStatus = '1'; // 默认已发布
let totalCount = 0;

// ========== 获取 Token ==========
function getToken() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.warn('未找到 token');
        return null;
    }
    return token;
}

// ========== 请求封装 ==========
function request(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    }).then(res => res.json());
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    loadUserFromStorage();
    if (!currentUser) {
        location.href = '../index.html';
        return;
    }
    renderUserProfile();
    bindEvents();
    initTabs();
    loadCategories();
});

// ========== 从 localStorage 加载用户 ==========
function loadUserFromStorage() {
    const userStr = localStorage.getItem('user_info');
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
        } catch (e) {
            console.error('解析用户信息失败', e);
        }
    }
}

// ========== 保存用户到 localStorage ==========
function saveUserToStorage() {
    if (currentUser) {
        localStorage.setItem('user_info', JSON.stringify(currentUser));
    }
}

// ========== 渲染用户信息 ==========
function renderUserProfile() {
    if (!currentUser) return;

    // 昵称：如果 nickname 不为空则使用，否则使用 username
    const displayName = currentUser.nickname && currentUser.nickname.trim() !== ''
        ? currentUser.nickname
        : currentUser.username;
    document.getElementById('displayName').textContent = displayName;

    const avatar = document.getElementById('profileAvatar');
    if (currentUser.avatar) {
        avatar.src = currentUser.avatar;
    } else {
        avatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`;
    }

    document.getElementById('userJoinDate').textContent = currentUser.created_at
        ? new Date(currentUser.created_at).toLocaleDateString('zh-CN')
        : '未知';
    document.getElementById('userEmail').textContent = currentUser.email || '';
    document.getElementById('bioText').textContent = currentUser.bio || '这个人很懒，什么都没写~';

    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar && currentUser.avatar) {
        headerAvatar.src = currentUser.avatar;
    }
}

// ========== 绑定事件 ==========
function bindEvents() {
    document.getElementById('editProfileBtn').addEventListener('click', openEditModal);
    document.getElementById('editModalClose').addEventListener('click', closeEditModal);
    document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
    });

    document.getElementById('avatarUploadBtn').addEventListener('click', () => {
        document.getElementById('avatarInput').click();
    });
    document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);

    document.getElementById('editAvatarInput').addEventListener('change', handleEditAvatarUpload);

    document.getElementById('editBio').addEventListener('input', (e) => {
        document.getElementById('bioCount').textContent = e.target.value.length;
    });

    document.getElementById('editForm').addEventListener('submit', handleSaveProfile);

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        currentPage = 1;
        loadArticles();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
        selectedStatus = e.target.value;
        currentPage = 1;
        loadArticles();
    });
}

// ========== Tab 切换 ==========
function initTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            currentPage = 1;
            if (currentTab === 'articles') {
                document.getElementById('filterBar').style.display = 'flex';
                loadArticles();
            } else {
                document.getElementById('filterBar').style.display = 'none';
                renderEmptyState('该功能开发中，敬请期待 🚀');
            }
        });
    });
}

// ========== 加载分类 ==========
async function loadCategories() {
    try {
        const res = await request('/category/list', {
            method: 'POST'
        });
        if (res.code === 200 && res.data) {
            categoryList = res.data;
            renderCategoryFilter();
            loadArticles();
        }
    } catch (e) {
        console.error('加载分类失败', e);
        loadArticles();
    }
}

// ========== 渲染分类筛选 ==========
function renderCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    select.innerHTML = '<option value="">全部分类</option>';
    categoryList.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.cate_id;
        option.textContent = cat.cate_name;
        select.appendChild(option);
    });
}

// ========== 加载文章列表 ==========
async function loadArticles() {
    const container = document.getElementById('listContainer');
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#8b949e;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

    try {
        // 传入当前用户ID，查询自己的帖子
        const params = {
            user_id: currentUser.user_id,
            page: currentPage,
            page_size: pageSize,
            status: parseInt(selectedStatus)
        };
        if (selectedCategory) {
            params.category_id = parseInt(selectedCategory);
        }

        const res = await request('/post/list', {
            method: 'POST',
            body: JSON.stringify(params)
        });

        if (res.code === 200 && res.data) {
            const { items, total, page, page_size } = res.data;
            totalCount = total || 0;
            renderArticles(items || []);
            renderPagination(total, page, page_size);
            document.getElementById('totalCount').textContent = `共 ${total || 0} 篇`;
        } else {
            renderEmptyState(res.msg || '暂无文章');
        }
    } catch (e) {
        console.error('加载文章失败', e);
        renderEmptyState('加载失败，请稍后重试');
    }
}

// ========== 渲染文章列表 ==========
function renderArticles(items) {
    const container = document.getElementById('listContainer');

    if (!items || items.length === 0) {
        renderEmptyState('暂无文章，快去写一篇吧 ✍️');
        return;
    }

    const getCateName = (cateId) => {
        const cat = categoryList.find(c => c.cate_id === cateId);
        return cat ? cat.cate_name : '';
    };

    const statusMap = {
        0: { label: '草稿', cls: '' },
        1: { label: '已发布', cls: 'primary' },
        2: { label: '私密', cls: '' }
    };

    container.innerHTML = items.map(item => `
        <div class="list-item">
            <div class="item-thumb" style="background:${getThumbColor(item.post_id)}"></div>
            <div class="item-body">
                <div class="item-title">
                    <a href="../detail/detail.html?post_id=${item.post_id}" style="color:#f0f6fc;text-decoration:none;hover:color:#58a6ff;">
                        ${item.title || '无标题'}
                    </a>
                    ${item.category_id ? `<span class="tag">${getCateName(item.category_id)}</span>` : ''}
                    <span class="tag ${statusMap[item.status]?.cls || ''}">${statusMap[item.status]?.label || '未知'}</span>
                </div>
                <div class="item-desc">${item.summary || '暂无摘要'}</div>
                <div class="item-meta">
                    <span><i class="far fa-clock"></i> ${formatTime(item.created_at)}</span>
                    ${item.view_count !== undefined ? `<span><i class="far fa-eye"></i> ${item.view_count}</span>` : ''}
                    ${item.like_count !== undefined ? `<span><i class="far fa-heart"></i> ${item.like_count}</span>` : ''}
                    ${item.comment_count !== undefined ? `<span><i class="far fa-comment"></i> ${item.comment_count}</span>` : ''}
                    ${item.collect_count !== undefined ? `<span><i class="far fa-star"></i> ${item.collect_count}</span>` : ''}
                </div>
            </div>
            <div class="item-actions">
                <a href="../detail/detail.html?post_id=${item.post_id}" class="btn-sm primary">查看</a>
                ${item.status === 0 ? `<button class="btn-sm" onclick="editPost(${item.post_id})">编辑</button>` : ''}
                <button class="btn-sm" style="color:#f85149;border-color:#f85149;" onclick="deletePost(${item.post_id}, '${item.title}')">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        </div>
    `).join('');
}

// ========== 渲染分页 ==========
function renderPagination(total, page, pageSize) {
    const container = document.getElementById('pagination');
    if (!total || total <= pageSize) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(total / pageSize);
    const current = page || 1;

    let html = '';
    if (current > 1) {
        html += `<button class="page-btn" onclick="goPage(${current - 1})">上一页</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === current) {
            html += `<button class="page-btn active">${i}</button>`;
        } else if (i <= 3 || i > totalPages - 3 || Math.abs(i - current) <= 1) {
            html += `<button class="page-btn" onclick="goPage(${i})">${i}</button>`;
        } else if (i === 4 && current > 5) {
            html += `<button class="page-btn" disabled>...</button>`;
        } else if (i === totalPages - 3 && current < totalPages - 4) {
            html += `<button class="page-btn" disabled>...</button>`;
        }
    }

    if (current < totalPages) {
        html += `<button class="page-btn" onclick="goPage(${current + 1})">下一页</button>`;
    }

    container.innerHTML = html;
}

// ========== 跳转页码 ==========
function goPage(page) {
    currentPage = page;
    loadArticles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== 渲染空状态 ==========
function renderEmptyState(message) {
    const container = document.getElementById('listContainer');
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>${message}</p>
        </div>
    `;
    document.getElementById('pagination').innerHTML = '';
}

// ========== 工具函数 ==========
function formatTime(timeStr) {
    if (!timeStr) return '未知';
    try {
        const date = new Date(timeStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return timeStr;
    }
}

function getThumbColor(id) {
    const colors = ['#1f3a5f', '#2d4a7a', '#1a2a4a', '#3a5a8a', '#0d1a30'];
    return colors[(id || 0) % colors.length];
}

// ========== 打开编辑弹窗 ==========
function openEditModal() {
    if (!currentUser) return;

    document.getElementById('editNickname').value = currentUser.nickname || '';
    document.getElementById('editBio').value = currentUser.bio || '';
    document.getElementById('bioCount').textContent = (currentUser.bio || '').length;

    const preview = document.getElementById('editAvatarPreview');
    if (currentUser.avatar) {
        preview.src = currentUser.avatar;
    } else {
        preview.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`;
    }

    document.getElementById('editModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ========== 关闭编辑弹窗 ==========
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('editAvatarInput').value = '';
}

// ========== 卡片头像上传 ==========
function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    uploadAvatar(file, (url) => {
        document.getElementById('profileAvatar').src = url;
        currentUser.avatar = url;
        saveUserToStorage();
        const headerAvatar = document.getElementById('headerAvatar');
        if (headerAvatar) headerAvatar.src = url;
        showToast('头像更新成功');
    });
    e.target.value = '';
}

// ========== 弹窗头像上传 ==========
function handleEditAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    uploadAvatar(file, (url) => {
        document.getElementById('editAvatarPreview').src = url;
        currentUser._tempAvatar = url;
    });
}

// ========== 上传头像 ==========
async function uploadAvatar(file, callback) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const token = getToken();
        const response = await fetch(`${API_BASE}/post/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        const result = await response.json();
        if (result.code === 200 && result.data) {
            callback(result.data);
        } else {
            showToast(result.msg || '头像上传失败');
        }
    } catch (e) {
        console.error('上传头像失败', e);
        showToast('上传失败，请检查网络');
    }
}

// ========== 保存个人资料 ==========
async function handleSaveProfile(e) {
    e.preventDefault();

    const nickname = document.getElementById('editNickname').value.trim();
    const bio = document.getElementById('editBio').value.trim();

    const updateData = {
        nickname: nickname || '',
        bio: bio || ''
    };

    if (currentUser._tempAvatar) {
        updateData.avatar = currentUser._tempAvatar;
    }

    try {
        const res = await request('/user/update', {
            method: 'POST',
            body: JSON.stringify(updateData)
        });

        if (res.code === 200) {
            currentUser.nickname = updateData.nickname;
            currentUser.bio = updateData.bio;
            if (updateData.avatar) {
                currentUser.avatar = updateData.avatar;
                delete currentUser._tempAvatar;
            }

            saveUserToStorage();
            renderUserProfile();
            closeEditModal();
            showToast('资料更新成功！');
        } else {
            showToast(res.msg || '更新失败，请重试');
        }
    } catch (e) {
        console.error('保存资料失败', e);
        showToast('保存失败，请检查网络');
    }
}

// ========== 删除文章 ==========
async function deletePost(postId, title) {
    if (!confirm(`确定要删除「${title || '无标题'}」吗？此操作不可撤销！`)) {
        return;
    }

    try {
        const res = await request('/post/delete', {
            method: 'POST',
            body: JSON.stringify({ post_id: postId })
        });

        if (res.code === 200) {
            showToast('文章删除成功');
            // 重新加载列表
            loadArticles();
        } else {
            showToast(res.msg || '删除失败，请重试');
        }
    } catch (e) {
        console.error('删除文章失败', e);
        showToast('删除失败，请检查网络');
    }
}

// ========== Toast 提示 ==========
function showToast(message) {
    const old = document.querySelector('.toast-message');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ========== 编辑文章（跳转） ==========
function editPost(postId) {
    location.href = `../create/create.html?post_id=${postId}`;
}

// ========== 暴露全局函数 ==========
window.goPage = goPage;
window.editPost = editPost;
window.deletePost = deletePost;