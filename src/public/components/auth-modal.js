// axios实例
const http = axios.create({
    baseURL: "http://localhost:8000",
    headers: {
        "Content-Type": "application/json"
    }
});

const api = {
    sendCode: async (email) => {
        const res = await http.post("/user/send_code", { email });
        return res.data;
    },
    register: async (info) => {
        const res = await http.post("/user/register", info);
        return res.data;
    },
    login: async (params) => {
        const res = await http.post("/user/login", params);
        return res.data;
    }
};

const message = {
    success: (t) => alert(t),
    error: (t) => alert(t)
};

let authInstance = null;

class AuthModal {
    constructor() {
        this.modal = document.getElementById('authModal');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.initEvent();
    }

    open() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.loginForm.reset();
        this.registerForm.reset();
    }

    switchTab(type) {
        const tabLogin = document.querySelector('[data-tab="login"]');
        const tabRegister = document.querySelector('[data-tab="register"]');
        if (type === 'login') {
            this.loginForm.style.display = 'flex';
            this.registerForm.style.display = 'none';
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
        } else {
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'flex';
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
        }
    }

    initEvent() {
        const closeBtn = this.modal.querySelector('.modal-close');
        const tabLogin = document.querySelector('[data-tab="login"]');
        const tabRegister = document.querySelector('[data-tab="register"]');
        const toReg = document.querySelector('.switch-reg');
        const toLogin = document.querySelector('.switch-login');
        const sendCode = document.querySelector('.btn-send-code');

        closeBtn.onclick = () => this.close();
        this.modal.onclick = (e) => {
            if (e.target === this.modal) this.close();
        };
        tabLogin.onclick = () => this.switchTab('login');
        tabRegister.onclick = () => this.switchTab('register');
        toReg.onclick = () => this.switchTab('register');
        toLogin.onclick = () => this.switchTab('login');

        this.loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();
            try {
                const result = await api.login({ username, password });
                if (result.code !== 200) throw new Error(result.msg);
                message.success(result.msg || '登录成功');
                localStorage.setItem('access_token', result.data.access_token);
                // 新增：保存用户信息
                localStorage.setItem('user_info', JSON.stringify(result.data.user_info));
                console.log('用户信息保存成功:', result.data.user_info);
                authClose();
                location.reload();
            } catch (err) {
                message.error(err.response?.data?.msg || err.message || '登录失败');
            }
        };

        this.registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const userInfo = {
                username: document.getElementById('register-username').value.trim(),
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('register-password').value.trim(),
                code: document.getElementById('register-code').value.trim()
            };
            try {
                const result = await api.register(userInfo);
                if (result.code !== 200) throw new Error(result.msg);
                message.success(result.msg || '注册成功，请登录');
                this.switchTab('login');
            } catch (err) {
                message.error(err.response?.data?.msg || err.message || '注册失败');
            }
        };

        sendCode.onclick = async () => {
            const email = document.getElementById('email').value.trim();
            if (!email) return message.error('请输入邮箱');
            try {
                const result = await api.sendCode({ email });
                if (result.code !== 200) throw new Error(result.msg);
                message.success('验证码已发送');
            } catch (err) {
                message.error(err.response?.data?.msg || err.message || '发送失败');
            }
        };
    }
}

// 初始化实例
function initAuthModal() {
    if (!authInstance) {
        authInstance = new AuthModal();
    }
}

// 对外导出独立函数，全局可用
window.authOpen = function() {
    if (!authInstance) initAuthModal();
    authInstance.open();
};
window.authClose = function() {
    if (authInstance) authInstance.close();
};
window.authSwitchTab = function(type) {
    if (authInstance) authInstance.switchTab(type);
};