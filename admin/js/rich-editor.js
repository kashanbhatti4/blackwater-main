// ========================================================
// Blackwater Digital Blog CMS - Rich text editor
// contenteditable + execCommand, with:
//  - clean paste (Google Docs, Word, web pages, code editors):
//    no backgrounds, fonts or colours, only article structure
//  - markdown-style shortcuts (## heading, - list, > quote, ``` code, --- divider)
//  - code blocks, embed code, inline images (upload / paste / drop)
//  - HTML source view and a distraction-free focus mode
// ========================================================

(function () {
    // Tags kept from pasted HTML, with the attributes each may keep
    const ALLOWED = {
        P: [], H2: [], H3: [], H4: [], STRONG: [], EM: [], U: [], S: [], CODE: [], SUB: [], SUP: [],
        A: ['href', 'target'], UL: [], OL: [], LI: [], BLOCKQUOTE: [], BR: [], HR: [],
        FIGURE: [], FIGCAPTION: [], IMG: ['src', 'alt'],
        TABLE: [], THEAD: [], TBODY: [], TR: [], TH: ['colspan', 'rowspan'], TD: ['colspan', 'rowspan']
    };
    const RENAME = { H1: 'H2', H5: 'H4', H6: 'H4', B: 'STRONG', I: 'EM', DEL: 'S', STRIKE: 'S', TT: 'CODE', KBD: 'CODE' };
    const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
        'SVG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'HEAD', 'CANVAS', 'VIDEO', 'AUDIO']);
    const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE',
        'FIGURE', 'TABLE', 'HR', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'MAIN', 'NAV']);
    const CONTAINERS = new Set(['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'MAIN', 'NAV', 'BODY']);
    const INLINE_OUT = new Set(['STRONG', 'EM', 'U', 'S', 'CODE', 'SUB', 'SUP', 'A', 'BR', 'IMG']);
    const CODE_FONT = /font-family:[^;"]*(menlo|consolas|monaco|courier|sf mono|jetbrains|fira code|monospace)/i;

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasBlockChild(node) {
        return Array.from(node.children).some(child => BLOCK_TAGS.has(child.tagName));
    }

    function safeHref(href) {
        const value = (href || '').trim();
        return /^(https?:|mailto:|tel:|\/|#)/i.test(value) ? value : null;
    }

    // ---------------------------------------------------------
    // Clean pasted HTML down to article structure
    // ---------------------------------------------------------
    function cleanInto(source, out) {
        Array.from(source.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.nodeValue.replace(/[​﻿]/g, '');
                if (text) out.appendChild(document.createTextNode(text));
                return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) return;

            let tag = child.tagName.toUpperCase();
            if (DROP.has(tag)) return;
            if (tag.includes(':')) { cleanInto(child, out); return; } // Word's <o:p> and friends

            const style = (child.getAttribute('style') || '').toLowerCase();

            // Google Docs wraps the whole clipboard in <b style="font-weight:normal">
            if ((tag === 'B' || tag === 'STRONG') && /font-weight:\s*(normal|[1-4]00)\b/.test(style)) {
                cleanInto(child, out);
                return;
            }

            // Inline styling becomes real tags; everything else about the span is dropped
            if (tag === 'SPAN' || tag === 'FONT' || tag === 'MARK') {
                let target = out;
                const wrap = name => { const node = document.createElement(name); target.appendChild(node); target = node; };
                if (/font-weight:\s*(bold|[6-9]00)\b/.test(style)) wrap('strong');
                if (/font-style:\s*italic/.test(style)) wrap('em');
                if (/text-decoration[^;]*underline/.test(style)) wrap('u');
                if (/text-decoration[^;]*line-through/.test(style)) wrap('s');
                cleanInto(child, target);
                return;
            }

            if (tag === 'PRE') {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = child.textContent.replace(/\n+$/, '');
                pre.appendChild(code);
                out.appendChild(pre);
                return;
            }

            if (CONTAINERS.has(tag)) {
                if (hasBlockChild(child)) {
                    cleanInto(child, out);
                } else if (child.textContent.trim() || child.querySelector('img')) {
                    const p = document.createElement('p');
                    cleanInto(child, p);
                    out.appendChild(p);
                }
                return;
            }

            tag = RENAME[tag] || tag;
            if (!ALLOWED[tag]) { cleanInto(child, out); return; } // unknown tag: keep its contents

            if (tag === 'A') {
                const href = safeHref(child.getAttribute('href'));
                if (!href) { cleanInto(child, out); return; }
                const a = document.createElement('a');
                a.setAttribute('href', href);
                if (child.getAttribute('target') === '_blank') {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                }
                cleanInto(child, a);
                out.appendChild(a);
                return;
            }

            if (tag === 'IMG') {
                const src = (child.getAttribute('src') || '').trim();
                if (!/^(https?:)?\/\//i.test(src) && !src.startsWith('/')) return; // skip data: and local file images
                const img = document.createElement('img');
                img.setAttribute('src', src);
                img.setAttribute('alt', child.getAttribute('alt') || '');
                out.appendChild(img);
                return;
            }

            const node = document.createElement(tag);
            ALLOWED[tag].forEach(attr => {
                const value = child.getAttribute(attr);
                if (value !== null) node.setAttribute(attr, value);
            });
            cleanInto(child, node);
            out.appendChild(node);
        });
    }

    function unwrap(node) {
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
    }

    function tidy(root) {
        // Paragraphs inside list items (Google Docs) become plain list text
        root.querySelectorAll('li > p').forEach(p => {
            if (p.nextSibling && p.nextSibling.nodeType === Node.ELEMENT_NODE && p.nextSibling.tagName === 'P') {
                p.appendChild(document.createElement('br'));
            }
            unwrap(p);
        });
        // Links are already underlined on the site
        root.querySelectorAll('a u').forEach(unwrap);
        // Empty formatting and empty blocks
        root.querySelectorAll('strong, em, u, s, code, a, sub, sup').forEach(el => {
            if (!el.textContent && !el.querySelector('img')) el.remove();
        });
        root.querySelectorAll('p, h2, h3, h4, li, blockquote, figcaption').forEach(el => {
            if (!el.textContent.trim() && !el.querySelector('img')) el.remove();
        });
        // Loose inline content at the top level goes into paragraphs
        let paragraph = null;
        Array.from(root.childNodes).forEach(node => {
            const inline = node.nodeType === Node.TEXT_NODE || INLINE_OUT.has(node.nodeName);
            if (!inline) { paragraph = null; return; }
            if (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim() && !paragraph) { node.remove(); return; }
            if (!paragraph) {
                paragraph = document.createElement('p');
                root.insertBefore(paragraph, node);
            }
            paragraph.appendChild(node);
        });
        root.querySelectorAll('p').forEach(p => {
            while (p.lastChild && p.lastChild.nodeName === 'BR') p.lastChild.remove();
            if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
        });
    }

    function sanitizeHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const out = document.createElement('div');
        cleanInto(doc.body, out);
        tidy(out);
        return out.innerHTML;
    }

    function textToHtml(text) {
        return text
            .replace(/\r\n?/g, '\n')
            .split(/\n\s*\n/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    // Embed code: keep the markup (iframes etc.) but never scripts or inline event handlers
    function sanitizeEmbed(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, style').forEach(el => el.remove());
        doc.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
            });
        });
        return doc.body.innerHTML.trim();
    }

    // Lightly indented HTML for the source view
    function prettyHtml(html) {
        return html
            .replace(/>\s+</g, '><')
            .replace(/(<\/(p|h2|h3|h4|ul|ol|blockquote|pre|figure|table|div)>)/g, '$1\n\n')
            .replace(/<(ul|ol)>/g, '<$1>\n')
            .replace(/<\/li>/g, '</li>\n')
            .replace(/<hr\s*\/?>/g, '<hr>\n\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // ---------------------------------------------------------
    // Editor
    // ---------------------------------------------------------
    class RichEditor {
        /**
         * @param {object} opts
         *   root (wrapper), area (contenteditable), source (textarea), toolbar, hint (status text element),
         *   uploadImage(file) -> Promise<{url}>, onChange(), notify(message, type)
         */
        constructor(opts) {
            Object.assign(this, opts);
            this.savedRange = null;
            this.sourceMode = false;
            this.defaultHint = this.hint ? this.hint.textContent : '';
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.accept = 'image/jpeg,image/png,image/webp';
            this.fileInput.hidden = true;
            this.root.appendChild(this.fileInput);
            this.bind();
        }

        bind() {
            const area = this.area;

            area.addEventListener('focus', () => {
                try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* older browsers */ }
            });
            area.addEventListener('input', e => this.onInput(e));
            area.addEventListener('keydown', e => this.onKeyDown(e));
            area.addEventListener('paste', e => this.onPaste(e));
            area.addEventListener('drop', e => this.onDrop(e));
            area.addEventListener('blur', () => this.saveSelection());
            area.addEventListener('click', e => {
                // Links shouldn't navigate while editing; Cmd/Ctrl-click opens them
                const link = e.target.closest('a');
                if (link && (e.metaKey || e.ctrlKey)) window.open(link.href, '_blank', 'noopener');
            });

            document.addEventListener('selectionchange', () => {
                if (this.getRange()) {
                    this.saveSelection();
                    this.updateToolbar();
                }
            });

            // Toolbar buttons keep the editor selection (mousedown would otherwise steal focus)
            this.toolbar.addEventListener('mousedown', e => {
                if (e.target.closest('button')) e.preventDefault();
            });
            this.toolbar.addEventListener('click', e => {
                const btn = e.target.closest('button[data-action]');
                if (!btn || btn.disabled) return;
                this.run(btn.dataset.action);
            });

            const blockSelect = this.toolbar.querySelector('[data-action-select="block"]');
            if (blockSelect) {
                blockSelect.addEventListener('mousedown', () => this.saveSelection());
                blockSelect.addEventListener('change', () => {
                    this.restoreSelection();
                    this.setBlock(blockSelect.value);
                });
            }

            this.fileInput.addEventListener('change', () => {
                const file = this.fileInput.files && this.fileInput.files[0];
                this.fileInput.value = '';
                if (file) this.insertImageFile(file);
            });

            this.source.addEventListener('input', () => this.changed());

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && this.root.classList.contains('is-focus') && !document.body.classList.contains('cms-dialog-open')) {
                    this.toggleFocus(false);
                }
            });
        }

        // ---------------- content ----------------
        setHTML(html) {
            this.exitSource();
            this.area.innerHTML = html && html.trim() ? html : '<p><br></p>';
            this.prepare();
            this.updateEmpty();
        }

        getHTML() {
            if (this.sourceMode) this.area.innerHTML = this.source.value;
            const clone = this.area.cloneNode(true);
            clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
            clone.querySelectorAll('*').forEach(el => {
                if (el.closest('.article_embed')) return;
                el.removeAttribute('style');
                if (!(el.tagName === 'CODE' && /^language-[a-z]+$/.test(el.className))) el.removeAttribute('class');
                el.removeAttribute('id');
                el.removeAttribute('dir');
            });
            clone.querySelectorAll('span, font').forEach(el => { if (!el.closest('.article_embed')) unwrap(el); });
            // Line breaks typed inside code blocks are stored as real newlines
            clone.querySelectorAll('pre br').forEach(br => br.replaceWith('\n'));
            clone.querySelectorAll('b').forEach(el => { const s = document.createElement('strong'); s.innerHTML = el.innerHTML; el.replaceWith(s); });
            clone.querySelectorAll('i').forEach(el => { const s = document.createElement('em'); s.innerHTML = el.innerHTML; el.replaceWith(s); });
            Array.from(clone.children).forEach(el => {
                if (el.tagName === 'DIV' && !el.classList.contains('article_embed') && !hasBlockChild(el)) {
                    const p = document.createElement('p');
                    p.innerHTML = el.innerHTML;
                    el.replaceWith(p);
                }
            });
            clone.querySelectorAll('p, h2, h3, h4').forEach(el => {
                if (!el.textContent.trim() && !el.querySelector('img, iframe')) el.remove();
            });
            clone.querySelectorAll('a[target="_blank"]').forEach(a => a.setAttribute('rel', 'noopener noreferrer'));
            // Zero-width spaces the editor adds after inline code and links
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.nodeValue.includes('\u200b')) node.nodeValue = node.nodeValue.replace(/\u200b/g, '');
            }
            return clone.innerHTML.trim();
        }

        // Runs fn, then puts the caret back on the same text position (moving a node out of its
        // parent would otherwise collapse the selection to where the parent was)
        preserveCaret(fn) {
            const sel = window.getSelection();
            const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
            const saved = range && this.area.contains(range.startContainer)
                ? [range.startContainer, range.startOffset, range.endContainer, range.endOffset] : null;
            fn();
            if (!saved || !this.area.contains(saved[0]) || !this.area.contains(saved[2])) return;
            try {
                const restored = document.createRange();
                restored.setStart(saved[0], saved[1]);
                restored.setEnd(saved[2], saved[3]);
                sel.removeAllRanges();
                sel.addRange(restored);
            } catch (e) { /* offsets no longer valid */ }
        }

        // Chrome turns a paragraph into <p><ul>…</ul></p> for lists (and similar for other blocks);
        // lift those blocks out so the article stays flat: p, h2, ul… at the top level
        fixNesting() {
            const BLOCK = /^(UL|OL|P|H2|H3|H4|PRE|BLOCKQUOTE|FIGURE|DIV|HR|TABLE)$/;
            const broken = Array.from(this.area.children).filter(el =>
                /^(P|H2|H3|H4)$/.test(el.tagName) && Array.from(el.children).some(child => BLOCK.test(child.tagName)));
            if (!broken.length) return;
            this.preserveCaret(() => {
                broken.forEach(wrapper => {
                    const frag = document.createDocumentFragment();
                    let run = null;
                    Array.from(wrapper.childNodes).forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && BLOCK.test(node.tagName)) {
                            run = null;
                            frag.appendChild(node);
                            return;
                        }
                        if (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim() && !run) return;
                        if (node.nodeName === 'BR' && !run) return;
                        if (!run) {
                            run = document.createElement(wrapper.tagName.toLowerCase());
                            frag.appendChild(run);
                        }
                        run.appendChild(node);
                    });
                    wrapper.replaceWith(frag);
                });
            });
        }

        // Re-applies editor-only markers after content is loaded or replaced
        prepare() {
            this.fixNesting();
            this.area.querySelectorAll('.article_embed').forEach(el => el.setAttribute('contenteditable', 'false'));
            const last = this.area.lastElementChild;
            if (!last || /^(PRE|FIGURE|HR|TABLE|DIV)$/.test(last.tagName)) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                this.area.appendChild(p);
            }
        }

        updateEmpty() {
            const empty = !this.area.textContent.trim() && !this.area.querySelector('img, iframe, hr, pre, li, .article_embed');
            this.area.classList.toggle('is-empty', empty);
        }

        changed() {
            this.updateEmpty();
            if (this.onChange) this.onChange();
        }

        // ---------------- selection ----------------
        getRange() {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return null;
            const range = sel.getRangeAt(0);
            return this.area.contains(range.commonAncestorContainer) ? range : null;
        }

        saveSelection() {
            const range = this.getRange();
            if (range) this.savedRange = range.cloneRange();
        }

        restoreSelection() {
            this.area.focus({ preventScroll: true });
            if (!this.savedRange) return;
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
        }

        closest(selector) {
            const range = this.getRange() || this.savedRange;
            if (!range) return null;
            let node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
            const el = node && node.closest ? node.closest(selector) : null;
            return el && this.area.contains(el) && el !== this.area ? el : null;
        }

        placeCaret(node, atEnd) {
            const range = document.createRange();
            range.selectNodeContents(node);
            range.collapse(!atEnd);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        topBlock() {
            const range = this.getRange();
            if (!range) return null;
            let node = range.startContainer;
            while (node && node.parentNode !== this.area) node = node.parentNode;
            return node && node.nodeType === Node.ELEMENT_NODE ? node : null;
        }

        // ---------------- commands ----------------
        exec(command, value = null) {
            this.restoreSelection();
            document.execCommand(command, false, value);
            this.saveSelection();
            this.prepare();
            this.changed();
            this.updateToolbar();
        }

        setBlock(tag) {
            const current = this.closest('h2, h3, h4, blockquote, pre');
            if (current && current.tagName.toLowerCase() === tag && tag !== 'p') tag = 'p';
            if (this.closest('pre') && tag !== 'pre') {
                this.leaveCodeBlock(tag);
                return;
            }
            this.exec('formatBlock', `<${tag}>`);
        }

        run(action) {
            if (this.sourceMode && action !== 'source' && action !== 'focus') return;
            switch (action) {
                case 'bold': return this.exec('bold');
                case 'italic': return this.exec('italic');
                case 'underline': return this.exec('underline');
                case 'strike': return this.exec('strikeThrough');
                case 'ul': return this.exec('insertUnorderedList');
                case 'ol': return this.exec('insertOrderedList');
                case 'quote': return this.setBlock('blockquote');
                case 'h2': return this.setBlock('h2');
                case 'h3': return this.setBlock('h3');
                case 'code': return this.toggleInlineCode();
                case 'link': return this.editLink();
                case 'image': this.saveSelection(); return this.fileInput.click();
                case 'codeblock': return this.insertCodeBlock();
                case 'embed': return this.insertEmbed();
                case 'hr': this.exec('insertHorizontalRule'); return;
                case 'undo': return this.exec('undo');
                case 'redo': return this.exec('redo');
                case 'clear':
                    this.exec('removeFormat');
                    this.exec('unlink');
                    if (this.closest('h2, h3, h4, blockquote')) this.exec('formatBlock', '<p>');
                    return;
                case 'source': return this.toggleSource();
                case 'focus': return this.toggleFocus();
                default: return undefined;
            }
        }

        toggleInlineCode() {
            const code = this.closest('code');
            if (code && !code.closest('pre')) {
                this.restoreSelection();
                unwrap(code);
                this.changed();
                return;
            }
            const range = this.getRange() || this.savedRange;
            const text = range ? range.toString() : '';
            this.exec('insertHTML', `<code>${escapeHtml(text || 'code')}</code>&#8203;`);
        }

        async editLink() {
            this.saveSelection();
            const range = this.savedRange;
            const anchor = this.closest('a');
            const selected = range ? range.toString() : '';
            const values = await CmsDialog.open({
                title: anchor ? 'Edit link' : 'Add link',
                submitLabel: anchor ? 'Update link' : 'Add link',
                extraLabel: anchor ? 'Remove link' : null,
                fields: [
                    { name: 'url', label: 'Link to', type: 'text', required: true, value: anchor ? anchor.getAttribute('href') : '',
                      placeholder: 'https://… or /services/web-design', hint: 'Use a path like /contact for pages on this site.' },
                    ...(anchor || selected ? [] : [{ name: 'text', label: 'Link text', placeholder: 'Text to show' }]),
                    { name: 'newTab', label: 'Open in a new tab', type: 'checkbox', value: anchor ? anchor.target === '_blank' : false }
                ]
            });
            if (!values) { this.restoreSelection(); return; }

            this.restoreSelection();
            if (values._extra && anchor) {
                const r = document.createRange();
                r.selectNodeContents(anchor);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(r);
                document.execCommand('unlink');
                this.changed();
                return;
            }

            const href = safeHref(values.url) || (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(values.url.trim()) ? 'https://' + values.url.trim() : null);
            if (!href) { this.notify && this.notify('That link doesn’t look right. Start it with https:// or /', 'error'); return; }

            const applyTarget = a => {
                if (values.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
                else { a.removeAttribute('target'); a.removeAttribute('rel'); }
            };

            if (anchor) {
                anchor.setAttribute('href', href);
                applyTarget(anchor);
            } else if (!selected) {
                const text = escapeHtml(values.text || href);
                const target = values.newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
                document.execCommand('insertHTML', false, `<a href="${escapeHtml(href)}"${target}>${text}</a>&#8203;`);
            } else {
                const before = new Set(this.area.querySelectorAll('a'));
                document.execCommand('createLink', false, href);
                this.area.querySelectorAll('a').forEach(a => { if (!before.has(a)) applyTarget(a); });
            }
            this.changed();
        }

        async insertCodeBlock() {
            if (this.closest('pre')) { this.leaveCodeBlock('p'); return; }
            this.saveSelection();
            const selected = this.savedRange ? this.savedRange.toString() : '';
            const values = await CmsDialog.open({
                title: 'Insert code',
                description: 'Paste code exactly as it is. It shows on the article as a formatted code block.',
                submitLabel: 'Insert code',
                fields: [
                    { name: 'code', label: 'Code', type: 'textarea', rows: 12, mono: true, value: selected, required: true },
                    { name: 'language', label: 'Language', type: 'select', value: '', options: [
                        { value: '', label: 'Plain text' }, { value: 'html', label: 'HTML' }, { value: 'css', label: 'CSS' },
                        { value: 'javascript', label: 'JavaScript' }, { value: 'php', label: 'PHP' }, { value: 'json', label: 'JSON' },
                        { value: 'bash', label: 'Terminal' }
                    ] }
                ]
            });
            this.restoreSelection();
            if (!values || !values.code.trim()) return;
            const cls = values.language ? ` class="language-${values.language}"` : '';
            document.execCommand('insertHTML', false, `<pre><code${cls}>${escapeHtml(values.code.replace(/\s+$/, ''))}</code></pre><p><br></p>`);
            this.prepare();
            this.changed();
        }

        leaveCodeBlock(tag) {
            const pre = this.closest('pre');
            if (!pre) return;
            const block = document.createElement(tag === 'pre' ? 'p' : tag);
            block.textContent = pre.textContent;
            if (!block.textContent) block.innerHTML = '<br>';
            pre.replaceWith(block);
            this.placeCaret(block, true);
            this.saveSelection();
            this.changed();
        }

        exitCodeBlockBelow() {
            const pre = this.closest('pre');
            if (!pre) return;
            let next = pre.nextElementSibling;
            if (!next || next.tagName !== 'P' || next.textContent.trim()) {
                next = document.createElement('p');
                next.innerHTML = '<br>';
                pre.after(next);
            }
            this.placeCaret(next, false);
            this.saveSelection();
            this.changed();
        }

        async insertEmbed() {
            this.saveSelection();
            const values = await CmsDialog.open({
                title: 'Embed code',
                description: 'Paste the embed code from YouTube, Vimeo, Google Maps, Spotify, Loom and similar (iframe embeds). Embeds that rely on scripts, such as some social posts, won’t display.',
                submitLabel: 'Insert embed',
                fields: [{ name: 'code', label: 'Embed code', type: 'textarea', rows: 7, mono: true, required: true,
                    placeholder: '<iframe src="https://www.youtube.com/embed/…"></iframe>' }]
            });
            this.restoreSelection();
            if (!values) return;
            const clean = sanitizeEmbed(values.code);
            if (!clean) { this.notify && this.notify('Nothing to embed in that code.', 'error'); return; }
            document.execCommand('insertHTML', false, `<div class="article_embed" contenteditable="false">${clean}</div><p><br></p>`);
            this.prepare();
            this.changed();
        }

        async insertImageFile(file) {
            if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
                this.notify && this.notify('Images must be JPG, PNG or WebP.', 'error');
                return;
            }
            this.notify && this.notify('Uploading image…');
            let upload;
            try {
                upload = await this.uploadImage(file);
            } catch (err) {
                this.notify && this.notify('Image upload failed: ' + err.message, 'error');
                return;
            }
            const guess = file.name.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').replace(/^(image|screenshot|img)\s*\d*/i, '').trim();
            const values = await CmsDialog.open({
                title: 'Describe the image',
                description: 'Alt text is read out by screen readers and used by Google to understand the image.',
                submitLabel: 'Insert image',
                fields: [
                    { name: 'alt', label: 'Alt text', value: guess, placeholder: 'e.g. Google Ads dashboard showing wasted spend', required: true },
                    { name: 'caption', label: 'Caption (optional)', placeholder: 'Shown under the image' }
                ]
            });
            this.restoreSelection();
            if (!values) return;
            const caption = values.caption.trim() ? `<figcaption>${escapeHtml(values.caption.trim())}</figcaption>` : '';
            document.execCommand('insertHTML', false,
                `<figure><img src="${escapeHtml(upload.url)}" alt="${escapeHtml(values.alt.trim())}">${caption}</figure><p><br></p>`);
            this.prepare();
            this.changed();
        }

        // ---------------- events ----------------
        onInput(e) {
            this.prepare();
            if (e.inputType === 'insertText' && /[ `]$/.test(e.data || '')) this.markdownShortcut();
            this.changed();
        }

        markdownShortcut() {
            const block = this.topBlock();
            if (!block || !/^(P|DIV)$/.test(block.tagName)) return;
            const text = block.textContent.replace(/ /g, ' ');
            const rules = [
                [/^## $/, () => this.exec('formatBlock', '<h2>')],
                [/^### $/, () => this.exec('formatBlock', '<h3>')],
                [/^#### $/, () => this.exec('formatBlock', '<h4>')],
                [/^> $/, () => this.exec('formatBlock', '<blockquote>')],
                [/^[-*] $/, () => this.exec('insertUnorderedList')],
                [/^1[.)] $/, () => this.exec('insertOrderedList')],
                [/^```$/, () => {
                    const pre = document.createElement('pre');
                    const code = document.createElement('code');
                    code.innerHTML = '<br>';
                    pre.appendChild(code);
                    block.replaceWith(pre);
                    this.prepare();
                    this.placeCaret(code, false);
                    this.saveSelection();
                    this.updateToolbar();
                }]
            ];
            for (const [pattern, apply] of rules) {
                if (pattern.test(text)) {
                    block.innerHTML = '<br>';
                    this.placeCaret(block, false);
                    this.saveSelection();
                    apply();
                    return;
                }
            }
        }

        onKeyDown(e) {
            const mod = e.metaKey || e.ctrlKey;
            const inPre = !!this.closest('pre');

            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.editLink();
                return;
            }
            if (inPre && e.key === 'Enter' && mod) {
                e.preventDefault();
                this.exitCodeBlockBelow();
                return;
            }
            if (inPre && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                return;
            }
            if (inPre && e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '  ');
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                const block = this.topBlock();
                if (block && block.tagName === 'P' && block.textContent.trim() === '---') {
                    e.preventDefault();
                    block.innerHTML = '<br>';
                    this.placeCaret(block, false);
                    this.exec('insertHorizontalRule');
                }
            }
        }

        onPaste(e) {
            const data = e.clipboardData;
            if (!data) return;
            const html = data.getData('text/html');
            const text = data.getData('text/plain');
            const images = Array.from(data.files || []).filter(f => /^image\//.test(f.type));

            e.preventDefault();

            // A screenshot or a copied image file (Finder also puts the file name on the clipboard as text)
            if (images.length && !html) {
                this.saveSelection();
                this.insertImageFile(images[0]);
                return;
            }

            // Inside a code block everything goes in as plain text
            if (this.closest('pre')) {
                document.execCommand('insertText', false, text);
                this.changed();
                return;
            }

            // Copied from a code editor (VS Code, GitHub…): keep it as a code block
            // (Google Docs also uses white-space:pre-wrap, so only a monospace font or a bare <pre> counts)
            const looksLikeCode = html && text.includes('\n') && !/<(p|li|h[1-6])[\s>]/i.test(html)
                && (CODE_FONT.test(html) || /<pre[\s>]/i.test(html));
            if (looksLikeCode) {
                document.execCommand('insertHTML', false, `<pre><code>${escapeHtml(text.replace(/\s+$/, ''))}</code></pre><p><br></p>`);
                this.prepare();
                this.changed();
                return;
            }

            if (html) {
                const clean = sanitizeHtml(html);
                if (clean.trim()) {
                    document.execCommand('insertHTML', false, clean);
                    this.prepare();
                    this.changed();
                    this.flashHint('Pasted and cleaned: original colours, backgrounds and fonts removed.');
                    return;
                }
            }

            if (!text) return;
            if (!/\n/.test(text)) {
                document.execCommand('insertText', false, text);
            } else {
                document.execCommand('insertHTML', false, textToHtml(text));
            }
            this.prepare();
            this.changed();
            if (/<\/?(iframe|div|script|p|span|a)\b[^>]*>/i.test(text)) {
                this.flashHint('That looks like code. To add working embed code use “Embed”; to show code use “Code block”.');
            }
        }

        onDrop(e) {
            const dt = e.dataTransfer;
            if (!dt) return;
            const files = Array.from(dt.files || []).filter(f => /^image\//.test(f.type));
            const html = dt.getData('text/html');
            if (!files.length && !html) return;
            e.preventDefault();
            const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
            if (range) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                this.saveSelection();
            }
            if (files.length) {
                this.insertImageFile(files[0]);
            } else {
                document.execCommand('insertHTML', false, sanitizeHtml(html));
                this.prepare();
                this.changed();
            }
        }

        flashHint(message) {
            if (!this.hint) return;
            this.hint.textContent = message;
            this.hint.classList.add('is-flash');
            clearTimeout(this.hintTimer);
            this.hintTimer = setTimeout(() => {
                this.hint.classList.remove('is-flash');
                this.updateHint();
            }, 4500);
        }

        updateHint() {
            if (!this.hint || this.hint.classList.contains('is-flash')) return;
            this.hint.textContent = this.closest('pre')
                ? 'In a code block: Enter adds a line · ⌘/Ctrl + Enter leaves the block'
                : this.defaultHint;
        }

        // ---------------- toolbar state ----------------
        updateToolbar() {
            const state = cmd => { try { return document.queryCommandState(cmd); } catch (e) { return false; } };
            const set = (action, on) => {
                const btn = this.toolbar.querySelector(`[data-action="${action}"]`);
                if (btn) btn.classList.toggle('is-active', !!on);
            };
            const inPre = !!this.closest('pre');
            set('bold', !inPre && state('bold'));
            set('italic', !inPre && state('italic'));
            set('underline', !inPre && state('underline'));
            set('strike', !inPre && state('strikeThrough'));
            set('ul', state('insertUnorderedList'));
            set('ol', state('insertOrderedList'));
            set('quote', !!this.closest('blockquote'));
            set('link', !!this.closest('a'));
            set('code', !inPre && !!this.closest('code'));
            set('codeblock', inPre);

            const blockSelect = this.toolbar.querySelector('[data-action-select="block"]');
            if (blockSelect) {
                const block = this.closest('h2, h3, h4');
                blockSelect.value = block ? block.tagName.toLowerCase() : 'p';
            }
            this.updateHint();
        }

        // ---------------- modes ----------------
        toggleSource(force) {
            const on = force !== undefined ? force : !this.sourceMode;
            if (on === this.sourceMode) return;
            if (on) {
                this.source.value = prettyHtml(this.getHTML());
                this.area.hidden = true;
                this.source.hidden = false;
                this.sourceMode = true;
                this.source.focus();
            } else {
                this.area.innerHTML = this.source.value.trim() || '<p><br></p>';
                this.sourceMode = false;
                this.prepare();
                this.source.hidden = true;
                this.area.hidden = false;
                this.area.focus();
            }
            this.root.classList.toggle('is-source', this.sourceMode);
            this.toolbar.querySelectorAll('button[data-action], select').forEach(el => {
                if (!['source', 'focus'].includes(el.dataset.action)) el.disabled = this.sourceMode;
            });
            const btn = this.toolbar.querySelector('[data-action="source"]');
            if (btn) btn.classList.toggle('is-active', this.sourceMode);
            this.changed();
        }

        exitSource() {
            if (this.sourceMode) this.toggleSource(false);
        }

        toggleFocus(force) {
            const on = force !== undefined ? force : !this.root.classList.contains('is-focus');
            this.root.classList.toggle('is-focus', on);
            document.body.classList.toggle('cms-focus-open', on);
            const btn = this.toolbar.querySelector('[data-action="focus"]');
            if (btn) {
                btn.classList.toggle('is-active', on);
                btn.title = on ? 'Exit focus mode (Esc)' : 'Focus mode';
            }
            if (on) (this.sourceMode ? this.source : this.area).focus();
        }
    }

    window.RichEditor = RichEditor;
    window.RichEditorUtils = { sanitizeHtml, textToHtml, sanitizeEmbed };
})();
