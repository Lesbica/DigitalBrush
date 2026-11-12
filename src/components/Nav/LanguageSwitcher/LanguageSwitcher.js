import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../../i18n';
import styles from './LanguageSwitcher.module.css';

// UK / EN toggle; the choice is remembered in localStorage by the language detector
export default function LanguageSwitcher() {
    const { t, i18n } = useTranslation();
    const current = i18n.resolvedLanguage;

    return (
        <div className={styles.switcher} role="group" aria-label={t('nav.language')}>
            {LANGUAGES.map(({ code, label }) => (
                <button
                    key={code}
                    type="button"
                    lang={code}
                    className={`${styles.option} ${current === code ? styles.active : ''}`}
                    aria-pressed={current === code}
                    onClick={() => i18n.changeLanguage(code)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
