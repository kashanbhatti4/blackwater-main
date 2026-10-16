// ========================================================
// Blackwater Digital Blog CMS - Admin App Controller
// ========================================================

document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);

    // State
    const state = {
        currentView: 'list', // 'list' | 'editor'
        editingBlogId: null,
        editingStatus: 'draft',
        blogs: [],
        categories: [],
        tags: [],
        currentFilter: 'all',
        searchQuery: '',
        featuredImageUrl: null,
        previousImageUrl: null,
        isAutoSlug: true,
        snapshot: '',
        dirty: false,
        saving: false,
        seo: null,
        lastSavedAt: null
    };

    // Auth
    const authScreen = $('auth-screen');
    const appLayout = $('app-layout');
    const loginForm = $('login-form');
    const loginError = $('login-error');
    const loginSubmitBtn = $('login-submit-btn');

    // List
    const blogsListView = $('blogs-list-view');
    const blogEditorView = $('blog-editor-view');
    const blogsTableBody = $('blogs-table-body');
    const blogsSearchInput = $('blogs-search-input');

    // Editor
    const editorForm = $('blog-editor-form');
    const editorHeading = $('editor-heading');
    const statusChip = $('editor-status-chip');
    const saveStateEl = $('editor-save-state');
    const viewLink = $('editor-view-link');
    const secondaryBtn = $('editor-secondary-btn');
    const saveBtn = $('editor-save-btn');
    const titleInput = $('blog-title-input');
    const slugInput = $('blog-slug-input');
    const slugResetBtn = $('slug-reset-btn');
    const categorySelect = $('blog-category-select');
    const publishedAtInput = $('blog-published-at');
    const metaTitleInput = $('blog-meta-title');
    const metaDescInput = $('blog-meta-desc');
    const focusKeywordInput = $('blog-focus-keyword');

    // Featured image
    const imageDropzone = $('image-dropzone');
    const imageFileInput = $('image-file-input');
    const imagePreview = $('image-preview');
    const imageUploadPrompt = $('image-upload-prompt');
    const imageActions = $('image-actions');

    // Tags
    const tagInput = $('tag-input');
    const tagContainer = $('tag-container');

    // Toast
    const toast = $('cms-toast');
    const toastMessage = $('cms-toast-msg');
    let toastTimer = null;

    function showToast(message, type = 'success') {
        toast.className = `cms-toast cms-toast-${type} show`;
        toastMessage.textContent = message;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = 'cms-toast'; }, 3500);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function debounce(fn, ms) {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    // ----------------------------------------------------
    // Rich text editor
    // ----------------------------------------------------
    const editor = new RichEditor({
        root: $('rich-editor'),
        area: $('blog-content-editor'),
        source: $('blog-content-source'),
        toolbar: document.querySelector('#rich-editor .cms-rich-toolbar'),
        hint: $('editor-hint'),
        uploadImage: file => AdminAPI.uploadImage(file),
        notify: (message, type) => showToast(message, type || 'success'),
        onChange: () => onContentChange()
    });

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
        showToast('Your session expired. Please sign in again.', 'error');
    });

    function showLogin() {
        authScreen.style.display = 'flex';
        appLayout.style.display = 'none';
        if (window.bwTurnstile) window.bwTurnstile.mount(authScreen);
    }

    function showApp() {
        authScreen.style.display = 'none';
        appLayout.style.display = 'flex';
        const user = AdminAPI.getUser();
        if (user.username) {
            $('current-user-name').textContent = user.username;
            $('current-user-avatar').textContent = user.username.charAt(0);
        }
        loadBlogs();
        loadCategories();
    }

    // Show / hide password
    const passwordInput = $('login-password');
    const passwordToggle = $('login-password-toggle');
    passwordToggle.addEventListener('click', () => {
        const show = passwordInput.type === 'password';
        passwordInput.type = show ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(show));
        passwordToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        passwordInput.focus();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';

        const username = $('login-username').value.trim();
        const password = $('login-password').value;
        if (!username || !password) {
            loginError.textContent = 'Enter your username or email and your password.';
            loginError.style.display = 'block';
            (username ? passwordInput : $('login-username')).focus();
            return;
        }
        const turnstileToken = window.bwTurnstile ? window.bwTurnstile.token(loginForm) : '';
        if (window.bwTurnstile && window.bwTurnstile.required(loginForm) && !turnstileToken) {
            loginError.textContent = 'Please complete the security check.';
            loginError.style.display = 'block';
            return;
        }

        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Signing in…';
        try {
            await AdminAPI.login(username, password, turnstileToken);
            loginForm.reset();
            showToast('Welcome back');
            showApp();
        } catch (err) {
            loginError.textContent = err.message || 'Sign in failed';
            loginError.style.display = 'block';
        } finally {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Sign in';
            if (window.bwTurnstile) window.bwTurnstile.reset(loginForm);
        }
    });

    $('logout-btn').addEventListener('click', async () => {
        if (state.currentView === 'editor' && state.dirty && !confirm('You have unsaved changes. Sign out anyway? They stay backed up in this browser.')) return;
        if (!confirm('Sign out of the admin?')) return;
        await AdminAPI.logout();
        switchView('list');
        showLogin();
        showToast('Signed out');
    });

    // ----------------------------------------------------
    // Articles list
    // ----------------------------------------------------
    async function loadBlogs() {
        try {
            const data = await AdminAPI.getAllBlogs();
            state.blogs = data.blogs || [];
            if (data.stats) {
                $('count-total').textContent = data.stats.total;
                $('count-published').textContent = data.stats.publishedCount;
                $('count-drafts').textContent = data.stats.draftCount;
            }
            renderBlogsTable();
        } catch (err) {
            showToast('Could not load articles: ' + err.message, 'error');
        }
    }

    function seoBadge(score) {
        if (score === null || score === undefined || score === '') return '<span class="cms-seo-pill is-none">–</span>';
        const r = SeoAnalyzer.rating(Number(score));
        return `<span class="cms-seo-pill is-${r.key}" title="SEO score: ${r.label}">${Number(score)}</span>`;
    }

    function renderBlogsTable() {
        let filtered = state.blogs;
        if (state.currentFilter !== 'all') filtered = filtered.filter(b => b.status === state.currentFilter);
        if (state.searchQuery.trim()) {
            const q = state.searchQuery.toLowerCase();
            filtered = filtered.filter(b =>
                (b.title && b.title.toLowerCase().includes(q)) ||
                (b.slug && b.slug.toLowerCase().includes(q)) ||
                (b.category_name && b.category_name.toLowerCase().includes(q)) ||
                (b.focus_keyword && b.focus_keyword.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            blogsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="cms-table-empty">
                        ${state.blogs.length ? 'No articles match this search.' : 'No articles yet. Click “New article” to write the first one.'}
                    </td>
                </tr>`;
            return;
        }

        blogsTableBody.innerHTML = filtered.map(blog => {
            const dateStr = blog.published_at
                ? new Date(blog.published_at).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Not published';
            const thumbImg = blog.featured_image
                ? `<img src="${escapeHtml(blog.featured_image)}" class="cms-blog-thumb" alt="" onerror="this.style.visibility='hidden'">`
                : `<div class="cms-blog-thumb cms-blog-thumb-empty">No image</div>`;
            const nextStatus = blog.status === 'published' ? 'draft' : 'published';

            return `
                <tr>
                    <td>
                        <div class="cms-blog-cell">
                            ${thumbImg}
                            <div class="cms-blog-info">
                                <h4><button type="button" class="cms-title-link" onclick="window.editBlog(${blog.id})">${escapeHtml(blog.title)}</button></h4>
                                <div class="cms-blog-slug">/blog/${escapeHtml(blog.slug)}${blog.focus_keyword ? ` · <span class="cms-blog-kw">${escapeHtml(blog.focus_keyword)}</span>` : ''}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="cms-badge cms-badge-category">${escapeHtml(blog.category_name || blog.category_title || 'General')}</span></td>
                    <td><span class="cms-badge cms-badge-${blog.status}">${blog.status}</span></td>
                    <td>${seoBadge(blog.seo_score)}</td>
                    <td class="cms-table-date">${dateStr}</td>
                    <td>
                        <div class="cms-actions-cell">
                            <button class="cms-btn cms-btn-secondary cms-btn-sm" onclick="window.editBlog(${blog.id})">Edit</button>
                            <button class="cms-btn cms-btn-secondary cms-btn-sm" onclick="window.toggleBlogStatus(${blog.id}, '${nextStatus}')">
                                ${blog.status === 'published' ? 'Unpublish' : 'Publish'}
                            </button>
                            <a href="/blog/${encodeURIComponent(blog.slug)}" target="_blank" rel="noopener" class="cms-btn cms-btn-secondary cms-btn-sm">View ↗</a>
                            <button class="cms-btn cms-btn-danger cms-btn-sm" onclick="window.deleteBlog(${blog.id})">Delete</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    document.querySelectorAll('.cms-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cms-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            renderBlogsTable();
        });
    });

    blogsSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderBlogsTable();
    });

    window.toggleBlogStatus = async function (id, newStatus) {
        try {
            await AdminAPI.toggleStatus(id, newStatus);
            showToast(newStatus === 'published' ? 'Article published' : 'Article moved to drafts');
            await loadBlogs();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    window.deleteBlog = async function (id) {
        const blog = state.blogs.find(b => b.id === id);
        if (!confirm(`Delete “${blog ? blog.title : 'this article'}” permanently? This can't be undone.`)) return;
        try {
            await AdminAPI.deleteBlog(id);
            showToast('Article deleted');
            await loadBlogs();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // ----------------------------------------------------
    // Categories
    // ----------------------------------------------------
    async function loadCategories(selectId) {
        try {
            state.categories = await AdminAPI.getCategories();
            const current = selectId !== undefined ? String(selectId) : categorySelect.value;
            categorySelect.innerHTML = '<option value="">Choose a category…</option>';
            state.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                categorySelect.appendChild(opt);
            });
            categorySelect.value = current || '';
        } catch (e) {
            console.error('Failed to load categories:', e);
        }
    }

    const newCategoryRow = $('new-category-row');
    const newCategoryInput = $('new-category-input');

    $('add-category-btn').addEventListener('click', () => {
        newCategoryRow.hidden = !newCategoryRow.hidden;
        if (!newCategoryRow.hidden) newCategoryInput.focus();
    });

    async function addCategory() {
        const name = newCategoryInput.value.trim();
        if (!name) { newCategoryInput.focus(); return; }
        try {
            const result = await AdminAPI.createCategory(name);
            await loadCategories(result.id);
            newCategoryInput.value = '';
            newCategoryRow.hidden = true;
            markChanged();
            showToast(`Category “${name}” added`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    $('new-category-save').addEventListener('click', addCategory);
    newCategoryInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
        if (e.key === 'Escape') { newCategoryRow.hidden = true; }
    });

    // ----------------------------------------------------
    // Editor: open new / edit
    // ----------------------------------------------------
    function toLocalInput(date) {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    function fillEditor(values) {
        titleInput.value = values.title || '';
        slugInput.value = values.slug || '';
        editor.setHTML(values.content || '');
        categorySelect.value = values.category_id || '';
        metaTitleInput.value = values.meta_title || '';
        metaDescInput.value = values.meta_description || '';
        focusKeywordInput.value = values.focus_keyword || '';
        publishedAtInput.value = values.published_at ? toLocalInput(values.published_at) : '';
        state.tags = Array.isArray(values.tags) ? values.tags.slice() : [];
        setFeaturedImage(values.featured_image || null);
        renderTags();
        autoGrow(titleInput);
        updateSlugReset();
        refreshAll();
    }

    window.openNewBlogEditor = function () {
        if (!confirmLeave()) return;
        state.editingBlogId = null;
        state.editingStatus = 'draft';
        state.previousImageUrl = null;
        state.isAutoSlug = true;
        newCategoryRow.hidden = true;
        fillEditor({ published_at: new Date() });
        takeSnapshot();
        updateEditorChrome();
        switchView('editor');
        offerRestore();
        setTimeout(() => titleInput.focus(), 50);
    };

    window.editBlog = async function (id) {
        if (!confirmLeave()) return;
        try {
            const data = await AdminAPI.getBlog(id);
            const blog = data.blog;
            state.editingBlogId = blog.id;
            state.editingStatus = blog.status || 'draft';
            state.previousImageUrl = blog.featured_image || null;
            state.isAutoSlug = false;
            newCategoryRow.hidden = true;
            fillEditor({
                ...blog,
                // Older posts stored the post title / excerpt as meta fields; show those as "use default"
                meta_title: blog.meta_title && blog.meta_title !== blog.title ? blog.meta_title : '',
                meta_description: blog.meta_description
                    && blog.meta_description !== blog.excerpt
                    && blog.meta_description !== shorten(excerptFrom(blog.content), 158)
                    ? blog.meta_description : '',
                tags: (blog.tags || []).map(t => t.name)
            });
            takeSnapshot();
            updateEditorChrome();
            switchView('editor');
            offerRestore();
        } catch (err) {
            showToast('Could not open the article: ' + err.message, 'error');
        }
    };

    function updateEditorChrome() {
        const isNew = !state.editingBlogId;
        const published = state.editingStatus === 'published';
        editorHeading.textContent = isNew ? 'New article' : 'Edit article';
        statusChip.textContent = published ? 'Published' : 'Draft';
        statusChip.className = `cms-badge cms-badge-${published ? 'published' : 'draft'}`;
        secondaryBtn.textContent = published ? 'Unpublish' : 'Save draft';
        saveBtn.textContent = published ? 'Update' : 'Publish';
        viewLink.hidden = isNew || !published;
        if (!isNew) viewLink.href = `/blog/${encodeURIComponent(slugInput.value.trim())}`;
        $('nav-blogs-btn').classList.toggle('active', !isNew);
        $('nav-create-btn').classList.toggle('active', isNew);
        updateSlugReset();
        updateSaveState();
    }

    function switchView(viewName) {
        state.currentView = viewName;
        blogsListView.style.display = viewName === 'list' ? 'block' : 'none';
        blogEditorView.style.display = viewName === 'editor' ? 'block' : 'none';
        $('nav-blogs-btn').classList.toggle('active', viewName === 'list' || (viewName === 'editor' && !!state.editingBlogId));
        $('nav-create-btn').classList.toggle('active', viewName === 'editor' && !state.editingBlogId);
        document.body.classList.toggle('cms-editing', viewName === 'editor');
        if (viewName === 'list') editor.toggleFocus(false);
        // The title box can only measure itself once the editor is on screen
        if (viewName === 'editor') requestAnimationFrame(() => autoGrow(titleInput));
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function confirmLeave() {
        if (state.currentView !== 'editor' || !state.dirty) return true;
        return confirm('Leave this article? Your unsaved changes stay backed up in this browser and can be restored next time you open it.');
    }

    function backToList() {
        if (!confirmLeave()) return;
        switchView('list');
        loadBlogs();
    }

    $('nav-blogs-btn').addEventListener('click', backToList);
    $('nav-create-btn').addEventListener('click', () => window.openNewBlogEditor());
    $('editor-back-btn').addEventListener('click', backToList);

    // ----------------------------------------------------
    // Change tracking, local backup and restore
    // ----------------------------------------------------
    function collectValues() {
        const content = editor.getHTML();
        return {
            title: titleInput.value.trim(),
            slug: slugInput.value.trim(),
            excerpt: excerptFrom(content),
            content,
            category_id: categorySelect.value || '',
            meta_title: metaTitleInput.value.trim(),
            meta_description: metaDescInput.value.trim(),
            focus_keyword: focusKeywordInput.value.trim(),
            published_at: publishedAtInput.value || '',
            tags: state.tags.slice(),
            featured_image: state.featuredImageUrl || null
        };
    }

    function backupKey() {
        return `bw_cms_backup_${state.editingBlogId || 'new'}`;
    }

    function takeSnapshot() {
        state.snapshot = JSON.stringify(collectValues());
        state.dirty = false;
        updateSaveState();
    }

    function updateSaveState() {
        if (state.saving) {
            saveStateEl.textContent = 'Saving…';
            saveStateEl.className = 'cms-save-state is-saving';
        } else if (state.dirty) {
            saveStateEl.textContent = 'Unsaved changes';
            saveStateEl.className = 'cms-save-state is-dirty';
        } else if (state.lastSavedAt && state.editingBlogId) {
            saveStateEl.textContent = 'Saved ' + state.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            saveStateEl.className = 'cms-save-state is-saved';
        } else {
            saveStateEl.textContent = '';
            saveStateEl.className = 'cms-save-state';
        }
    }

    const backupNow = debounce(() => {
        if (state.currentView !== 'editor') return;
        const values = collectValues();
        const json = JSON.stringify(values);
        state.dirty = json !== state.snapshot;
        updateSaveState();
        try {
            if (state.dirty) localStorage.setItem(backupKey(), JSON.stringify({ savedAt: Date.now(), values }));
            else localStorage.removeItem(backupKey());
        } catch (e) { /* storage full or blocked */ }
    }, 600);

    function markChanged() {
        if (state.currentView !== 'editor') return;
        if (!state.dirty) {
            state.dirty = true;
            updateSaveState();
        }
        backupNow();
    }

    function offerRestore() {
        const banner = $('editor-restore-banner');
        banner.hidden = true;
        let backup = null;
        try { backup = JSON.parse(localStorage.getItem(backupKey()) || 'null'); } catch (e) { backup = null; }
        if (!backup || !backup.values || JSON.stringify(backup.values) === state.snapshot) return;
        const when = new Date(backup.savedAt);
        $('editor-restore-text').textContent =
            `Unsaved changes from ${when.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} at ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} were found in this browser.`;
        banner.hidden = false;
        $('editor-restore-btn').onclick = () => {
            fillEditor({ ...backup.values });
            banner.hidden = true;
            markChanged();
            showToast('Unsaved changes restored');
        };
        $('editor-restore-discard').onclick = () => {
            try { localStorage.removeItem(backupKey()); } catch (e) { /* ignore */ }
            banner.hidden = true;
        };
    }

    window.addEventListener('beforeunload', (e) => {
        if (state.currentView === 'editor' && state.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ----------------------------------------------------
    // Title, slug, summary
    // ----------------------------------------------------
    function autoGrow(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    // Offered only before publishing: changing a live article's address breaks links to it
    function updateSlugReset() {
        const generated = SeoAnalyzer.slugify(titleInput.value);
        slugResetBtn.hidden = state.isAutoSlug || !generated || slugInput.value === generated || state.editingStatus === 'published';
    }

    titleInput.addEventListener('input', () => {
        titleInput.value = titleInput.value.replace(/\n/g, ' ');
        autoGrow(titleInput);
        if (state.isAutoSlug) slugInput.value = SeoAnalyzer.slugify(titleInput.value);
        updateSlugReset();
        refreshAll();
        markChanged();
    });

    // Enter in the title moves on to the article body
    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            editor.area.focus();
        }
    });

    slugInput.addEventListener('input', () => {
        const cleaned = slugInput.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (cleaned !== slugInput.value) slugInput.value = cleaned;
        state.isAutoSlug = false;
        updateSlugReset();
        refreshAll();
        markChanged();
    });

    slugInput.addEventListener('blur', () => {
        slugInput.value = slugInput.value.replace(/-+/g, '-').replace(/^-|-$/g, '');
        refreshAll();
    });

    slugResetBtn.addEventListener('click', () => {
        state.isAutoSlug = true;
        slugInput.value = SeoAnalyzer.slugify(titleInput.value);
        updateSlugReset();
        refreshAll();
        markChanged();
    });

    [metaTitleInput, metaDescInput, focusKeywordInput, publishedAtInput].forEach(el => {
        el.addEventListener('input', () => { refreshAll(); markChanged(); });
    });
    categorySelect.addEventListener('change', markChanged);

    // ----------------------------------------------------
    // Live analysis: word count, reading time, SEO, preview
    // ----------------------------------------------------
    const onContentChange = debounce(() => {
        refreshAll();
        markChanged();
    }, 180);

    function effectiveSeoTitle() {
        return metaTitleInput.value.trim() || titleInput.value.trim();
    }

    // The excerpt is the article's first paragraph: blog cards show it (cut to three lines),
    // and it is the Google description unless one is written below
    function excerptFrom(html) {
        const box = document.createElement('div');
        box.innerHTML = html || '';
        const first = Array.from(box.querySelectorAll('p')).map(p => p.textContent.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
        return shorten(first, 220);
    }

    function shorten(text, max) {
        if (!text || text.length <= max) return text || '';
        const cut = text.slice(0, max - 1);
        const space = cut.lastIndexOf(' ');
        return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–]+$/, '') + '…';
    }

    function effectiveDescription(html) {
        return metaDescInput.value.trim() || shorten(excerptFrom(html !== undefined ? html : editor.getHTML()), 158);
    }

    function refreshAll() {
        const html = editor.getHTML();
        const otherKeywords = state.blogs
            .filter(b => b.id !== state.editingBlogId && b.focus_keyword)
            .map(b => b.focus_keyword);

        const result = SeoAnalyzer.analyze({
            keyword: focusKeywordInput.value,
            seoTitle: effectiveSeoTitle(),
            metaDescription: effectiveDescription(html),
            slug: slugInput.value,
            html,
            featuredImage: state.featuredImageUrl,
            otherKeywords
        });
        state.seo = result;

        // Counts
        const words = result.stats.wordCount;
        const minutes = result.stats.readingMinutes;
        $('editor-word-count').textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
        $('editor-read-time').textContent = `${minutes} min read`;
        $('stat-words').textContent = words.toLocaleString();
        $('stat-read-time').textContent = `${minutes} min`;

        renderSeo(result);
        renderPreview();
    }

    function meter(countEl, meterEl, length, max, okMin) {
        const pct = Math.min(100, (length / max) * 100);
        const key = length === 0 ? 'none' : length > max ? 'bad' : length >= okMin ? 'good' : 'ok';
        countEl.textContent = `${length} / ${max}`;
        countEl.className = `cms-count is-${key}`;
        meterEl.style.width = pct + '%';
        meterEl.className = `is-${key}`;
    }

    function truncate(text, max) {
        return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + ' …' : text;
    }

    function renderPreview() {
        const title = effectiveSeoTitle();
        const fullTitle = (title || 'Your article title') + SeoAnalyzer.TITLE_SUFFIX;
        const desc = effectiveDescription();
        const slug = slugInput.value.trim() || 'your-article';
        const keyword = focusKeywordInput.value.trim();

        $('seo-preview-title').textContent = truncate(fullTitle, 62);
        $('seo-preview-url').textContent = `bwdigitalmarketing.ie › blog › ${slug}`;
        let descHtml = escapeHtml(truncate(desc || 'Write the first paragraph, or a meta description, so Google shows a sentence you chose.', 160));
        if (keyword) {
            const re = new RegExp('(' + escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            descHtml = descHtml.replace(re, '<b>$1</b>');
        }
        $('seo-preview-desc').innerHTML = descHtml;
        $('seo-preview-desc').classList.toggle('is-placeholder', !desc);

        meter($('meta-title-count'), $('meta-title-meter'), title ? fullTitle.length : 0, 60, 30);
        meter($('meta-desc-count'), $('meta-desc-meter'), desc.length, 160, 120);
        metaTitleInput.placeholder = titleInput.value.trim() ? `Uses the title: ${titleInput.value.trim()}` : 'Uses the article title';
        metaDescInput.placeholder = excerptFrom(editor.area.innerHTML) ? 'Uses the first paragraph' : 'Write the sentence Google should show (120-160 characters)';
    }

    // SEO checklist: one collapsible group per category, kept open/closed across updates
    const seoGroups = {};

    function renderSeo(result) {
        const rating = SeoAnalyzer.rating(result.score);
        const hasKeyword = !!focusKeywordInput.value.trim();
        const ring = $('seo-ring');
        ring.style.setProperty('--score', result.score);
        ring.className = `cms-seo-ring is-${rating.key}`;
        $('seo-score').textContent = result.score;
        $('seo-rating').textContent = rating.label;
        $('seo-rating').className = `cms-seo-rating is-${rating.key}`;

        const fails = result.checks.filter(c => c.status === 'fail').length;
        const warns = result.checks.filter(c => c.status === 'warn').length;
        $('seo-summary-text').textContent = !hasKeyword
            ? 'Add a focus keyword to see the full analysis.'
            : fails + warns === 0
                ? 'Everything checks out.'
                : [fails ? `${fails} to fix` : '', warns ? `${warns} to improve` : ''].filter(Boolean).join(' · ');

        const badge = $('editor-seo-badge');
        badge.className = `cms-seo-badge is-${rating.key}`;
        $('editor-seo-badge-score').textContent = result.score;

        const container = $('seo-checks');
        const order = { fail: 0, warn: 1, pass: 2 };
        const byGroup = {};
        result.checks.filter(c => c.status !== 'na').forEach(c => { (byGroup[c.group] = byGroup[c.group] || []).push(c); });

        Object.entries(byGroup).forEach(([group, checks]) => {
            let entry = seoGroups[group];
            if (!entry) {
                const details = document.createElement('details');
                details.className = 'cms-seo-group';
                const summary = document.createElement('summary');
                const list = document.createElement('ul');
                details.append(summary, list);
                container.appendChild(details);
                entry = seoGroups[group] = { details, summary, list, touched: false };
                details.addEventListener('toggle', () => { entry.touched = true; });
            }
            const issues = checks.filter(c => c.status !== 'pass').length;
            entry.summary.innerHTML = `<span>${escapeHtml(group)}</span>` +
                (issues ? `<span class="cms-seo-count is-issue">${issues} issue${issues === 1 ? '' : 's'}</span>` : '<span class="cms-seo-count">All good</span>');
            if (!entry.touched) entry.details.open = issues > 0;
            entry.list.innerHTML = checks
                .slice()
                .sort((a, b) => order[a.status] - order[b.status])
                .map(c => `
                    <li class="cms-check-item is-${c.status}">
                        <span class="cms-check-icon" aria-hidden="true"></span>
                        <div>
                            <div class="cms-check-label">${escapeHtml(c.label)}</div>
                            ${c.status !== 'pass' ? `<div class="cms-check-tip">${escapeHtml(c.tip)}</div>` : ''}
                        </div>
                    </li>`).join('');
        });
    }

    $('editor-seo-badge').addEventListener('click', () => {
        $('seo-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!focusKeywordInput.value.trim()) setTimeout(() => focusKeywordInput.focus(), 350);
    });

    // ----------------------------------------------------
    // Featured image
    // ----------------------------------------------------
    function setFeaturedImage(url) {
        state.featuredImageUrl = url || null;
        imageUploadPrompt.querySelector('p').textContent = 'Click or drop an image';
        imageDropzone.classList.remove('is-missing');
        // An image that no longer exists on the server: say so instead of a broken icon
        imagePreview.onerror = () => {
            imagePreview.style.display = 'none';
            imageUploadPrompt.style.display = 'block';
            imageUploadPrompt.querySelector('p').textContent = 'This image is missing. Click to upload it again.';
            imageDropzone.classList.remove('has-image');
            imageDropzone.classList.add('is-missing');
        };
        if (url) {
            imagePreview.src = url;
            imagePreview.style.display = 'block';
            imageUploadPrompt.style.display = 'none';
            imageActions.hidden = false;
            imageDropzone.classList.add('has-image');
        } else {
            imagePreview.removeAttribute('src');
            imagePreview.style.display = 'none';
            imageUploadPrompt.style.display = 'block';
            imageActions.hidden = true;
            imageDropzone.classList.remove('has-image');
        }
    }

    imageDropzone.addEventListener('click', () => imageFileInput.click());
    imageDropzone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imageFileInput.click(); }
    });
    $('image-replace-btn').addEventListener('click', () => imageFileInput.click());
    $('image-remove-btn').addEventListener('click', () => {
        setFeaturedImage(null);
        imageFileInput.value = '';
        refreshAll();
        markChanged();
    });

    imageFileInput.addEventListener('change', async () => {
        if (imageFileInput.files && imageFileInput.files[0]) await handleImageFile(imageFileInput.files[0]);
        imageFileInput.value = '';
    });

    imageDropzone.addEventListener('dragover', (e) => { e.preventDefault(); imageDropzone.classList.add('dragover'); });
    imageDropzone.addEventListener('dragleave', () => imageDropzone.classList.remove('dragover'));
    imageDropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        imageDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) await handleImageFile(e.dataTransfer.files[0]);
    });

    async function handleImageFile(file) {
        if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
            showToast('Images must be JPG, PNG or WebP.', 'error');
            return;
        }
        const promptText = imageUploadPrompt.querySelector('p');
        promptText.textContent = 'Uploading…';
        imageDropzone.classList.add('is-uploading');
        try {
            const upload = await AdminAPI.uploadImage(file);
            setFeaturedImage(upload.url);
            refreshAll();
            markChanged();
            if (upload.stored === false) {
                showToast('Image uploaded, but its backup copy failed, so it may disappear after the next deploy.', 'error');
            } else {
                showToast('Featured image uploaded');
            }
        } catch (err) {
            showToast('Image upload failed: ' + err.message, 'error');
        } finally {
            promptText.textContent = 'Click or drop an image';
            imageDropzone.classList.remove('is-uploading');
        }
    }

    // ----------------------------------------------------
    // Tags
    // ----------------------------------------------------
    function addTagFromInput() {
        const parts = tagInput.value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
        let added = false;
        parts.forEach(tag => {
            if (!state.tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
                state.tags.push(tag);
                added = true;
            }
        });
        tagInput.value = '';
        if (added) { renderTags(); markChanged(); }
    }

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTagFromInput();
        } else if (e.key === 'Backspace' && !tagInput.value && state.tags.length) {
            state.tags.pop();
            renderTags();
            markChanged();
        }
    });
    tagInput.addEventListener('blur', addTagFromInput);

    function renderTags() {
        tagContainer.innerHTML = state.tags.map((tag, idx) => `
            <span class="cms-tag-chip">
                #${escapeHtml(tag)}
                <button type="button" aria-label="Remove ${escapeHtml(tag)}" onclick="window.removeTag(${idx})">&times;</button>
            </span>`).join('');
    }

    window.removeTag = function (index) {
        state.tags.splice(index, 1);
        renderTags();
        markChanged();
    };

    // ----------------------------------------------------
    // Save
    // ----------------------------------------------------
    async function save(status) {
        if (state.saving) return;
        const values = collectValues();

        if (!values.title) {
            showToast('Give the article a title first', 'error');
            titleInput.focus();
            return;
        }
        if (!values.content || !editor.area.textContent.trim() && !editor.area.querySelector('img, iframe')) {
            showToast('The article is empty', 'error');
            editor.area.focus();
            return;
        }
        if (!values.slug) {
            slugInput.value = SeoAnalyzer.slugify(values.title);
            values.slug = slugInput.value;
        }

        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        const result = state.seo || SeoAnalyzer.analyze({ html: values.content });
        const payload = {
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt,
            content: values.content,
            featured_image: values.featured_image,
            category_id: values.category_id ? parseInt(values.category_id, 10) : null,
            category_name: selectedOption && selectedOption.value ? selectedOption.text : null,
            status,
            reading_time: `${result.stats.readingMinutes} min`,
            meta_title: values.meta_title || values.title,
            meta_description: values.meta_description || shorten(values.excerpt, 158),
            focus_keyword: values.focus_keyword || null,
            seo_score: result.score,
            published_at: values.published_at ? new Date(values.published_at).toISOString() : null,
            tags: values.tags,
            delete_previous_image: !!(state.previousImageUrl && state.previousImageUrl !== values.featured_image)
        };

        state.saving = true;
        updateSaveState();
        saveBtn.disabled = true;
        secondaryBtn.disabled = true;

        try {
            const wasPublished = state.editingStatus === 'published';
            if (state.editingBlogId) {
                const res = await AdminAPI.updateBlog(state.editingBlogId, payload);
                if (res.slug && res.slug !== slugInput.value) slugInput.value = res.slug;
            } else {
                const res = await AdminAPI.createBlog(payload);
                try { localStorage.removeItem(backupKey()); } catch (e) { /* ignore */ }
                state.editingBlogId = res.id;
                if (res.slug) slugInput.value = res.slug;
            }
            try { localStorage.removeItem(backupKey()); } catch (e) { /* ignore */ }
            state.editingStatus = status;
            state.previousImageUrl = values.featured_image;
            state.isAutoSlug = false;
            state.lastSavedAt = new Date();
            state.saving = false;
            takeSnapshot();
            updateEditorChrome();
            updateSlugReset();
            showToast(status === 'published'
                ? (wasPublished ? 'Article updated' : 'Article published')
                : (wasPublished ? 'Article moved to drafts' : 'Draft saved'));
            loadBlogs();
        } catch (err) {
            showToast('Could not save: ' + err.message, 'error');
        } finally {
            state.saving = false;
            saveBtn.disabled = false;
            secondaryBtn.disabled = false;
            updateSaveState();
        }
    }

    editorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        save('published');
    });

    secondaryBtn.addEventListener('click', () => {
        if (state.editingStatus === 'published' && !confirm('Unpublish this article? It will be hidden from the website until you publish it again.')) return;
        save('draft');
    });

    // ⌘/Ctrl + S saves without changing the status
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && state.currentView === 'editor') {
            e.preventDefault();
            save(state.editingStatus);
        }
    });

    // Run
    init();
});
