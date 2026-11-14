import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import styles from '../../Dialog/DetailsDialog.module.css';
import { CloseIcon, HeartIcon } from '../../Icons/Icons';
import ImageViewer from "../ImageViewer/ImageViewer";
import { useCart } from '../../Cart/CartContext';
import { useNavigate } from "react-router-dom";
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPrice, formatDate } from '../../../i18n/format';
import useDialog from '../../Dialog/useDialog';

const ArtDetailsModal = ({art, onClose, isLoggedIn}) => {
    const { t } = useTranslation();
    const dialogRef = useRef(null);
    useDialog(dialogRef, onClose);
    const toast = useToast();

    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [likes, setLikes] = useState(Number(art?.likes) || 0);
    const [owned, setOwned] = useState(false);

    const navigate = useNavigate();
    const { addToCart } = useCart();

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Ініціалізуємо стани лайку при зміні переданого арт-об'єкта
    useEffect(() => {
        setIsLiked(!!(art?.likedByCurrentUser || art?.liked));
        setLikes(Number(art?.likes) || 0);
    }, [art]);

    // Проверяем владение картиной (для замены кнопки Buy -> Download)
    useEffect(() => {
        const checkOwnership = async () => {
            try {
                if (!isLoggedIn || !art?.id) {
                    setOwned(false);
                    return;
                }
                // Relative path to honor axios.defaults.baseURL
                const res = await axios.get(`/profile/check-ownership/${art.id}`);
                setOwned(!!res?.data?.owned);
            } catch (e) {
                console.error('Ownership check failed:', e);
                setOwned(false);
            }
        };
        checkOwnership();
    }, [art?.id, isLoggedIn]);

    const [likeLoading, setLikeLoading] = useState(false);
    const handleLikeClick = async () => {
        if (!isLoggedIn) {
            toast.info(t('art.signInToLike'));
            return;
        }
        if (!art?.id || likeLoading) return;
        try {
            setLikeLoading(true);
            const res = await axios.post(`/paintings/${art.id}/like`);
            if (res?.data?.success) {
                setIsLiked(!!res.data.liked);
                setLikes(Number(res.data.likes) || 0);
            }
        } catch (e) {
            console.error('Like toggle failed:', e);
        } finally {
            setLikeLoading(false);
        }
    };

    const handleArtistNameClick = () => {
        if (art.artistId !== undefined && art.artistId !== null) {
            onClose();
            navigate(`/author/${art.artistId}`);
        } else {
            console.warn("Artist ID is missing for navigation");
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const imagesToShow = art.images && art.images.length > 0 ? art.images : [art.imageUrl];

    const openImageViewer = useCallback((index) => {
        setViewerInitialIndex(index);
        setIsViewerOpen(true);
    }, []);

    const closeImageViewer = useCallback(() => {
        setIsViewerOpen(false);
    }, []);

    const handleBuyClick = () => {
        if (!isLoggedIn) {
            toast.info(t('art.signInToBuy'));
            onClose();
            return;
        }
        addToCart(art);
    };

    const handleDownloadClick = async () => {
        try {
            if (!art?.id) return;
            const response = await axios.get(`profile/download/${art.id}`, { responseType: 'blob' });

            // Определяем имя файла и тип по заголовкам ответа
            const headers = response.headers || {};
            const disposition = headers['content-disposition'] || headers['Content-Disposition'];
            const contentType = headers['content-type'] || headers['Content-Type'] || 'application/octet-stream';

            let filename = `${art.title || 'download'}`;
            if (disposition && typeof disposition === 'string') {
                const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
                const raw = (match && (match[1] || match[2])) || null;
                if (raw) {
                    try { filename = decodeURIComponent(raw); } catch { filename = raw; }
                }
            }

            // Гарантируем корректное расширение по типу контента
            const ensureExt = (name, ext) => (name.toLowerCase().endsWith(ext) ? name : name + ext);
            if (/application\/zip/i.test(contentType)) {
                filename = ensureExt(filename, '.zip');
            } else if (/image\/(png|jpeg|jpg)/i.test(contentType)) {
                const ext = /image\/png/i.test(contentType) ? '.png' : '.jpg';
                filename = ensureExt(filename, ext);
            }

            const blob = new Blob([response.data], { type: contentType });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error('Download failed:', e);
            toast.error(t('art.downloadFailed'));
        }
    };

    const specs = [
        [t('art.format'), art.fileFormat],
        [t('art.size'), art.size],
        [t('art.created'), art.creationDate ? formatDate(art.creationDate) : null],
    ].filter(([, v]) => v);

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="art-dialog-title">
                <div className={styles.gallery}>
                    {imagesToShow.map((imgUrl, index) => (
                        <button key={index} type="button" className={styles.imageButton}
                                onClick={() => openImageViewer(index)} aria-label={t('art.openImage', { n: index + 1 })}>
                            <img src={imgUrl} alt={`${art.title} ${index + 1}`} className={styles.artImage}
                                 onError={(e) => { e.target.src = "/images/placeholder.svg"; }} />
                        </button>
                    ))}
                </div>

                <div className={styles.side}>
                    <header className={styles.head}>
                        <div className={styles.tags}>
                            {art.category && <span>{t(`labels.${art.category}`, { defaultValue: art.category })}</span>}
                            {art.style && <span>{art.style}</span>}
                            <span className={styles.original}>{t('art.original')}</span>
                        </div>
                        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
                            <CloseIcon size={18} />
                        </button>
                        <h2 className={styles.title} id="art-dialog-title">{art.title}</h2>
                        <button type="button" className={styles.artist} onClick={handleArtistNameClick} title={t('art.viewArtist')}>
                            {art.authorAvatar
                                ? <img src={art.authorAvatar} alt="" />
                                : <span className={styles.initial} aria-hidden="true">{String(art.artistName || '?').charAt(0)}</span>}
                            {art.artistName}
                        </button>
                    </header>

                    <div className={styles.body}>
                        {art.description && <p className={styles.description}>{art.description}</p>}
                        {specs.length > 0 && (
                            <dl className={styles.specs}>
                                {specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                            </dl>
                        )}
                        <ul className={styles.perks}>
                            <li>{t('art.perkFile')}</li>
                            <li>{t('art.perkArtist')}</li>
                        </ul>
                    </div>

                    <footer className={styles.foot}>
                        <p className={styles.priceText}>{formatPrice(art.price)}</p>
                        {/* One like control: the heart is the button, the number is its count */}
                        <button type="button" className={styles.likeToggle} onClick={handleLikeClick} disabled={likeLoading}
                                aria-pressed={isLiked} aria-label={`${isLiked ? t('art.unlike') : t('art.like')} (${likes})`}>
                            <HeartIcon size={20} className={isLiked ? styles.likedHeart : undefined} />
                            <span aria-hidden="true">{likes}</span>
                        </button>
                        {owned ? (
                            <button type="button" className={`btn btn-lime ${styles.buyBtn}`} onClick={handleDownloadClick}>{t('art.download')}</button>
                        ) : (
                            <button type="button" className={`btn btn-lime ${styles.buyBtn}`} onClick={handleBuyClick}>{t('art.addToBasket')}</button>
                        )}
                    </footer>
                </div>
            </div>
            {isViewerOpen && (
                <ImageViewer
                    images={imagesToShow}
                    initialImageIndex={viewerInitialIndex}
                    onClose={closeImageViewer}
                />
            )}
        </div>
    );
};

export default ArtDetailsModal;