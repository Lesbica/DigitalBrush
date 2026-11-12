import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import styles from "./AuthForm.module.css";
import logo from "../../../../assets/logoWithText.svg";
import { API_BASE } from "../../../../config";

// Shown when the server has Google keys (GET /auth/providers); the sign-in itself happens on the
// server (/auth/google), which brings the user back to ?next= or the profile.
function GoogleButton() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let alive = true;
        axios.get('/auth/providers')
            .then(res => { if (alive) setEnabled(Boolean(res.data?.google)); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    if (!enabled) return null;
    const next = searchParams.get('next');
    const href = `${API_BASE}/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    return (
        <a className={styles.googleBtn} href={href}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.5z"/>
                <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z"/>
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/>
            </svg>
            {t('auth.google')}
        </a>
    );
}

function AuthLayout({ children, onCreateAccount }) {
    const { t } = useTranslation();
    return (
        <div className={styles.authCard}>
            <img src={logo} className={styles.logo} alt="DigitalBrush" />

            {children}

            <GoogleButton />

            <div className={styles.separator}></div>

            <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onCreateAccount}
            >
                {t('auth.createAccount')}
            </button>
        </div>
    );
}

export default AuthLayout;
