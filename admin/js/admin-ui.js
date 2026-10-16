// ========================================================
// Blackwater Digital Blog CMS - Dialog helper
// CmsDialog.open({...}) shows a small form in a modal and
// resolves with the field values, or null when cancelled.
// ========================================================

(function () {
    let active = null;

    function el(tag, attrs = {}, text) {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (value === undefined || value === null || value === false) return;
            if (value === true) node.setAttribute(key, '');
            else node.setAttribute(key, value);
        });
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /**
     * @param {object} options
     *   title, description, submitLabel, extraLabel (optional secondary action, e.g. "Remove link"),
     *   fields: [{ name, label, type: 'text'|'url'|'textarea'|'checkbox'|'select', value, placeholder,
     *              rows, hint, required, options: [{ value, label }], mono }]
     * @returns {Promise<object|null>} values; `_extra: true` when the extra action was chosen
     */
    function open(options) {
        if (active) active.finish(null);

        const root = document.getElementById('cms-dialog');
        const form = document.getElementById('cms-dialog-form');
        const titleEl = document.getElementById('cms-dialog-title');
        const descEl = document.getElementById('cms-dialog-desc');
        const fieldsEl = document.getElementById('cms-dialog-fields');
        const submitBtn = document.getElementById('cms-dialog-submit');
        const extraBtn = document.getElementById('cms-dialog-extra');

        titleEl.textContent = options.title || '';
        descEl.textContent = options.description || '';
        descEl.hidden = !options.description;
        submitBtn.textContent = options.submitLabel || 'Save';
        extraBtn.textContent = options.extraLabel || '';
        extraBtn.hidden = !options.extraLabel;
        fieldsEl.innerHTML = '';

        const inputs = {};
        (options.fields || []).forEach(field => {
            const id = `cms-dialog-field-${field.name}`;
            const group = el('div', { class: 'cms-form-group' });

            if (field.type === 'checkbox') {
                const label = el('label', { class: 'cms-check', for: id });
                const input = el('input', { type: 'checkbox', id, checked: !!field.value });
                label.append(input, el('span', {}, field.label));
                group.appendChild(label);
                inputs[field.name] = input;
            } else {
                group.appendChild(el('label', { class: 'cms-label', for: id }, field.label));
                let input;
                if (field.type === 'textarea') {
                    input = el('textarea', {
                        id, rows: field.rows || 6, placeholder: field.placeholder, required: field.required,
                        class: 'cms-textarea' + (field.mono ? ' cms-mono' : ''), spellcheck: field.mono ? 'false' : undefined
                    });
                    input.value = field.value || '';
                } else if (field.type === 'select') {
                    input = el('select', { id, class: 'cms-select' });
                    (field.options || []).forEach(opt => {
                        const option = el('option', { value: opt.value }, opt.label);
                        if (opt.value === field.value) option.selected = true;
                        input.appendChild(option);
                    });
                } else {
                    input = el('input', {
                        id, type: field.type || 'text', class: 'cms-input',
                        placeholder: field.placeholder, required: field.required
                    });
                    input.value = field.value || '';
                }
                group.appendChild(input);
                if (field.hint) group.appendChild(el('div', { class: 'cms-input-helper' }, field.hint));
                inputs[field.name] = input;
            }
            fieldsEl.appendChild(group);
        });

        root.hidden = false;
        document.body.classList.add('cms-dialog-open');
        const first = fieldsEl.querySelector('input, textarea, select');
        setTimeout(() => (first || submitBtn).focus(), 30);

        return new Promise(resolve => {
            function values(extra) {
                const out = {};
                Object.entries(inputs).forEach(([name, input]) => {
                    out[name] = input.type === 'checkbox' ? input.checked : input.value;
                });
                if (extra) out._extra = true;
                return out;
            }

            function finish(result) {
                root.hidden = true;
                document.body.classList.remove('cms-dialog-open');
                form.removeEventListener('submit', onSubmit);
                root.removeEventListener('click', onClick);
                document.removeEventListener('keydown', onKey, true);
                active = null;
                resolve(result);
            }

            function onSubmit(e) {
                e.preventDefault();
                if (!form.reportValidity()) return;
                finish(values(false));
            }

            function onClick(e) {
                if (e.target.closest('[data-dialog-close]')) finish(null);
                else if (e.target === extraBtn) finish(values(true));
            }

            function onKey(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    finish(null);
                }
            }

            form.addEventListener('submit', onSubmit);
            root.addEventListener('click', onClick);
            document.addEventListener('keydown', onKey, true);
            active = { finish };
        });
    }

    window.CmsDialog = { open };
})();
