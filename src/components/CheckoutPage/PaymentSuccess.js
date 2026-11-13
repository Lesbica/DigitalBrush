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
        return <div className={styles.page}><p className={styles.text}>{t('payment.checking')}</p></div>;
    }

    if (state === 'pending') {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>{t('payment.pendingTitle')}</h1>
                <p className={styles.text}>{t('payment.pendingText')}</p>
            </div>
        );
    }

    if (state === 'failed') {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>{t('payment.notCompletedTitle')}</h1>
                <p className={styles.text}>{t('payment.notCompletedText')}</p>
                <div className={styles.actions}>
                    <button className={styles.button} onClick={() => navigate(order?.type === 'commission' ? `/profile?commission=${order.commissionId}` : '/checkout')}>
                        {t('payment.tryAgain')}
                    </button>
                </div>
            </div>
        );
    }

    if (state === 'approved') {
        const isCommission = order.type === 'commission';
        return (
            <div className={styles.page}>
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
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('payment.unknownTitle')}</h1>
            <p className={styles.text}>{t('payment.unknownText')}</p>
            <div className={styles.actions}>
                <button className={styles.button} onClick={() => navigate('/profile')}>{t('payment.toProfile')}</button>
            </div>
        </div>
    );
};

export default PaymentSuccess;
