import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import styles from '../components/Toast/Toast.module.css';
import { useTranslation } from 'react-i18next';

// Small non-blocking notifications instead of window.alert().
// const toast = useToast(); toast.success('Saved'); toast.error('Failed', { action: { label: 'Retry', onClick } })
const ToastContext = createContext(null);

const DURATION = { success: 4000, info: 5000, error: 7000 };
const MAX_VISIBLE = 4;
let nextId = 1;

function ToastItem({ toast, onClose }) {
    const { t } = useTranslation();
    const { id, kind, message, action, duration } = toast;
    useEffect(() => {
        const timer = setTimeout(() => onClose(id), duration);
        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    return (
        <div className={`${styles.toast} ${styles[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
            <span className={styles.message}>{message}</span>
            {action && (
                <button
                    type="button"
                    className={styles.action}
                    onClick={() => { onClose(id); action.onClick(); }}
                >
                    {action.label}
                </button>
            )}
            <button type="button" className={styles.close} onClick={() => onClose(id)} aria-label={t('common.close')}>×</button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const lastRef = useRef({ text: '', at: 0 });

    const remove = useCallback((id) => setToasts(list => list.filter(t => t.id !== id)), []);

    const show = useCallback((kind, message, options = {}) => {
        const text = String(message ?? '');
        if (!text) return;
        // the same message twice in a row (double click, StrictMode) is shown once
        const now = Date.now();
        if (lastRef.current.text === kind + text && now - lastRef.current.at < 1000) return;
        lastRef.current = { text: kind + text, at: now };
        const toast = {
            id: nextId++,
            kind,
            message: text,
            action: options.action,
            duration: options.duration || (options.action ? 10000 : DURATION[kind]),
        };
        setToasts(list => [...list, toast].slice(-MAX_VISIBLE));
    }, []);

    const api = useMemo(() => ({
        success: (msg, opts) => show('success', msg, opts),
        error: (msg, opts) => show('error', msg, opts),
        info: (msg, opts) => show('info', msg, opts),
    }), [show]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className={styles.container} aria-live="polite">
                {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={remove} />)}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}
