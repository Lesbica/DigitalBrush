import React, { useState } from "react";
// import styles from "./Login.module.css";
import { EyeIcon, EyeSlashIcon } from "../Register/AuthIcons";
import AuthLayout from "./AuthComponent/AuthForm";
import styles from "./AuthComponent/AuthForm.module.css";
import { useTranslation } from 'react-i18next';

function Login({ toggleForm, handleLogin, handleInputChange, onForgotPassword }) {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        handleLogin(e);
    };

    return (
        <AuthLayout onCreateAccount={toggleForm}>

            {/* 4. <form> тепер всередині */}
            <form className={styles.formContainer} onSubmit={handleSubmit}>
                <div className={styles.field}>
                    <label htmlFor="login-email">{t('auth.email')}</label>
                    <input
                        id="login-email"
                        type="email"
                        name="email"
                        onChange={handleInputChange}
                        required
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="login-password">{t('auth.password')}</label>
                    <div className={styles.passwordWrapper}>
                        <input
                            id="login-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            onChange={handleInputChange}
                            required
                        />
                        <button
                            type="button"
                            className={styles.eyeBtn}
                            onClick={() => setShowPassword((s) => !s)}
                        >
                            {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                        </button>
                    </div>
                </div>

                <div className={styles.actionsRow}>
                    {/* Використовуємо нові уніфіковані класи */}
                    <button type="submit" className={styles.primaryBtn}>
                        {t('auth.logIn')}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryBtn} // <-- Це тепер теж secondaryBtn
                        onClick={onForgotPassword}
                    >
                        {t('auth.forgot')}
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}

export default Login;