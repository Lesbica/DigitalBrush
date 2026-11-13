import React, {useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import axios from "axios";
import styles from "../../Register/Register.module.css";
import { useTranslation } from 'react-i18next';

// /reset-password?token=... — opened from the password reset email
export default function ResetPassword() {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { ok, message }

    const submit = async (e) => {
        e.preventDefault();
        if (password !== repeat) {
            setResult({ok: false, message: t('auth.passwordsDiffer')});
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/auth/reset-password', {token: params.get('token') || '', password});
            setResult({ok: true, message: res.data.message});
        } catch (err) {
            setResult({ok: false, message: err.response?.data?.message || t('auth.resetFailed')});
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{display: 'flex', justifyContent: 'center', padding: '60px 16px'}}>
            {result?.ok ? (
                <div className={styles.authCard}>
                    <h2 className={styles.mainTitle}>{t('auth.passwordChanged')}</h2>
                    <p className={styles.emailTitle} style={{textAlign: 'left'}}>{result.message}</p>
                    <div className={styles.buttonsRow}>
                        <Link to="/profile" className={styles.submitBtn} style={{textAlign: 'center', textDecoration: 'none'}}>{t('auth.logIn')}</Link>
                    </div>
                </div>
            ) : (
                <form className={styles.authCard} onSubmit={submit}>
                    <h2 className={styles.mainTitle}>{t('auth.newPassword')}</h2>
                    <div className={styles.field}>
                        <label htmlFor="new-password">{t('auth.newPassword')}</label>
                        <input id="new-password" autoComplete="new-password" type="password" value={password} minLength="6" maxLength="72" required
                               onChange={(e) => setPassword(e.target.value)} disabled={loading}/>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="repeat-password">{t('auth.repeatPassword')}</label>
                        <input id="repeat-password" autoComplete="new-password" type="password" value={repeat} minLength="6" maxLength="72" required
                               onChange={(e) => setRepeat(e.target.value)} disabled={loading}/>
                    </div>
                    {result && <p role="alert" style={{color: '#ff8a8a', margin: 0}}>{result.message}</p>}
                    <div className={styles.buttonsRow}>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? t('common.saving') : t('auth.savePassword')}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
