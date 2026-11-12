import React from 'react';
import styles from './CheckoutPage.module.css';
import { useCart } from '../Cart/CartContext';
import { useNavigate } from 'react-router-dom';
import trash from '../../assets/trashBin.svg'
import axios from "axios";
import url from '../../URL';

const CheckoutPage = ({ onViewArtDetails }) => {
    const { cartItems, removeFromCart } = useCart();
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
                console.error('Fondy response:', res.data);
                alert('Failed to get payment URL');
            }
        } catch (err) {
            console.error('Payment error:', err);
            alert('Error while creating payment');
        }
    };

    return (
        <div className={styles.checkoutPage}>
            <div className={styles.content}>
                <div className={styles.itemsColumn}>
                    <h2 className={styles.title}>BASKET</h2>
                    <div className={styles.itemList}>
                        {cartItems.length === 0 ? (
                            <p className={styles.emptyMessage}>Your basket is empty. <span onClick={() => navigate('/shop')}>Go shopping.</span></p>
                        ) : (
                            cartItems.map((item) => (
                                <div
                                    className={styles.item}
                                    key={item.id}
                                    onClick={() => onViewArtDetails(item)}
                                >
                                    <img src={item.imageUrl || "/images/placeholder.png"} alt={item.title} className={styles.itemImage} />
                                    <div className={styles.itemInfo}>
                                        <div className={styles.infoText}>
                                            <span className={styles.itemTitle}>{item.title}</span>
                                            <span className={styles.itemArtist}>{item.artistName}</span>
                                            <p className={styles.itemDesc}>{item.description.substring(0, 100)}...</p>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <span className={styles.itemPrice}>{item.price}$</span>
                                            <button
                                                className={styles.removeBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFromCart(item.id);
                                                }}
                                            >
                                                <img width="36" height="36" src={trash} alt="Remove" />
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
                            <label htmlFor="name">User's name</label>
                            <input type="text" id="name" required placeholder="Kira Kudo" />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" required placeholder="kudo.kira@gmail.com" />
                        </div>

                        <div className={styles.subtotal}>
                            <span className={styles.subtotalText}>Subtotal</span>
                            <span>{subtotal}$</span>
                        </div>
                        <button
                            type="submit"
                            className={styles.payBtn}
                            disabled={cartItems.length === 0}
                        >
                            Pay with
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default CheckoutPage;