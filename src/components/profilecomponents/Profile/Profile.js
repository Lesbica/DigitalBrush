import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Login from '../Login/Login';
import Register from '../Register/Register';
import ForgotPassword from '../Login/ForgotPassword/ForgotPassword';
import styles from './Profile.module.css';
import DigitalBrushProfile from './UserProfile/DigitalBrushProfile';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from 'react-i18next';

// Only same-site paths are allowed as a post-login destination
const safeNext = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : null);

function Profile() {
    const { t } = useTranslation();
    const toast = useToast();
    const { user, loading, login, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [view, setView] = useState('login');
    const [credentials, setCredentials] = useState({ email: '', password: '' });

    // Back from Google with an error (refused, unconfirmed email, ...)
    const authError = searchParams.get('authError');
    useEffect(() => {
        if (authError === 'google') toast.error(t('auth.googleFailed'));
    }, [authError, toast, t]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await login(credentials.email, credentials.password);
            setCredentials(prev => ({ ...prev, password: '' }));
            const next = safeNext(searchParams.get('next'));
            if (next) navigate(next, { replace: true });
        } catch (error) {
            const data = error.response?.data;
            if (data?.code === 'EMAIL_NOT_VERIFIED') {
                const email = credentials.email;
                const resend = async () => {
                    try {
                        const res = await axios.post('/auth/resend-verification', { email });
                        toast.success(res.data.message);
                    } catch {
                        toast.error(t('auth.linkFailed'));
                    }
                };
                toast.error(data.message, { action: { label: t('register.sendAgain'), onClick: resend } });
                return;
            }
            toast.error(data?.message || t('auth.loginFailed'));
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
        setView('login');
        setCredentials({ email: '', password: '' });
    };

    if (loading) return <div className={styles.profilePage} />;

    return (
        <div className={styles.profilePage}>
            {user ? (
                <DigitalBrushProfile user={user} onLogout={handleLogout} />
            ) : (
                <div className={styles.authFormsContainer}>
                    {view === 'login' && (
                        <Login
                            handleLogin={handleLogin}
                            handleInputChange={handleInputChange}
                            toggleForm={() => setView('register')}
                            onForgotPassword={() => setView('forgotPassword')}
                        />
                    )}
                    {view === 'register' && <Register toggleForm={() => setView('login')} />}
                    {view === 'forgotPassword' && (
                        <ForgotPassword onBack={() => setView('login')} toggleForm={() => setView('register')} />
                    )}
                </div>
            )}
        </div>
    );
}

export default Profile;
