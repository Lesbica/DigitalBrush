import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../../Dialog/DetailsDialog.module.css";
import { CloseIcon } from '../../Icons/Icons';
import axios from 'axios';
import ImageViewer from "../../ArtCard/ImageViewer/ImageViewer";
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPrice, formatDate } from '../../../i18n/format';
import useDialog from '../../Dialog/useDialog';
import { useAuth } from '../../../context/AuthContext';

// respondAsArtist: artist of a direct open commission can accept or decline it
// canCancel: customer can cancel an unpaid commission; onStatusChange(newStatus) refreshes the caller
const CommissionModalDetails = ({ commission, onClose, disableTake = false, respondAsArtist = false, canCancel = false, onStatusChange }) => {
    const { t } = useTranslation();
    const dialogRef = useRef(null);
    useDialog(dialogRef, onClose);
    const toast = useToast();
    const { user } = useAuth();

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
    const [confirming, setConfirming] = useState(null);
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
    // asked in the footer first (confirming): 'decline' | 'cancel' | null
    const changeStatus = async (action) => {
        setConfirming(null);
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

    // guests see it (and are asked to sign in); signed-in customers and the request's author do not
    const ownRequest = user && Number(user.id) === Number(details.Customer_ID);
    const canAccept = respondAsArtist
        || (!(disableTake || details.Creator_ID) && !ownRequest && (!user || user.role === 'artist'));
    const specs = [
        [t('art.format'), details.fileFormat],
        [t('art.size'), details.size],
        [t('commission.deadline'), details.deadline
            ? `${formatDate(`${details.deadline}T00:00:00`)}${details.overdue ? ` (${t('commission.overdue')})` : ''}`
            : null],
    ].filter(([, v]) => v);

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="commission-dialog-title">
                <div className={styles.gallery}>
                    {mainImage ? (
                        <button type="button" className={styles.imageButton} onClick={openImageViewer} aria-label={t('art.openImage', { n: 1 })}>
                            <img src={mainImage} alt={details.title} className={styles.artImage} onError={onImageError} />
                        </button>
                    ) : (
                        <div className={styles.noImage}>{isLoading ? t('common.loading') : t('commission.noReferences')}</div>
                    )}
                    {hasMultipleImages && (
                        <div className={styles.thumbs}>
                            {previewImages.map((img, index) => (
                                <button key={index} type="button" onClick={() => handlePreviewClick(img, index)}
                                        aria-label={t('art.openImage', { n: index + 2 })}>
                                    <img src={img || "/images/placeholder.svg"} alt="" onError={onImageError} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.side}>
                    <header className={styles.head}>
                        <div className={styles.tags}>
                            {details.category && <span>{t(`labels.${details.category}`, { defaultValue: details.category })}</span>}
                            {details.style && <span>{details.style}</span>}
                            <span className={styles.original}>{t(`status.${details.status}`, { defaultValue: details.status || '—' })}</span>
                        </div>
                        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
                            <CloseIcon size={18} />
                        </button>
                        <h2 className={styles.title} id="commission-dialog-title">{details.title}</h2>
                    </header>

                    <div className={styles.body}>
                        {details.description && (
                            <section>
                                <h3 className={styles.sectionTitle}>{t('commission.about')}</h3>
                                <p className={styles.description}>{details.description}</p>
                            </section>
                        )}
                        {specs.length > 0 && (
                            <dl className={`${styles.specs} ${details.overdue ? styles.overdue : ''}`}>
                                {specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                            </dl>
                        )}
                    </div>

                    <footer className={styles.foot}>
                        {confirming ? (
                            <>
                                <p className={styles.confirm} role="alert">
                                    {confirming === 'decline' ? t('commission.confirmDecline') : t('commission.confirmCancel')}
                                </p>
                                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)}>{t('common.no')}</button>
                                <button type="button" className={`btn ${styles.danger}`} onClick={() => changeStatus(confirming)}>{t('common.yes')}</button>
                            </>
                        ) : (
                            <>
                                <p className={styles.priceText}>
                                    <small>{t('commissions.budget')}</small>
                                    {formatPrice(details.price)}
                                </p>
                                {respondAsArtist && (
                                    <button type="button" className={`btn ${styles.danger}`} onClick={() => setConfirming('decline')}>{t('commission.decline')}</button>
                                )}
                                {canCancel && (
                                    <button type="button" className={`btn ${styles.danger}`} onClick={() => setConfirming('cancel')}>{t('commission.cancelOrder')}</button>
                                )}
                                {canAccept && (
                                    <button type="button" className={`btn btn-lime ${styles.buyBtn}`} onClick={handleAccept}>{t('commission.accept')}</button>
                                )}
                            </>
                        )}
                    </footer>
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