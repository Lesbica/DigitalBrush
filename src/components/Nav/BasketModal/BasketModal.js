import React, {useCallback, useEffect, useRef, useState} from 'react';
import styles from './BasketModal.module.css';
import { useCart } from '../../Cart/CartContext'; // Перевірте шлях до CartContext
import { useNavigate } from 'react-router-dom';
import closeIcon from '../../../assets/closeCross.svg';
import trash from "../../../assets/trashBin.svg";
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../../i18n/format';
import useDialog from '../../Dialog/useDialog';


const BasketModal = ({ onClose, onViewItemDetails, position}) => {
    const { t } = useTranslation();
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
    useDialog(modalRef, handleClose);

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
                 role="dialog"
                 aria-modal="true"
                 aria-labelledby="basket-title"
                 style={{
                     top: position ? `${position.top}px` : '15vh',
                     right: position ? `${position.right}px` : 'auto'
                 }}
            >
                <div className={styles.header}>
                    <h2 id="basket-title">{t('basket.title')}</h2>
                    <button type="button" className={styles.closeBtn} onClick={handleClose}>
                        <img src={closeIcon} alt={t('common.close')} />
                    </button>
                </div>

                <div className={styles.itemList}>
                    {cartItems.length === 0 ? (
                        <p className={styles.emptyMessage}>{t('basket.empty')}</p>
                    ) : (
                        cartItems.map((item) => (
                            <div className={styles.item}
                                 key={item.id}
                                 onClick={() => {
                                     onViewItemDetails(item);
                                 }}
                            >
                                <img src={item.imageUrl || "/images/placeholder.svg"} alt="" className={styles.itemImage} />

                                <div className={styles.itemInfo}>

                                    <div className={styles.infoText}>
                                        <button type="button" className={`unstyled-button ${styles.itemTitle}`} aria-label={t('basket.openItem', { title: item.title })}
                                                onClick={(e) => { e.stopPropagation(); onViewItemDetails(item); }}>{item.title}</button>
                                        <span className={styles.itemArtist}>{item.artistName}</span>
                                        <p className={styles.itemDesc}>{item.description.substring(0, 100)}...</p>
                                    </div>

                                    <div className={styles.itemActions}>
                                        <span className={styles.itemPrice}>{formatPrice(item.price)}</span>
                                        <button className={styles.removeBtn}
                                                aria-label={t('basket.removeItem', { title: item.title })} onClick={(e) => {
                                            e.stopPropagation();
                                            removeFromCart(item.id);
                                        }}>
                                            <img width="36" height="36" src={trash} alt="" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.footer}>
                    <div className={styles.subtotal}>
                        <span>{t('common.subtotal')}</span>
                        <span className={styles.price}>{formatPrice(subtotal)}</span>
                    </div>
                    <button
                        className={styles.buyBtn}
                        onClick={handleCheckout}
                        disabled={cartItems.length === 0}
                    >
                        {t('basket.buy')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BasketModal;