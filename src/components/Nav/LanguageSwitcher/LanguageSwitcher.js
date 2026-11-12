import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { LANGUAGES } from '../../../i18n';
import styles from './LanguageSwitcher.module.css';

// UK / EN toggle; the choice is remembered in localStorage by the language detector and, for a
// logged-in user, on the server (notifications and emails come in that language)
export default function LanguageSwitcher() {
    const { t, i18n } = useTranslation();
    const { isLoggedIn } = useAuth();
    const current = i18n.resolvedLanguage;

    const choose = (code) => {
        if (code === current) return;
        i18n.changeLanguage(code);
        if (isLoggedIn) axios.put('/profile/language', { language: code }).catch(() => {});
    };

    return (
        <div className={styles.switcher} role="group" aria-label={t('nav.language')}>
            {LANGUAGES.map(({ code, label }) => (
                <button
                    key={code}
                    type="button"
                    lang={code}
                    className={`${styles.option} ${current === code ? styles.active : ''}`}
                    aria-pressed={current === code}
                    onClick={() => choose(code)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
