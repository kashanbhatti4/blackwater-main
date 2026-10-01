// ========================================================
// Blackwater Digital Blog CMS - Admin App Controller
// ========================================================

document.addEventListener('DOMContentLoaded', async () => {
    // State
    const state = {
        currentView: 'list', // 'login', 'list', 'editor'
        editingBlogId: null,
        blogs: [],
        categories: [],
        tags: [],
        currentFilter: 'all',
        searchQuery: '',
        featuredImageUrl: null,
        previousImageUrl: null,
        isAutoSlug: true
    };

    // DOM Elements
    const authScreen = document.getElementById('auth-screen');
    const appLayout = document.getElementById('app-layout');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const loginSubmitBtn = document.getElementById('login-submit-btn');

    const blogsListView = document.getElementById('blogs-list-view');
    const blogEditorView = document.getElementById('blog-editor-view');
    const blogsTableBody = document.getElementById('blogs-table-body');
    const blogsSearchInput = document.getElementById('blogs-search-input');
    const blogsCountTotal = document.getElementById('count-total');
    const blogsCountPublished = document.getElementById('count-published');
    const blogsCountDrafts = document.getElementById('count-drafts');

    // Editor Elements
    const editorForm = document.getElementById('blog-editor-form');
    const editorHeading = document.getElementById('editor-heading');
    const titleInput = document.getElementById('blog-title-input');
    const slugInput = document.getElementById('blog-slug-input');
    const excerptInput = document.getElementById('blog-excerpt-input');
    const contentEditor = document.getElementById('blog-content-editor');
    const categorySelect = document.getElementById('blog-category-select');
    const statusSelect = document.getElementById('blog-status-select');
    const readingTimeInput = document.getElementById('blog-reading-time');
    const publishedAtInput = document.getElementById('blog-published-at');
    const metaTitleInput = document.getElementById('blog-meta-title');
    const metaDescInput = document.getElementById('blog-meta-desc');

    // Image Upload Elements
    const imageDropzone = document.getElementById('image-dropzone');
    const imageFileInput = document.getElementById('image-file-input');
    const imagePreview = document.getElementById('image-preview');
    const imageRemoveBtn = document.getElementById('image-remove-btn');
    const imageUploadPrompt = document.getElementById('image-upload-prompt');

    // Tag Elements
    const tagInput = document.getElementById('tag-input');
    const tagContainer = document.getElementById('tag-container');

    // SEO Preview Elements
    const seoPreviewTitle = document.getElementById('seo-preview-title');
    const seoPreviewUrl = document.getElementById('seo-preview-url');
    const seoPreviewDesc = document.getElementById('seo-preview-desc');

    // Toast
    const toast = document.getElementById('cms-toast');
    const toastMessage = document.getElementById('cms-toast-msg');

    function showToast(message, type = 'success') {
        toast.className = `cms-toast cms-toast-${type} show`;
        toastMessage.textContent = message;
        setTimeout(() => {
            toast.className = 'cms-toast';
        }, 3500);
    }

    // ----------------------------------------------------
    // Auth & Init
    // ----------------------------------------------------
    async function init() {
        const auth = await AdminAPI.checkAuth();
        if (auth.authenticated) {
            showApp();
        } else {
            showLogin();
        }
    }

    window.addEventListener('admin:unauthorized', () => {
        showLogin();
        showToast('Session expired. Please log in again.', 'error');
    });

    function showLogin() {
        authScreen.style.display = 'flex';
        appLayout.style.display = 'none';
    }

    function showApp() {
        authScreen.style.display = 'none';
        appLayout.style.display = 'flex';
        const user = AdminAPI.getUser();
        const userNameEl = document.getElementById('current-user-name');
        if (userNameEl && user.username) {
            userNameEl.textContent = user.username;
        }
        loadBlogs();
        loadCategories();
    }

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Authenticating...';

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            await AdminAPI.login(username, password);
            showToast('Welcome back to Blackwater CMS');
            showApp();
        } catch (err) {
            loginError.textContent = err.message || 'Login failed';
            loginError.style.display = 'block';
        } finally {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Sign In to Dashboard';
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out?')) {
            await AdminAPI.logout();
            showLogin();
            showToast('Logged out successfully');
        }
    });

    // ----------------------------------------------------
    // Load & Render Blogs
    // ----------------------------------------------------
    async function loadBlogs() {
        try {
            const data = await AdminAPI.getAllBlogs();
            state.blogs = data.blogs || [];

            // Update stats
            if (data.stats) {
                blogsCountTotal.textContent = data.stats.total;
                blogsCountPublished.textContent = data.stats.publishedCount;
                blogsCountDrafts.textContent = data.stats.draftCount;
            }

            renderBlogsTable();
        } catch (err) {
            showToast('Failed to load blogs: ' + err.message, 'error');
        }
    }

    function renderBlogsTable() {
        let filtered = state.blogs;

        // Status Filter
        if (state.currentFilter !== 'all') {
            filtered = filtered.filter(b => b.status === state.currentFilter);
        }

        // Search Filter
        if (state.searchQuery.trim()) {
            const q = state.searchQuery.toLowerCase();
            filtered = filtered.filter(b => 
                (b.title && b.title.toLowerCase().includes(q)) ||
                (b.slug && b.slug.toLowerCase().includes(q)) ||
                (b.category_name && b.category_name.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            blogsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 48px 0;">
                        No blogs found matching the criteria.
                    </td>
                </tr>
            `;
            return;
        }

        blogsTableBody.innerHTML = filtered.map(blog => {
            const dateStr = blog.published_at 
                ? new Date(blog.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Not Published';
            const thumbImg = blog.featured_image 
                ? `<img src="${blog.featured_image}" class="cms-blog-thumb" alt="${blog.title}" onerror="this.src='/logo.svg'">`
                : `<div class="cms-blog-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:10px;">NO IMG</div>`;

            return `
                <tr>
                    <td>
                        <div class="cms-blog-cell">
                            ${thumbImg}
                            <div class="cms-blog-info">
                                <h4>${escapeHtml(blog.title)}</h4>
                                <div class="cms-blog-slug">/blog/${escapeHtml(blog.slug)}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="cms-badge cms-badge-category">${escapeHtml(blog.category_name || blog.category_title || 'General')}</span>
                    </td>
                    <td>
                        <span class="cms-badge cms-badge-${blog.status}">${blog.status}</span>
                    </td>
                    <td style="color: var(--text-secondary); font-size: 13px;">
                        ${dateStr}
                    </td>
                    <td>
                        <div class="cms-actions-cell">
                            <button class="cms-btn cms-btn-secondary cms-btn-sm" onclick="window.editBlog(${blog.id})" title="Edit Blog">
                                Edit
                            </button>
                            <button class="cms-btn cms-btn-secondary cms-btn-sm" onclick="window.toggleBlogStatus(${blog.id}, '${blog.status === 'published' ? 'draft' : 'published'}')" title="Toggle Status">
                                ${blog.status === 'published' ? 'Unpublish' : 'Publish'}
                            </button>
                            <a href="/blog/${blog.slug}" target="_blank" class="cms-btn cms-btn-secondary cms-btn-sm" title="View Public Post" data-barba-prevent>
                                View ↗
                            </a>
                            <button class="cms-btn cms-btn-danger cms-btn-sm" onclick="window.deleteBlog(${blog.id})" title="Delete Blog">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Filter Buttons
    document.querySelectorAll('.cms-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cms-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            renderBlogsTable();
        });
    });

    // Search Input
    blogsSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderBlogsTable();
    });

    // ----------------------------------------------------
    // Categories
    // ----------------------------------------------------
    async function loadCategories() {
        try {
            state.categories = await AdminAPI.getCategories();
            categorySelect.innerHTML = '<option value="">Select Category...</option>';
            state.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                categorySelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to load categories:', e);
        }
    }

    document.getElementById('add-category-btn').addEventListener('click', async () => {
        const name = prompt('Enter new category name:');
        if (!name || !name.trim()) return;

        try {
            const result = await AdminAPI.createCategory(name.trim());
            showToast(`Category "${name}" created`);
            await loadCategories();
            categorySelect.value = result.id;
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ----------------------------------------------------
    // Blog Editor: Open New / Edit
    // ----------------------------------------------------
    window.openNewBlogEditor = function() {
        state.editingBlogId = null;
        state.featuredImageUrl = null;
        state.previousImageUrl = null;
        state.tags = [];
        state.isAutoSlug = true;

        editorHeading.textContent = 'Create New Blog Post';
        editorForm.reset();
        contentEditor.innerHTML = '<p>Write your article here...</p>';
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        imageRemoveBtn.style.display = 'none';
        imageUploadPrompt.style.display = 'block';

        renderTags();
        updateSeoPreview();

        // Default published date to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        publishedAtInput.value = now.toISOString().slice(0, 16);

        switchView('editor');
    };

    window.editBlog = async function(id) {
        try {
            const data = await AdminAPI.getBlog(id);
            const blog = data.blog;

            state.editingBlogId = blog.id;
            state.featuredImageUrl = blog.featured_image || null;
            state.previousImageUrl = blog.featured_image || null;
            state.tags = (blog.tags || []).map(t => t.name);
            state.isAutoSlug = false;

            editorHeading.textContent = `Edit Post: ${blog.title}`;
            titleInput.value = blog.title || '';
            slugInput.value = blog.slug || '';
            excerptInput.value = blog.excerpt || '';
            contentEditor.innerHTML = blog.content || '';
            categorySelect.value = blog.category_id || '';
            statusSelect.value = blog.status || 'draft';
            readingTimeInput.value = blog.reading_time || '5 min';
            metaTitleInput.value = blog.meta_title || '';
            metaDescInput.value = blog.meta_description || '';

            if (blog.published_at) {
                const pubDate = new Date(blog.published_at);
                pubDate.setMinutes(pubDate.getMinutes() - pubDate.getTimezoneOffset());
                publishedAtInput.value = pubDate.toISOString().slice(0, 16);
            }

            // Featured Image preview
            if (blog.featured_image) {
                imagePreview.src = blog.featured_image;
                imagePreview.style.display = 'block';
                imageRemoveBtn.style.display = 'inline-flex';
                imageUploadPrompt.style.display = 'none';
            } else {
                imagePreview.style.display = 'none';
                imageRemoveBtn.style.display = 'none';
                imageUploadPrompt.style.display = 'block';
            }

            renderTags();
            updateSeoPreview();
            switchView('editor');
        } catch (err) {
            showToast('Failed to load blog for editing: ' + err.message, 'error');
        }
    };

    window.toggleBlogStatus = async function(id, newStatus) {
        try {
            await AdminAPI.toggleStatus(id, newStatus);
            showToast(`Blog is now ${newStatus}`);
            await loadBlogs();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    window.deleteBlog = async function(id) {
        if (!confirm('Are you sure you want to permanently delete this blog? This action cannot be undone.')) {
            return;
        }

        try {
            await AdminAPI.deleteBlog(id);
            showToast('Blog deleted successfully');
            await loadBlogs();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    function switchView(viewName) {
        state.currentView = viewName;
        if (viewName === 'list') {
            blogsListView.style.display = 'block';
            blogEditorView.style.display = 'none';
        } else if (viewName === 'editor') {
            blogsListView.style.display = 'none';
            blogEditorView.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    document.getElementById('nav-blogs-btn').addEventListener('click', () => {
        switchView('list');
        loadBlogs();
    });

    document.getElementById('nav-create-btn').addEventListener('click', () => {
        window.openNewBlogEditor();
    });

    document.getElementById('editor-cancel-btn').addEventListener('click', () => {
        if (confirm('Discard changes and return to blog list?')) {
            switchView('list');
        }
    });

    // ----------------------------------------------------
    // Auto Slug & SEO Live Preview
    // ----------------------------------------------------
    titleInput.addEventListener('input', () => {
        if (state.isAutoSlug) {
            slugInput.value = generateSlug(titleInput.value);
        }
        updateSeoPreview();
    });

    slugInput.addEventListener('input', () => {
        state.isAutoSlug = false;
        updateSeoPreview();
    });

    excerptInput.addEventListener('input', updateSeoPreview);
    metaTitleInput.addEventListener('input', updateSeoPreview);
    metaDescInput.addEventListener('input', updateSeoPreview);

    function generateSlug(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function updateSeoPreview() {
        const title = metaTitleInput.value.trim() || titleInput.value.trim() || 'Your Blog Post Title';
        const slug = slugInput.value.trim() || 'your-blog-slug';
        const desc = metaDescInput.value.trim() || excerptInput.value.trim() || 'A compelling summary of this article will appear here in search engine results.';

        seoPreviewTitle.textContent = title;
        seoPreviewUrl.textContent = `https://bwdigitalmarketing.ie/blog/${slug}`;
        seoPreviewDesc.textContent = desc;
    }

    // ----------------------------------------------------
    // Featured Image Handling
    // ----------------------------------------------------
    imageDropzone.addEventListener('click', (e) => {
        if (e.target !== imageRemoveBtn && !imageRemoveBtn.contains(e.target)) {
            imageFileInput.click();
        }
    });

    imageFileInput.addEventListener('change', async () => {
        if (imageFileInput.files && imageFileInput.files[0]) {
            await handleImageFile(imageFileInput.files[0]);
        }
    });

    imageDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageDropzone.classList.add('dragover');
    });

    imageDropzone.addEventListener('dragleave', () => {
        imageDropzone.classList.remove('dragover');
    });

    imageDropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        imageDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleImageFile(e.dataTransfer.files[0]);
        }
    });

    async function handleImageFile(file) {
        if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
            showToast('Only JPG, PNG, or WebP images are allowed.', 'error');
            return;
        }

        const promptText = imageUploadPrompt.querySelector('p');
        promptText.textContent = 'Uploading image...';

        try {
            const upload = await AdminAPI.uploadImage(file);
            state.featuredImageUrl = upload.url;

            imagePreview.src = upload.url;
            imagePreview.style.display = 'block';
            imageRemoveBtn.style.display = 'inline-flex';
            imageUploadPrompt.style.display = 'none';

            showToast('Featured image uploaded successfully');
        } catch (err) {
            showToast('Image upload failed: ' + err.message, 'error');
        } finally {
            promptText.textContent = 'Click or drag image here to upload';
        }
    }

    imageRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.featuredImageUrl = null;
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imageRemoveBtn.style.display = 'none';
        imageUploadPrompt.style.display = 'block';
        imageFileInput.value = '';
    });

    // ----------------------------------------------------
    // Tags Input
    // ----------------------------------------------------
    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.value.trim().replace(/^#/, '');
            if (tag && !state.tags.includes(tag)) {
                state.tags.push(tag);
                renderTags();
            }
            tagInput.value = '';
        }
    });

    function renderTags() {
        tagContainer.innerHTML = state.tags.map((tag, idx) => `
            <div class="cms-tag-chip">
                #${escapeHtml(tag)}
                <button type="button" onclick="window.removeTag(${idx})">&times;</button>
            </div>
        `).join('');
    }

    window.removeTag = function(index) {
        state.tags.splice(index, 1);
        renderTags();
    };

    // ----------------------------------------------------
    // Rich Text Editor Toolbar Actions
    // ----------------------------------------------------
    document.querySelectorAll('.cms-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.dataset.command;
            const value = btn.dataset.value || null;

            if (command === 'createLink') {
                const url = prompt('Enter link URL (e.g. https://...):');
                if (url) document.execCommand('createLink', false, url);
            } else if (command === 'formatBlock') {
                document.execCommand('formatBlock', false, value);
            } else {
                document.execCommand(command, false, value);
            }
            contentEditor.focus();
        });
    });

    // ----------------------------------------------------
    // Save / Submit Blog Form
    // ----------------------------------------------------
    editorForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        const slug = slugInput.value.trim();
        const content = contentEditor.innerHTML.trim();

        if (!title) {
            showToast('Please enter a blog title', 'error');
            titleInput.focus();
            return;
        }

        if (!content || content === '<p><br></p>' || content === '<p>Write your article here...</p>') {
            showToast('Please write article content', 'error');
            contentEditor.focus();
            return;
        }

        const selectedCatOption = categorySelect.options[categorySelect.selectedIndex];
        const category_name = selectedCatOption && selectedCatOption.value ? selectedCatOption.text : null;
        const category_id = categorySelect.value ? parseInt(categorySelect.value, 10) : null;

        const payload = {
            title,
            slug,
            excerpt: excerptInput.value.trim(),
            content,
            featured_image: state.featuredImageUrl,
            category_id,
            category_name,
            status: statusSelect.value,
            reading_time: readingTimeInput.value.trim() || '5 min',
            meta_title: metaTitleInput.value.trim() || title,
            meta_description: metaDescInput.value.trim() || excerptInput.value.trim(),
            published_at: publishedAtInput.value ? new Date(publishedAtInput.value).toISOString() : null,
            tags: state.tags,
            delete_previous_image: state.previousImageUrl && state.previousImageUrl !== state.featuredImageUrl
        };

        const submitBtn = document.getElementById('editor-save-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            if (state.editingBlogId) {
                await AdminAPI.updateBlog(state.editingBlogId, payload);
                showToast('Blog post updated successfully!');
            } else {
                await AdminAPI.createBlog(payload);
                showToast('Blog post published/created successfully!');
            }

            await loadBlogs();
            switchView('list');
        } catch (err) {
            showToast('Error saving blog: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Post';
        }
    });

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Run
    init();
});
