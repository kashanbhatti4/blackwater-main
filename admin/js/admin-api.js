// ========================================================
// Blackwater Digital Blog CMS - Admin API Client
// ========================================================

const AdminAPI = {
    getToken() {
        return localStorage.getItem('bw_admin_token') || '';
    },

    setToken(token) {
        if (token) {
            localStorage.setItem('bw_admin_token', token);
        } else {
            localStorage.removeItem('bw_admin_token');
        }
    },

    async request(url, options = {}) {
        const headers = options.headers || {};
        const token = this.getToken();

        if (token && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        options.headers = headers;

        try {
            const response = await fetch(url, options);
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                this.setToken(null);
                if (!window.location.pathname.includes('login') && !options.skipAuthRedirect) {
                    window.dispatchEvent(new CustomEvent('admin:unauthorized'));
                }
            }

            if (!response.ok) {
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (err) {
            throw err;
        }
    },

    // ----------------------------------------------------
    // Auth Methods
    // ----------------------------------------------------
    async login(username, password, turnstileToken) {
        const data = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password, turnstileToken }),
            skipAuthRedirect: true
        });
        if (data.token) {
            this.setToken(data.token);
            if (data.admin) {
                localStorage.setItem('bw_admin_user', JSON.stringify(data.admin));
            }
        }
        return data;
    },

    async logout() {
        try {
            await this.request('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        this.setToken(null);
        localStorage.removeItem('bw_admin_user');
    },

    async checkAuth() {
        try {
            return await this.request('/api/auth/me', { method: 'GET', skipAuthRedirect: true });
        } catch (e) {
            return { authenticated: false };
        }
    },

    getUser() {
        try {
            return JSON.parse(localStorage.getItem('bw_admin_user') || '{}');
        } catch (e) {
            return {};
        }
    },

    // ----------------------------------------------------
    // Blog Methods
    // ----------------------------------------------------
    async getAllBlogs() {
        return await this.request('/api/blogs/admin/all', { method: 'GET' });
    },

    async getBlog(idOrSlug) {
        return await this.request(`/api/blogs/${encodeURIComponent(idOrSlug)}`, { method: 'GET' });
    },

    async createBlog(blogData) {
        return await this.request('/api/blogs', {
            method: 'POST',
            body: JSON.stringify(blogData)
        });
    },

    async updateBlog(id, blogData) {
        return await this.request(`/api/blogs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(blogData)
        });
    },

    async deleteBlog(id) {
        return await this.request(`/api/blogs/${id}`, {
            method: 'DELETE'
        });
    },

    async toggleStatus(id, newStatus) {
        return await this.request(`/api/blogs/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
    },

    // ----------------------------------------------------
    // Category Methods
    // ----------------------------------------------------
    async getCategories() {
        const data = await this.request('/api/categories', { method: 'GET' });
        return data.categories || [];
    },

    async createCategory(name) {
        return await this.request('/api/categories', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },

    // ----------------------------------------------------
    // Image Upload & Delete
    // ----------------------------------------------------
    // folderId files the image straight into a Media folder
    async uploadImage(file, folderId) {
        const formData = new FormData();
        formData.append('image', file);

        return await this.request(folderId ? `/api/upload?folder=${encodeURIComponent(folderId)}` : '/api/upload', {
            method: 'POST',
            body: formData
        });
    },

    async deleteImage(url) {
        return await this.request('/api/upload', {
            method: 'DELETE',
            body: JSON.stringify({ url })
        });
    },

    // ----------------------------------------------------
    // Media library
    // ----------------------------------------------------
    async getMedia() {
        return await this.request('/api/media', { method: 'GET' });
    },

    async createMediaFolder(name) {
        return await this.request('/api/media/folders', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },

    async renameMediaFolder(id, name) {
        return await this.request(`/api/media/folders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name })
        });
    },

    async deleteMediaFolder(id) {
        return await this.request(`/api/media/folders/${id}`, { method: 'DELETE' });
    },

    async moveMedia(filenames, folderId) {
        return await this.request('/api/media/move', {
            method: 'POST',
            body: JSON.stringify({ filenames, folder_id: folderId })
        });
    },

    // force: delete even when articles still use it (otherwise that fails with the list of articles)
    async deleteMedia(filename, force = false) {
        return await this.request(`/api/media/files/${encodeURIComponent(filename)}${force ? '?force=1' : ''}`, {
            method: 'DELETE'
        });
    }
};

window.AdminAPI = AdminAPI;
