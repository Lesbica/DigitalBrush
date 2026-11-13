import React from 'react';
import styles from './CheckoutPage.module.css';
import { useCart } from '../Cart/CartContext';
import { useNavigate } from 'react-router-dom';
import trash from '../../assets/trashBin.svg'
import axios from "axios";
import { useModal } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../i18n/format';
import { useAuth } from '../../context/AuthContext';

const CheckoutPage = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const { cartItems, removeFromCart } = useCart();
    const { openModal } = useModal();
    const { user } = useAuth();
    const navigate = useNavigate();

    const subtotalNumber = cartItems.reduce((acc, item) => {
        const price = parseFloat(item.price) || 0;
        return acc + price * item.quantity;
    }, 0);

    const subtotal = subtotalNumber.toFixed(2);

    const handlePay = async (e) => {
        e.preventDefault();
        if (cartItems.length === 0) return;

        try {
            // The backend calculates the amount from DB prices; only IDs are sent.
            const paintingIds = cartItems.map((item) => item.id);

            const res = await axios.post(
                `/payments/create-session`,
                { paintingIds },
                { withCredentials: true }
            );

            const url = res?.data?.checkoutUrl;
            if (url) {
                window.location.href = url;
            } else {
                toast.error(t('checkout.noPaymentUrl'));
            }
        } catch (err) {
            console.error('Payment error:', err);
            toast.error(err.response?.data?.error === 'payments_unavailable' ? t('checkout.unavailable') : t('checkout.createFailed'));
        }
    };

    return (
        <div className={styles.checkoutPage}>
            <div className={styles.content}>
                <div className={styles.itemsColumn}>
                    <h2 className={styles.title}>{t('basket.title')}</h2>
                    <div className={styles.itemList}>
                        {cartItems.length === 0 ? (
                            <p className={styles.emptyMessage}>{t('basket.empty')} <button type="button" className="unstyled-button" style={{ textDecoration: 'underline' }} onClick={() => navigate('/shop')}>{t('checkout.goShopping')}</button></p>
                        ) : (
                            cartItems.map((item) => (
                                <div
                                    className={styles.item}
                                    key={item.id}
                                    onClick={() => openModal(item)}
                                >
                                    <img src={item.imageUrl || "/images/placeholder.svg"} alt="" className={styles.itemImage} />
                                    <div className={styles.itemInfo}>
                                        <div className={styles.infoText}>
                                            <button type="button" className={`unstyled-button ${styles.itemTitle}`} aria-label={t('basket.openItem', { title: item.title })}
                                                onClick={(e) => { e.stopPropagation(); openModal(item); }}>{item.title}</button>
                                            <span className={styles.itemArtist}>{item.artistName}</span>
                                            <p className={styles.itemDesc}>{(item.description || '').length > 100 ? `${item.description.substring(0, 100)}…` : item.description}</p>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <span className={styles.itemPrice}>{formatPrice(item.price)}</span>
                                            <button
                                                className={styles.removeBtn}
                                                aria-label={t('basket.removeItem', { title: item.title })}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFromCart(item.id);
                                                }}
                                            >
                                                <img width="36" height="36" src={trash} alt="" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* --- Права колонка (Оплата) (без змін) --- */}
                <div className={styles.paymentColumn}>
                    <form className={styles.paymentForm} onSubmit={handlePay}>
                        <div className={styles.formGroup}>
                            <label htmlFor="checkout-name">{t('checkout.buyer')}</label>
                            <input type="text" id="checkout-name" value={user?.name || ''} readOnly />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="checkout-email">{t('checkout.email')}</label>
                            <input type="email" id="checkout-email" value={user?.email || ''} readOnly />
                        </div>

                        <div className={styles.subtotal}>
                            <span className={styles.subtotalText}>{t('common.subtotal')}</span>
                            <span>{formatPrice(subtotal)}</span>
                        </div>
                        <button
                            type="submit"
                            className={styles.payBtn}
                            disabled={cartItems.length === 0}
                        >
                            {t('checkout.pay')}
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default CheckoutPage;