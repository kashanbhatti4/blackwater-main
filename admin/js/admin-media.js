// ========================================================
// Blackwater Digital Blog CMS - Media library
// Every uploaded image, filed in folders, with the articles that use it.
// CmsMedia.mount({ showToast, escapeHtml }) once; CmsMedia.show() when the tab opens.
// ========================================================

(function () {
    const $ = id => document.getElementById(id);

    const state = {
        items: [],
        folders: [],
        missing: [],
        folder: 'all', // 'all' | 'none' (not in a folder) | folder id
        filter: 'all', // 'all' | 'used' | 'unused'
        search: '',
        selected: new Set(),
        detail: null, // filename open in the details dialog
        loaded: false
    };

    let toast = () => {};
    let esc = text => String(text ?? '');

    const grid = () => $('media-grid');

    function formatSize(bytes) {
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    }

    function absoluteUrl(url) {
        return new URL(url, window.location.origin).href;
    }

    function folderLabel(id) {
        const folder = state.folders.find(f => f.id === id);
        return folder ? folder.name : 'Not in a folder';
    }

    // ----------------------------------------------------
    // Loading
    // ----------------------------------------------------
    async function load() {
        try {
            const data = await AdminAPI.getMedia();
            state.items = data.items || [];
            state.folders = data.folders || [];
            state.missing = data.missing || [];
            state.loaded = true;
            if (typeof state.folder === 'number' && !state.folders.some(f => f.id === state.folder)) state.folder = 'all';
            const present = new Set(state.items.map(i => i.filename));
            state.selected.forEach(f => { if (!present.has(f)) state.selected.delete(f); });
            renderStorage(data.storage);
            render();
            if (state.detail) {
                if (present.has(state.detail)) openDetail(state.detail);
                else closeDetail();
            }
        } catch (err) {
            grid().innerHTML = `<p class="cms-media-empty">Could not load the media library: ${esc(err.message)}</p>`;
        }
    }

    function renderStorage(storage) {
        const el = $('media-storage');
        if (!storage) { el.textContent = ''; return; }
        el.classList.toggle('is-warning', !!storage.inProject);
        el.innerHTML = storage.inProject
            ? `Images are saved in <code>${esc(storage.dir)}</code>, inside the website folder, which deploys can wipe. Every image also has a backup in the database, so nothing is lost, but setting <code>UPLOAD_DIR</code> in .env to a folder outside the website folder is safer.`
            : `Images are saved in <code>${esc(storage.dir)}</code>, outside the website folder, so deploys don't touch them. Every image also has a backup in the database.`;
    }

    // ----------------------------------------------------
    // Rendering
    // ----------------------------------------------------
    function visibleItems() {
        const q = state.search.trim().toLowerCase();
        return state.items.filter(item => {
            if (state.folder === 'none' && item.folder_id) return false;
            if (typeof state.folder === 'number' && item.folder_id !== state.folder) return false;
            if (state.filter === 'used' && !item.used_in.length) return false;
            if (state.filter === 'unused' && item.used_in.length) return false;
            if (q && !item.filename.toLowerCase().includes(q) && !item.used_in.some(u => (u.title || '').toLowerCase().includes(q))) return false;
            return true;
        });
    }

    function render() {
        $('media-count-total').textContent = state.items.length;
        $('media-count-size').textContent = formatSize(state.items.reduce((sum, i) => sum + Number(i.size || 0), 0));
        $('media-count-unused').textContent = state.items.filter(i => !i.used_in.length).length;
        renderMissing();
        renderFolders();
        renderGrid();
        renderBulkBar();
    }

    function renderMissing() {
        const box = $('media-missing');
        if (!state.missing.length) { box.hidden = true; return; }
        box.hidden = false;
        // One line per article, saying which of its images are gone
        const articles = new Map();
        state.missing.forEach(m => m.used_in.forEach(u => {
            const entry = articles.get(u.id) || { title: u.title, places: new Set() };
            if (u.featured) entry.places.add('featured image');
            if (u.inline) entry.places.add('image in the text');
            articles.set(u.id, entry);
        }));
        const count = state.missing.length;
        box.innerHTML = `
            <strong>${count === 1 ? '1 image' : count + ' images'} used in articles ${count === 1 ? 'is' : 'are'} no longer on the server.</strong>
            Open each article and upload the image again:
            <ul class="cms-media-missing-list">
                ${[...articles.entries()].map(([id, a]) => `
                    <li><button type="button" class="cms-link-btn" data-edit-article="${id}">${esc(a.title)}</button>
                    <span>${[...a.places].join(', ')}</span></li>`).join('')}
            </ul>`;
    }

    function renderFolders() {
        const unfiled = state.items.filter(i => !i.folder_id).length;
        const entry = (key, name, count, editable) => `
            <li class="cms-media-folder${String(state.folder) === String(key) ? ' is-active' : ''}">
                <button type="button" class="cms-media-folder-btn" data-folder="${key}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                    <span class="cms-media-folder-name">${esc(name)}</span>
                    <span class="cms-media-folder-count">${count}</span>
                </button>
                ${editable ? `
                    <button type="button" class="cms-btn-icon cms-media-folder-tool" data-rename-folder="${key}" title="Rename folder" aria-label="Rename ${esc(name)}">
                        <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button type="button" class="cms-btn-icon cms-media-folder-tool" data-delete-folder="${key}" title="Delete folder" aria-label="Delete ${esc(name)}">
                        <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>` : ''}
            </li>`;
        $('media-folder-list').innerHTML =
            entry('all', 'All images', state.items.length, false) +
            entry('none', 'Not in a folder', unfiled, false) +
            state.folders.map(f => entry(f.id, f.name, f.count, true)).join('');
    }

    function usagePill(item) {
        if (!item.used_in.length) return '<span class="cms-media-pill is-unused">Not used</span>';
        const n = item.used_in.length;
        return `<span class="cms-media-pill is-used">Used in ${n} article${n === 1 ? '' : 's'}</span>`;
    }

    function renderGrid() {
        const items = visibleItems();
        if (!state.loaded) return;
        if (!items.length) {
            const empty = state.items.length
                ? 'No images match.'
                : 'No images yet. Click “Upload images” or drop some here.';
            grid().innerHTML = `<p class="cms-media-empty">${empty}</p>`;
            return;
        }
        grid().innerHTML = items.map(item => {
            const selected = state.selected.has(item.filename);
            return `
                <div class="cms-media-card${selected ? ' is-selected' : ''}" data-file="${esc(item.filename)}">
                    <label class="cms-media-check" title="Select">
                        <input type="checkbox" data-select="${esc(item.filename)}" ${selected ? 'checked' : ''} aria-label="Select ${esc(item.filename)}">
                    </label>
                    <button type="button" class="cms-media-thumb" data-open="${esc(item.filename)}" aria-label="Details for ${esc(item.filename)}">
                        <img src="${esc(item.url)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.cms-media-thumb').classList.add('is-broken')">
                    </button>
                    <div class="cms-media-meta">
                        <span class="cms-media-name" title="${esc(item.filename)}">${esc(item.filename)}</span>
                        <span class="cms-media-sub">${formatSize(item.size)} · ${formatDate(item.created_at)}</span>
                        ${usagePill(item)}
                    </div>
                </div>`;
        }).join('');
    }

    function folderOptions(current, placeholder) {
        return (placeholder ? `<option value="" disabled selected>${esc(placeholder)}</option>` : '') +
            `<option value="none"${!placeholder && !current ? ' selected' : ''}>Not in a folder</option>` +
            state.folders.map(f => `<option value="${f.id}"${!placeholder && current === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('');
    }

    function renderBulkBar() {
        const count = state.selected.size;
        $('media-bulk-bar').hidden = count === 0;
        $('media-bulk-count').textContent = `${count} selected`;
        $('media-bulk-move').innerHTML = folderOptions(null, 'Move to folder…');
    }

    // ----------------------------------------------------
    // Details dialog
    // ----------------------------------------------------
    function openDetail(filename) {
        const item = state.items.find(i => i.filename === filename);
        if (!item) return;
        state.detail = filename;
        $('media-detail-img').src = item.url;
        $('media-detail-name').textContent = item.filename;
        $('media-detail-info').textContent = `${formatSize(item.size)} · ${(item.mime_type || '').replace('image/', '').toUpperCase()} · uploaded ${formatDate(item.created_at)}`;
        $('media-detail-link').value = absoluteUrl(item.url);
        $('media-detail-folder').innerHTML = folderOptions(item.folder_id);
        $('media-detail-usage').innerHTML = item.used_in.length
            ? item.used_in.map(u => `
                <li>
                    <button type="button" class="cms-link-btn" data-edit-article="${u.id}">${esc(u.title)}</button>
                    <span class="cms-media-usage-where">${[u.featured && 'featured image', u.inline && 'in the text'].filter(Boolean).join(', ')}${u.status === 'draft' ? ' · draft' : ''}</span>
                </li>`).join('')
            : '<li class="cms-media-usage-none">Not used in any article.</li>';
        const dialog = $('media-detail');
        if (dialog.hidden) {
            dialog.hidden = false;
            document.body.classList.add('cms-dialog-open');
            setTimeout(() => $('media-detail-copy').focus(), 30);
        }
    }

    function closeDetail() {
        state.detail = null;
        $('media-detail').hidden = true;
        document.body.classList.remove('cms-dialog-open');
    }

    async function copyLink() {
        const input = $('media-detail-link');
        try {
            await navigator.clipboard.writeText(input.value);
        } catch (err) {
            input.select();
            document.execCommand('copy');
        }
        toast('Link copied');
    }

    // ----------------------------------------------------
    // Actions
    // ----------------------------------------------------
    async function upload(files) {
        const images = [...files].filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
        if (images.length < files.length) toast('Only JPG, PNG and WebP images can be uploaded; the others were skipped.', 'error');
        if (!images.length) return;
        const folderId = typeof state.folder === 'number' ? state.folder : null;
        let done = 0;
        let failed = 0;
        let unprotected = 0;
        grid().classList.add('is-busy');
        for (const file of images) {
            toast(`Uploading ${done + failed + 1} of ${images.length}…`);
            try {
                const result = await AdminAPI.uploadImage(file, folderId);
                if (result.stored === false) unprotected++;
                done++;
            } catch (err) {
                failed++;
                toast(`${file.name}: ${err.message}`, 'error');
            }
        }
        grid().classList.remove('is-busy');
        await load();
        if (unprotected) toast(`${unprotected} image(s) uploaded without a database backup, so the next deploy could remove them.`, 'error');
        else if (failed) toast(`${done} uploaded, ${failed} failed.`, 'error');
        else toast(done === 1 ? 'Image uploaded' : `${done} images uploaded`);
    }

    async function move(filenames, folderValue) {
        const folderId = folderValue === 'none' ? null : Number(folderValue);
        try {
            await AdminAPI.moveMedia(filenames, folderId);
            filenames.forEach(f => state.selected.delete(f));
            toast(`${filenames.length === 1 ? 'Image' : filenames.length + ' images'} moved to ${folderLabel(folderId)}`);
            await load();
        } catch (err) {
            toast('Could not move: ' + err.message, 'error');
        }
    }

    function usageWarning(items) {
        const titles = [...new Set(items.flatMap(i => i.used_in.map(u => `• ${u.title}`)))];
        return titles.length ? `\n\nStill used in:\n${titles.join('\n')}\n\nThose articles will show no image.` : '';
    }

    async function remove(filenames) {
        const items = state.items.filter(i => filenames.includes(i.filename));
        if (!items.length) return;
        const what = items.length === 1 ? 'this image' : `these ${items.length} images`;
        if (!confirm(`Delete ${what}? This can't be undone.${usageWarning(items)}`)) return;
        let failed = 0;
        for (const item of items) {
            try {
                await AdminAPI.deleteMedia(item.filename, item.used_in.length > 0);
                state.selected.delete(item.filename);
            } catch (err) {
                failed++;
                toast(`${item.filename}: ${err.message}`, 'error');
            }
        }
        if (state.detail && filenames.includes(state.detail)) closeDetail();
        await load();
        if (!failed) toast(items.length === 1 ? 'Image deleted' : `${items.length} images deleted`);
    }

    async function newFolder() {
        const values = await CmsDialog.open({
            title: 'New folder',
            submitLabel: 'Create folder',
            fields: [{ name: 'name', label: 'Folder name', placeholder: 'e.g. Blog covers', required: true }]
        });
        if (!values || !values.name.trim()) return;
        try {
            const folder = await AdminAPI.createMediaFolder(values.name);
            state.folder = folder.id;
            await load();
            toast(`Folder "${folder.name}" created`);
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function renameFolder(id) {
        const folder = state.folders.find(f => f.id === id);
        if (!folder) return;
        const values = await CmsDialog.open({
            title: 'Rename folder',
            submitLabel: 'Rename',
            fields: [{ name: 'name', label: 'Folder name', value: folder.name, required: true }]
        });
        if (!values || !values.name.trim() || values.name.trim() === folder.name) return;
        try {
            await AdminAPI.renameMediaFolder(id, values.name);
            await load();
            toast('Folder renamed');
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function deleteFolder(id) {
        const folder = state.folders.find(f => f.id === id);
        if (!folder) return;
        const note = folder.count ? ` Its ${folder.count} image${folder.count === 1 ? '' : 's'} stay in the library, just not in a folder.` : '';
        if (!confirm(`Delete the folder "${folder.name}"?${note}`)) return;
        try {
            await AdminAPI.deleteMediaFolder(id);
            if (state.folder === id) state.folder = 'all';
            await load();
            toast('Folder deleted');
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    function editArticle(id) {
        closeDetail();
        if (typeof window.editBlog === 'function') window.editBlog(Number(id));
    }

    // ----------------------------------------------------
    // Wiring
    // ----------------------------------------------------
    function mount(options) {
        toast = options.showToast || toast;
        esc = options.escapeHtml || esc;

        const fileInput = $('media-file-input');
        $('media-upload-btn').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) upload(fileInput.files);
            fileInput.value = '';
        });

        $('media-new-folder-btn').addEventListener('click', newFolder);

        $('media-folder-list').addEventListener('click', e => {
            const rename = e.target.closest('[data-rename-folder]');
            const del = e.target.closest('[data-delete-folder]');
            const open = e.target.closest('[data-folder]');
            if (rename) return renameFolder(Number(rename.dataset.renameFolder));
            if (del) return deleteFolder(Number(del.dataset.deleteFolder));
            if (open) {
                const key = open.dataset.folder;
                state.folder = key === 'all' || key === 'none' ? key : Number(key);
                render();
            }
        });

        $('media-search-input').addEventListener('input', e => {
            state.search = e.target.value;
            renderGrid();
        });

        $('media-filter-tabs').addEventListener('click', e => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            state.filter = btn.dataset.filter;
            document.querySelectorAll('#media-filter-tabs .cms-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderGrid();
        });

        const mediaGrid = grid();
        mediaGrid.addEventListener('change', e => {
            const box = e.target.closest('[data-select]');
            if (!box) return;
            if (box.checked) state.selected.add(box.dataset.select);
            else state.selected.delete(box.dataset.select);
            box.closest('.cms-media-card').classList.toggle('is-selected', box.checked);
            renderBulkBar();
        });
        mediaGrid.addEventListener('click', e => {
            const open = e.target.closest('[data-open]');
            if (open) openDetail(open.dataset.open);
        });

        // Drop files anywhere on the library
        const main = mediaGrid.closest('.cms-media-main');
        main.addEventListener('dragover', e => {
            if (![...e.dataTransfer.types].includes('Files')) return;
            e.preventDefault();
            main.classList.add('is-dragover');
        });
        main.addEventListener('dragleave', e => {
            if (!main.contains(e.relatedTarget)) main.classList.remove('is-dragover');
        });
        main.addEventListener('drop', e => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            main.classList.remove('is-dragover');
            upload(e.dataTransfer.files);
        });

        $('media-bulk-move').addEventListener('change', e => {
            if (e.target.value) move([...state.selected], e.target.value);
        });
        $('media-bulk-delete').addEventListener('click', () => remove([...state.selected]));
        $('media-bulk-clear').addEventListener('click', () => {
            state.selected.clear();
            renderGrid();
            renderBulkBar();
        });

        // Links to articles (missing-image notice and the details dialog)
        document.addEventListener('click', e => {
            const link = e.target.closest('[data-edit-article]');
            if (link && link.closest('#media-view, #media-detail')) editArticle(link.dataset.editArticle);
        });

        // Details dialog
        const dialog = $('media-detail');
        dialog.addEventListener('click', e => {
            if (e.target.closest('[data-media-close]')) closeDetail();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !dialog.hidden) closeDetail();
        });
        $('media-detail-copy').addEventListener('click', copyLink);
        $('media-detail-folder').addEventListener('change', e => {
            if (state.detail) move([state.detail], e.target.value);
        });
        $('media-detail-delete').addEventListener('click', () => {
            if (state.detail) remove([state.detail]);
        });
    }

    window.CmsMedia = { mount, show: load };
})();
