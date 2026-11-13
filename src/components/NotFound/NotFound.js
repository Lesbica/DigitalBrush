import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
    const { t } = useTranslation();
    return (
        <div className={styles.page}>
            <p className={styles.code}>404</p>
            <h1>{t('notFound.title')}</h1>
            <p className={styles.text}>{t('notFound.text')}</p>
            <Link className={styles.link} to="/">{t('notFound.home')}</Link>
        </div>
    );
}
