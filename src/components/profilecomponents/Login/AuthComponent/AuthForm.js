import React from "react";
import styles from "./AuthForm.module.css"; // <-- Використовуємо новий CSS
import logo from "../../../../assets/logoWithText.svg";
import { useTranslation } from 'react-i18next';

function AuthLayout({ children, onCreateAccount }) {
    const { t } = useTranslation();
    return (
        <div className={styles.authCard}>

            {/* 1. Спільний Логотип */}
            <img src={logo} className={styles.logo} alt="logo" />

            {/* 2. Унікальний вміст (поля та кнопки форм) */}
            {children}

            {/* 3. Спільний Розділювач (завжди внизу) */}
            <div className={styles.separator}></div>

            {/* 4. Спільна Нижня Кнопка */}
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