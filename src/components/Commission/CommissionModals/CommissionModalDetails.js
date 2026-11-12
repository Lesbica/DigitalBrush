import React, {useCallback, useEffect, useState} from "react";
import styles from "./CommissionModalDetails.module.css";
import closeIcon from '../../../assets/closeCross.svg';
import axios from 'axios';
import ImageViewer from "../../ArtCard/ImageViewer/ImageViewer";
import logo from '../../../assets/logo.svg'
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPrice, formatDate } from '../../../i18n/format';

// respondAsArtist: artist of a direct open commission can accept or decline it
// canCancel: customer can cancel an unpaid commission; onStatusChange(newStatus) refreshes the caller
const CommissionModalDetails = ({ commission, onClose, disableTake = false, respondAsArtist = false, canCancel = false, onStatusChange }) => {
    const { t } = useTranslation();
    const toast = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [details, setDetails] = useState(() => ({
        id: commission?.id,
        title: commission?.title || '',
        description: commission?.description || '',
        category: commission?.category || '',
        style: commission?.style || '',
        fileFormat: commission?.fileFormat || commission?.format || '',
        size: commission?.size || '',
        price: commission?.price || '',
        status: commission?.status || 'Open',
        Creator_ID: commission?.Creator_ID || null,
        Customer_ID: commission?.Customer_ID || null,
    }));

    // --- НОВА ЛОГІКА СТАНУ ---
    // Головне зображення (з картки)
    const [mainImage, setMainImage] = useState(
        commission ? commission.imageUrl : null
    );
    // Зображення в нижньому ряду
    const [previewImages, setPreviewImages] = useState([]);

    // Стан для ImageViewer
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

    useEffect(() => {
        if (commission && commission.id) {
            setIsLoading(true);

            // Встановлюємо головне зображення з картки
            const initialMain = commission.imageUrl || null;
            setMainImage(initialMain);
            setPreviewImages([]); // Очищуємо прев'ю перед запитом

            axios.get(`/commissions/${commission.id}`)
                .then(response => {
                    if (response.data?.success && response.data?.commission) {
                        const c = response.data.commission;

                        // Картинки
                        if (Array.isArray(c.images)) {
                            const fetchedImages = c.images;
                            const newPreviewImages = fetchedImages.filter(img => img !== initialMain);
                            setPreviewImages(newPreviewImages);
                            // Якщо не было главной — ставим первую
                            if (!initialMain && fetchedImages.length > 0) {
                                setMainImage(fetchedImages[0]);
                            }
                        }

                        // Текстовые данные
                        setDetails(prev => ({
                            ...prev,
                            title: c.title || prev.title,
                            description: c.description || prev.description,
                            category: c.category || prev.category,
                            style: c.style || prev.style,
                            fileFormat: c.format || prev.fileFormat,
                            size: c.size || prev.size,
                            price: c.price ?? prev.price,
                            status: c.status || prev.status,
                            Creator_ID: c.Creator_ID ?? prev.Creator_ID,
                            Customer_ID: c.Customer_ID ?? prev.Customer_ID,
                            deadline: c.deadline || null,
                            overdue: Boolean(c.overdue),
                        }));
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch all commission images", err);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [commission]); // Залежність тільки від 'commission'

    // --- НОВА ЛОГІКА: "SWAP" (ОБМІН) ЗОБРАЖЕНЬ ---
    const handlePreviewClick = (clickedImage, clickedIndex) => {
        const currentMain = mainImage; // Зберігаємо поточне головне

        // Створюємо новий масив прев'ю
        const newPreviewImages = [...previewImages];

        // Ставимо старе головне зображення на місце, де було прев'ю
        newPreviewImages[clickedIndex] = currentMain;

        // Встановлюємо нове головне зображення
        setMainImage(clickedImage);

        // Оновлюємо рядок прев'ю
        setPreviewImages(newPreviewImages);
    };

    // --- ЛОГІКА ВІДКРИТТЯ ImageViewer ---
    const openImageViewer = useCallback(() => {
        // Усі доступні зображення: поточне головне + ті, що в прев'ю
        const allImagesForViewer = [mainImage, ...previewImages].filter(Boolean);

        // Знаходимо індекс поточного головного (зазвичай 0, але для безпеки)
        const currentIndex = allImagesForViewer.indexOf(mainImage);

        setViewerInitialIndex(currentIndex >= 0 ? currentIndex : 0);
        setIsViewerOpen(true);
    }, [mainImage, previewImages]);

    const closeImageViewer = useCallback(() => {
        setIsViewerOpen(false);
    }, []);

    if (!commission) {
        return null;
    }

    const onImageError = (e) => {
        if (!e.target.src.endsWith("/images/placeholder.svg")) {
            e.target.src = "/images/placeholder.svg";
        }
    };

    const handleAccept = async () => {
        if (!commission?.id) return;
        try {
            // const userId = localStorage.getItem('userId');
            // if (!userId) {
            //     alert("User not logged in");
            //     return;
            // }
            const response = await axios.patch(
                `/commissions/${commission.id}/accept`,
                {}
            );

            if (response.data.success) {
                toast.success(t('commission.accepted'));
                if (onStatusChange) onStatusChange('Sketch');
                onClose();
            }
        } catch (err) {
            console.error(err);
            // Якщо сесія прострочена, бекенд поверне 401, і ми це обробимо тут
            if (err.response && err.response.status === 401) {
                toast.info(t('commission.signInToAccept'));
            } else {
                toast.error(err.response?.data?.message || t('commission.acceptFailed'));
            }
        }
    };



    // Перевіряємо, чи є взагалі зображення для прев'ю
    const hasMultipleImages = previewImages.length > 0;

    // Decline (artist) or cancel (customer)
    const changeStatus = async (action) => {
        const question = action === 'decline' ? t('commission.confirmDecline') : t('commission.confirmCancel');
        if (!window.confirm(question)) return;
        try {
            const res = action === 'decline'
                ? await axios.patch(`/commissions/${commission.id}/decline`)
                : await axios.patch(`/commissions/${commission.id}/status`, { status: 'Cancelled' });
            const newStatus = res.data.status;
            setDetails(prev => ({ ...prev, status: newStatus }));
            if (onStatusChange) onStatusChange(newStatus);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || t('commission.updateFailed'));
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <img src={closeIcon} alt={t('common.close')} />
                </button>

                <div className={styles.topSection}>

                    {isLoading ? (
                        <div className={styles.loadingSpinnerContainer}>
                            <img src={logo} alt="Loading" className={styles.loadingLogo} />
                        </div>
                    ) : (
                        // Використовуємо .imageColumn, якщо є хоча б одне прев'ю
                        // або .singleImage, якщо є ТІЛЬКИ головне зображення
                        <div className={hasMultipleImages ? styles.imageColumn : styles.singleImageWrapper}>
                            <img
                                src={mainImage || "/images/placeholder.svg"}
                                alt={commission.title}
                                // Використовуємо різні класи для компонування
                                className={hasMultipleImages ? styles.image : styles.singleImage}
                                onError={onImageError}
                                onClick={openImageViewer} // <-- ПОВЕРНУЛИ "ДРУГИЙ КЛІК"
                            />

                            {/* Рядок прев'ю показуємо ТІЛЬКИ якщо він не порожній */}
                            {hasMultipleImages && (
                                <div className={styles.previewRow}>
                                    {previewImages.map((img, index) => (
                                        <img
                                            key={index}
                                            src={img || "/images/placeholder.svg"}
                                            alt={`preview ${index + 1}`}
                                            // .activePreview більше не потрібен
                                            className={styles.previewImg}
                                            // Викликаємо нову функцію "SWAP"
                                            onClick={() => handlePreviewClick(img, index)}
                                            onError={onImageError}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- ПРАВА КОЛОНКА (Без змін) --- */}
                    <div className={styles.info}>
                        <p className={styles.title}>{details.title}</p>
                        <p className={styles.field}>
                            <span>{t('art.category')}</span> {details.category ? t(`labels.${details.category}`, { defaultValue: details.category }) : '—'}
                        </p>
                        <p className={styles.field}>
                            <span>{t('art.style')}</span> {details.style || '—'}
                        </p>
                        <p className={styles.field}>
                            <span>{t('art.format')}</span> {details.fileFormat || '—'}
                        </p>
                        <p className={styles.field}>
                            <span>{t('art.size')}</span> {details.size || '—'}
                        </p>
                        <p className={styles.field}>
                            <span>{t('artists.status')}</span> {t(`status.${details.status}`, { defaultValue: details.status || '—' })}
                        </p>
                        {details.deadline && (
                            <p className={styles.field} style={details.overdue ? { color: '#ff8a8a' } : undefined}>
                                <span>{t('commission.deadline')}</span> {formatDate(`${details.deadline}T00:00:00`)}{details.overdue ? ` (${t('commission.overdue')})` : ''}
                            </p>
                        )}
                    </div>
                </div>

                {/* --- НИЖНЯ ЧАСТИНА (Без змін) --- */}
                <div className={styles.about}>
                    <p>{t('commission.about')}</p>
                    <span>{details.description}</span>
                </div>

                <div className={styles.actions}>
                    <button className={styles.priceBtn}>{formatPrice(details.price)}</button>
                    {(respondAsArtist || !(disableTake || details.Creator_ID)) && (
                        <button className={styles.takeBtn} onClick={handleAccept}>{t('commission.accept')}</button>
                    )}
                    {respondAsArtist && (
                        <button className={styles.takeBtn} style={{ background: '#a33' }} onClick={() => changeStatus('decline')}>{t('commission.decline')}</button>
                    )}
                    {canCancel && (
                        <button className={styles.takeBtn} style={{ background: '#a33' }} onClick={() => changeStatus('cancel')}>{t('commission.cancelOrder')}</button>
                    )}
                </div>

            </div>

            {isViewerOpen && (
                <ImageViewer
                    images={[mainImage, ...previewImages].filter(Boolean)}
                    initialImageIndex={viewerInitialIndex}
                    onClose={closeImageViewer}
                />
            )}
        </div>
    );
}

export default CommissionModalDetails;