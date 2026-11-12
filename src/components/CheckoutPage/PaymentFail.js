import { useNavigate } from 'react-router-dom';
import styles from './PaymentResult.module.css';
import { useTranslation } from 'react-i18next';

const PaymentFail = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>{t('payment.failedTitle')}</h1>
            <p className={styles.text}>{t('payment.failedText')}</p>
            <div className={styles.actions}>
                <button className={styles.button} onClick={() => navigate('/checkout')}>{t('payment.backToCheckout')}</button>
                <button className={`${styles.button} ${styles.secondary}`} onClick={() => navigate('/shop')}>{t('payment.backToShop')}</button>
            </div>
        </main>
    );
};

export default PaymentFail;
