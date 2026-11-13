import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useDialog from '../../Dialog/useDialog';
import styles from './ImageViewer.module.css'; // Створимо CSS для цього компонента

const ImageViewer = ({ images, initialImageIndex, onClose }) => {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(initialImageIndex);
    const dialogRef = useRef(null);
    useDialog(dialogRef, onClose); // focus, Tab and Escape

    // Оновлення початкового індексу, якщо він змінюється
    useEffect(() => {
        setCurrentIndex(initialImageIndex);
    }, [initialImageIndex]);

    const currentImage = images[currentIndex];

    const goToNext = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, [images.length]);

    const goToPrev = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    }, [images.length]);

    // Обробка натискань клавіш (стрілки, Esc)
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowRight') {
                goToNext();
            } else if (event.key === 'ArrowLeft') {
                goToPrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [goToNext, goToPrev]);


    if (!currentImage) return null; // Не рендерити, якщо немає зображення

    return (
        <div className={styles.viewerOverlay} onClick={onClose}>
            <div className={styles.viewerContent} onClick={(e) => e.stopPropagation()}
                 ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('viewer.label')}>
                <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('common.close')}>
                    &times;
                </button>
                <img src={currentImage} alt={t('viewer.image', { n: currentIndex + 1, total: images.length })} className={styles.fullImage} />

                {images.length > 1 && ( // Показувати стрілки, тільки якщо є більше одного зображення
                    <>
                        <button type="button" className={styles.navButton + ' ' + styles.prev} onClick={goToPrev} aria-label={t('viewer.prev')}>
                            &#10094; {/* Ліва стрілка */}
                        </button>
                        <button type="button" className={styles.navButton + ' ' + styles.next} onClick={goToNext} aria-label={t('viewer.next')}>
                            &#10095; {/* Права стрілка */}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ImageViewer;