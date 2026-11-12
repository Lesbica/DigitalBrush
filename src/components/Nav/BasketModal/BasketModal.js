import React, {useCallback, useEffect, useRef, useState} from 'react';
import styles from './BasketModal.module.css';
import { useCart } from '../../Cart/CartContext'; // Перевірте шлях до CartContext
import { useNavigate } from 'react-router-dom';
import closeIcon from '../../../assets/closeCross.svg';
import trash from "../../../assets/trashBin.svg";


const BasketModal = ({ onClose, onViewItemDetails, position}) => {
    const { cartItems, removeFromCart } = useCart();
    const navigate = useNavigate();
    const modalRef = useRef(null);

    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const subtotal = cartItems.reduce((acc, item) => {
        const price = parseFloat(item.price) || 0;
        return acc + price * item.quantity;
    }, 0).toFixed(2);

    const handleCheckout = () => {
        handleClose();
        navigate('/checkout');
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`}
                 ref={modalRef}
                 style={{
                     top: position ? `${position.top}px` : '15vh',
                     right: position ? `${position.right}px` : 'auto'
                 }}
            >
                <div className={styles.header}>
                    <h2>BASKET</h2>
                    <button className={styles.closeBtn} onClick={handleClose}>
                        <img src={closeIcon} alt="Close" />
                    </button>
                </div>

                <div className={styles.itemList}>
                    {cartItems.length === 0 ? (
                        <p className={styles.emptyMessage}>Your basket is empty.</p>
                    ) : (
                        cartItems.map((item) => (
                            <div className={styles.item}
                                 key={item.id}
                                 onClick={() => {
                                     onViewItemDetails(item);
                                 }}
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
                                        <button className={styles.removeBtn} onClick={(e) => {
                                            e.stopPropagation();
                                            removeFromCart(item.id);
                                        }}>
                                            <img width="36" height="36" src={trash} alt="Remove" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.footer}>
                    <div className={styles.subtotal}>
                        <span>Subtotal</span>
                        <span className={styles.price}>{subtotal}$</span>
                    </div>
                    <button
                        className={styles.buyBtn}
                        onClick={handleCheckout}
                        disabled={cartItems.length === 0}
                    >
                        Buy
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BasketModal;