import { useNavigate } from 'react-router-dom';
import styles from './PaymentResult.module.css';

const PaymentFail = () => {
    const navigate = useNavigate();

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Payment failed</h1>
            <p className={styles.text}>The payment was declined or cancelled, and nothing was charged. Please try again.</p>
            <div className={styles.actions}>
                <button className={styles.button} onClick={() => navigate('/checkout')}>Return to checkout</button>
                <button className={`${styles.button} ${styles.secondary}`} onClick={() => navigate('/shop')}>Back to shop</button>
            </div>
        </main>
    );
};

export default PaymentFail;
