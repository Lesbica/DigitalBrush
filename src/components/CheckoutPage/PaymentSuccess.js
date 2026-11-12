import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../Cart/CartContext';
import useOrderStatus from './useOrderStatus';
import styles from './PaymentResult.module.css';
import { useTranslation } from 'react-i18next';

// Landing page after the payment provider. The outcome comes from the server (which only trusts
// the provider), never from the URL.
const PaymentSuccess = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { state, order } = useOrderStatus(searchParams.get('order'));
    const { removeManyFromCart } = useCart();

    const paidPaintings = state === 'approved' && order?.type === 'cart' ? order.paintingIds : null;
    useEffect(() => {
        if (paidPaintings?.length) removeManyFromCart(paidPaintings);
    }, [paidPaintings, removeManyFromCart]);

    if (state === 'loading') {
        return <main className={styles.page}><p className={styles.text}>{t('payment.checking')}</p></main>;
    }

    if (state === 'pending') {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>{t('payment.pendingTitle')}</h1>
                <p className={styles.text}>{t('payment.pendingText')}</p>
            </main>
        );
    }

    if (state === 'failed') {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>{t('payment.notCompletedTitle')}</h1>
                <p className={styles.text}>{t('payment.notCompletedText')}</p>
                <div className={styles.actions}>
                    <button className={styles.button} onClick={() => navigate(order?.type === 'commission' ? `/profile?commission=${order.commissionId}` : '/checkout')}>
                        {t('payment.tryAgain')}
                    </button>
                </div>
            </main>
        );
    }

    if (state === 'approved') {
        const isCommission = order.type === 'commission';
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>{t('payment.successTitle')}</h1>
                <p className={styles.text}>
                    {isCommission ? t('payment.successCommission') : t('payment.successPaintings')}
                </p>
                <div className={styles.actions}>
                    {isCommission ? (
                        <button className={styles.button} onClick={() => navigate(`/profile?commission=${order.commissionId}`)}>{t('payment.openChat')}</button>
                    ) : (
                        <button className={styles.button} onClick={() => navigate('/profile?tab=images')}>{t('payment.myPaintings')}</button>
                    )}
                    <button className={`${styles.button} ${styles.secondary}`} onClick={() => navigate('/shop')}>{t('payment.backToShop')}</button>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>{t('payment.unknownTitle')}</h1>
            <p className={styles.text}>{t('payment.unknownText')}</p>
            <div className={styles.actions}>
                <button className={styles.button} onClick={() => navigate('/profile')}>{t('payment.toProfile')}</button>
            </div>
        </main>
    );
};

export default PaymentSuccess;
