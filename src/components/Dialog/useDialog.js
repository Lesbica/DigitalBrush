import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keyboard behaviour of a modal dialog (WAI-ARIA dialog pattern):
// focus moves into the dialog, Tab stays inside, Escape closes it, and focus returns to
// the element that opened it. Put role="dialog" aria-modal="true" aria-labelledby on `ref`.
export default function useDialog(ref, onClose) {
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const opener = document.activeElement;
        const visible = (el) => {
            if (el.closest('[hidden], [inert]')) return false;
            const s = getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden';
        };
        const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter(visible);

        const first = node.querySelector('[data-autofocus]') || focusables()[0] || node;
        if (first === node && !node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
        first.focus({ preventScroll: true });

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current?.();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = focusables();
            if (!items.length) { e.preventDefault(); return; }
            const firstItem = items[0];
            const lastItem = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === firstItem || document.activeElement === node)) {
                e.preventDefault();
                lastItem.focus();
            } else if (!e.shiftKey && document.activeElement === lastItem) {
                e.preventDefault();
                firstItem.focus();
            }
        };
        node.addEventListener('keydown', onKeyDown);
        return () => {
            node.removeEventListener('keydown', onKeyDown);
            if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
        };
    }, [ref]);
}

// Enter/Space activate an element that acts as a button but cannot be a <button>
export const onActivateKey = (handler) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(e);
    }
};
