import { config } from './config.js';
function collectInteractive(maxItems) {
    const INTERACTIVE_SELECTOR = [
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="tab"]',
        '[role="option"]',
        '[role="menuitem"]',
        '[role="combobox"]',
        '[role="searchbox"]',
        '[role="switch"]',
        '[role="textbox"]',
        '[contenteditable="true"]',
        'label',
        'summary',
    ].join(',');
    const implicitRole = (tag, type, explicit) => {
        if (explicit)
            return explicit;
        switch (tag) {
            case 'a':
                return 'link';
            case 'button':
                return 'button';
            case 'select':
                return 'combobox';
            case 'textarea':
                return 'textbox';
            case 'summary':
                return 'button';
            case 'label':
                return 'label';
            case 'input':
                if (type === 'checkbox')
                    return 'checkbox';
                if (type === 'radio')
                    return 'radio';
                if (type === 'submit' || type === 'button' || type === 'reset')
                    return 'button';
                if (type === 'search')
                    return 'searchbox';
                return 'textbox';
            default:
                return tag;
        }
    };
    const nodes = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));
    document.querySelectorAll('[data-ty-ref]').forEach((el) => el.removeAttribute('data-ty-ref'));
    const items = [];
    const seen = new Set();
    let counter = 0;
    const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2)
            return false;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
            return false;
        }
        return true;
    };
    const accessibleName = (el) => {
        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim())
            return aria.trim();
        const labelledby = el.getAttribute('aria-labelledby');
        if (labelledby) {
            const joined = labelledby
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? '')
                .join(' ')
                .trim();
            if (joined)
                return joined;
        }
        const placeholder = el.getAttribute('placeholder');
        if (placeholder && placeholder.trim())
            return placeholder.trim();
        const title = el.getAttribute('title');
        if (title && title.trim())
            return title.trim();
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text)
            return text;
        const value = el.value;
        if (typeof value === 'string' && value.trim())
            return value.trim();
        return '';
    };
    for (const el of nodes) {
        if (!isVisible(el))
            continue;
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type');
        const name = accessibleName(el).slice(0, 160);
        const isField = ['input', 'select', 'textarea'].includes(tag);
        if (!name && !isField)
            continue;
        const role = implicitRole(tag, type, el.getAttribute('role'));
        const href = el.getAttribute('href') ?? undefined;
        if (tag === 'a' && href) {
            const hrefAttr = href.trim();
            if (hrefAttr === '#' || hrefAttr.startsWith('javascript:'))
                continue;
        }
        const key = `${tag}|${role}|${name}|${href ?? ''}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const ref = `e${++counter}`;
        el.setAttribute('data-ty-ref', ref);
        const input = el;
        const item = { ref, tag, role, name };
        if (href)
            item.href = href;
        if (type)
            item.type = type;
        if (isField && typeof input.value === 'string' && input.value)
            item.value = input.value;
        const checked = input.checked;
        if (typeof checked === 'boolean')
            item.checked = checked;
        if (el.disabled)
            item.disabled = true;
        const placeholder = el.getAttribute('placeholder');
        if (placeholder)
            item.placeholder = placeholder;
        items.push(item);
        if (counter >= maxItems)
            break;
    }
    return items;
}
export async function buildSnapshot(page, options = {}) {
    const maxItems = options.maxItems ?? config.snapshotMaxItems;
    return page.evaluate(collectInteractive, maxItems);
}
export function formatSnapshot(items, page) {
    const lines = items.map((item) => {
        const parts = [`[${item.ref}]`, item.role.padEnd(9)];
        if (item.name)
            parts.push(JSON.stringify(item.name));
        if (typeof item.checked === 'boolean')
            parts.push(item.checked ? '(checked)' : '(unchecked)');
        if (item.type)
            parts.push(`type=${item.type}`);
        if (item.value)
            parts.push(`value=${JSON.stringify(item.value)}`);
        if (item.disabled)
            parts.push('(disabled)');
        if (item.href)
            parts.push(`href=${item.href}`);
        return parts.join(' ');
    });
    return [
        `URL: ${page.url}`,
        `TITLE: ${page.title}`,
        `ELEMENTS (${items.length}):`,
        lines.join('\n'),
    ].join('\n');
}
export function refLocator(page, ref) {
    return page.locator(`[data-ty-ref="${ref}"]`);
}
//# sourceMappingURL=snapshot.js.map