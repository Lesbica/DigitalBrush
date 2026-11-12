import React, {useCallback, useEffect, useRef, useState} from 'react';
import axios from 'axios';
import styles from './ArtDetailsModal.module.css';
import closeIcon from '../../../assets/closeCross.svg';
import ImageViewer from "../ImageViewer/ImageViewer";
import { useCart } from '../../Cart/CartContext';
import { useNavigate } from "react-router-dom";
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../../i18n/format';

const lerp = (current, target, factor) => {
    return current * (1 - factor) + target * factor;
};

const ArtDetailsModal = ({art, onClose, isLoggedIn}) => {
    const { t } = useTranslation();
    const toast = useToast();

    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [likes, setLikes] = useState(Number(art?.likes) || 0);
    const [owned, setOwned] = useState(false);

    const leftColumnRef = useRef(null);
    const rightInfoRef = useRef(null);

    const leftScroll = useRef({current: 0, target: 0});
    const rightScroll = useRef({current: 0, target: 0});
    const animationFrameId = useRef(null);
    const lerpFactor = 0.1;

    const navigate = useNavigate();
    const { addToCart } = useCart();

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
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

    const smoothScrollLoop = () => {
        let leftNeedsUpdate = false;
        let rightNeedsUpdate = false;

        if (leftColumnRef.current) {
            const {current, target} = leftScroll.current;
            if (Math.abs(target - current) > 0.1) {
                leftScroll.current.current = lerp(current, target, lerpFactor);
                leftColumnRef.current.scrollTop = leftScroll.current.current;
                leftNeedsUpdate = true;
            } else if (current !== target) {
                leftScroll.current.current = target;
                leftColumnRef.current.scrollTop = target;
            }
        }

        if (rightInfoRef.current) {
            const {current, target} = rightScroll.current;
            if (Math.abs(target - current) > 0.1) {
                rightScroll.current.current = lerp(current, target, lerpFactor);
                rightInfoRef.current.scrollTop = rightScroll.current.current;
                rightNeedsUpdate = true;
            } else if (current !== target) {
                rightScroll.current.current = target;
                rightInfoRef.current.scrollTop = target;
            }
        }

        if (leftNeedsUpdate || rightNeedsUpdate) {
            animationFrameId.current = requestAnimationFrame(smoothScrollLoop);
        } else {
            animationFrameId.current = null;
        }
    };

    const startScrollAnimation = () => {
        if (!animationFrameId.current) {
            animationFrameId.current = requestAnimationFrame(smoothScrollLoop);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleWheelScroll = (e) => {
        e.preventDefault();
        const scrollAmount = e.deltaY;

        if (leftColumnRef.current) {
            const maxScroll = leftColumnRef.current.scrollHeight - leftColumnRef.current.clientHeight;
            leftScroll.current.target = Math.max(0, Math.min(leftScroll.current.target + scrollAmount, maxScroll));
        }

        if (rightInfoRef.current) {
            const maxScroll = rightInfoRef.current.scrollHeight - rightInfoRef.current.clientHeight;
            rightScroll.current.target = Math.max(0, Math.min(rightScroll.current.target + scrollAmount, maxScroll));
        }

        startScrollAnimation();
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

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>

                <div className={styles.modalContent} onWheel={handleWheelScroll}>
                    <button className={styles.closeBtnFixed} onClick={onClose}>
                        <img src={closeIcon} alt={t('common.close')}/>
                    </button>

                    <div className={styles.leftColumn} ref={leftColumnRef}>
                        {imagesToShow.map((imgUrl, index) => (
                            <img
                                key={index}
                                src={imgUrl}
                                alt={`${art.title} preview ${index + 1}`}
                                className={styles.artImage}
                                onError={(e) => {
                                    e.target.src = "/images/placeholder.svg";
                                }}
                                onClick={() => openImageViewer(index)}
                            />
                        ))}
                    </div>

                    <div className={styles.rightColumn}>
                        <div className={styles.scrollableInfo} ref={rightInfoRef}>
                            <div className={styles.topSection}>
                                <h2 className={styles.title}>{art.title} </h2>
                            </div>

                            <p
                                className={styles.artistName}
                                onClick={handleArtistNameClick}
                                title={t('art.viewArtist')}
                            >
                                {art.artistName}
                            </p>

                            <div className={styles.detailsList}>
                                <p className={styles.field}><span>{t('art.category')}</span> {art.category ? t(`labels.${art.category}`, { defaultValue: art.category }) : '—'}</p>
                                <p className={styles.field}><span>{t('art.style')}</span> {art.style || '—'}</p>
                                <p className={styles.field}><span>{t('art.format')}</span> {art.fileFormat || '—'}</p>
                                <p className={styles.field}><span>{t('art.size')}</span> {art.size || '—'}</p>
                            </div>

                            <p className={styles.description}>
                                {art.description}
                            </p>
                        </div>

                        <div className={styles.actions}>
                            <div className={styles.infoRow}>
                                <p className={styles.priceText}>
                                    {formatPrice(art.price)}
                                </p>

                                <span className={styles.likesText}>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                    {likes}
                                </span>
                            </div>

                            <div className={styles.buttonRow}>
                                {owned ? (
                                    <button className={styles.buyBtn} onClick={handleDownloadClick}>{t('art.download')}</button>
                                ) : (
                                    <button className={styles.buyBtn} onClick={handleBuyClick}>{t('basket.buy')}</button>
                                )}

                                <button className={styles.likeBtn} onClick={handleLikeClick} disabled={likeLoading}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={isLiked ? styles.likedHeart : styles.unlikedHeart}>
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
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