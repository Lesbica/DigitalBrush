import React, {useEffect, useRef, useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import axios from "axios";
import styles from "../../Register/Register.module.css";

// /verify-email?token=... — opened from the confirmation email
export default function VerifyEmail() {
    const [params] = useSearchParams();
    const [state, setState] = useState({status: 'loading', message: 'Confirming your email…'});
    const sent = useRef(false); // the token works once: avoid a second request in StrictMode

    useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        axios.post('/auth/verify-email', {token: params.get('token') || ''})
            .then(res => setState({status: 'ok', message: res.data.message}))
            .catch(err => setState({status: 'error', message: err.response?.data?.message || 'Could not confirm the email.'}));
    }, [params]);

    return (
        <div style={{display: 'flex', justifyContent: 'center', padding: '60px 16px'}}>
            <div className={styles.authCard}>
                <h2 className={styles.mainTitle}>Email confirmation</h2>
                <p className={styles.emailTitle} role={state.status === 'error' ? 'alert' : undefined}
                   style={{textAlign: 'left', color: state.status === 'error' ? '#ff8a8a' : undefined}}>
                    {state.message}
                </p>
                {state.status !== 'loading' && (
                    <div className={styles.buttonsRow}>
                        <Link to="/profile" className={styles.submitBtn} style={{textAlign: 'center', textDecoration: 'none'}}>
                            Log in
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
