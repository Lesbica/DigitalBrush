import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../Cart/CartContext';
import useOrderStatus from './useOrderStatus';
import styles from './PaymentResult.module.css';

// Landing page after the payment provider. The outcome comes from the server (which only trusts
// the provider), never from the URL.
const PaymentSuccess = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { state, order } = useOrderStatus(searchParams.get('order'));
    const { removeManyFromCart } = useCart();

    const paidPaintings = state === 'approved' && order?.type === 'cart' ? order.paintingIds : null;
    useEffect(() => {
        if (paidPaintings?.length) removeManyFromCart(paidPaintings);
    }, [paidPaintings, removeManyFromCart]);

    if (state === 'loading') {
        return <main className={styles.page}><p className={styles.text}>Checking your payment…</p></main>;
    }

    if (state === 'pending') {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>Payment is being processed</h1>
                <p className={styles.text}>
                    The payment provider has not confirmed the payment yet. This page updates by itself,
                    and you will get a notification as soon as it is confirmed.
                </p>
            </main>
        );
    }

    if (state === 'failed') {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>Payment was not completed</h1>
                <p className={styles.text}>No money was taken for this order. You can try again.</p>
                <div className={styles.actions}>
                    <button className={styles.button} onClick={() => navigate(order?.type === 'commission' ? `/profile?commission=${order.commissionId}` : '/checkout')}>
                        Try again
                    </button>
                </div>
            </main>
        );
    }

    if (state === 'approved') {
        const isCommission = order.type === 'commission';
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>Payment successful</h1>
                <p className={styles.text}>
                    {isCommission
                        ? 'The commission is paid. The final artwork is available in the commission chat.'
                        : 'Thank you! The paintings are in your profile, where you can download the originals.'}
                </p>
                <div className={styles.actions}>
                    {isCommission ? (
                        <button className={styles.button} onClick={() => navigate(`/profile?commission=${order.commissionId}`)}>Open the chat</button>
                    ) : (
                        <button className={styles.button} onClick={() => navigate('/profile?tab=images')}>My paintings</button>
                    )}
                    <button className={`${styles.button} ${styles.secondary}`} onClick={() => navigate('/shop')}>Back to shop</button>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Payment status unknown</h1>
            <p className={styles.text}>We could not find this order. If money was taken, it will appear in your profile shortly.</p>
            <div className={styles.actions}>
                <button className={styles.button} onClick={() => navigate('/profile')}>Go to profile</button>
            </div>
        </main>
    );
};

export default PaymentSuccess;
