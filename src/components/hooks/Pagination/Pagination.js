import React from 'react';
import styles from './Pagination.module.css';
import { useTranslation } from 'react-i18next';

/**
 * Компонент, що відображає UI пагінації (кнопки).
 * @param {number} currentPage - Поточна активна сторінка (індекс 0).
 * @param {number} totalPages - Загальна кількість сторінок.
 * @param {function} onPageChange - Функція для зміни сторінки (приймає новий індекс).
 */
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const { t } = useTranslation();

    const renderPageNumbers = () => {
        if (totalPages <= 7) {
            const pageNumbers = [];
            for (let i = 0; i < totalPages; i++) {
                pageNumbers.push(
                    <button
                        key={i}
                        className={`${styles.pageNumber} ${i === currentPage ? styles.active : ""}`}
                        onClick={() => onPageChange(i)}
                    aria-label={t('pagination.page', { n: i + 1 })}
                    aria-current={i === currentPage ? 'page' : undefined}
                    >
                        {i + 1}
                    </button>
                );
            }
            return pageNumbers;
        }

        const pages = [];
        const siblingCount = 1;

        pages.push(
            <button
                key={0}
                className={`${styles.pageNumber} ${0 === currentPage ? styles.active : ""}`}
                onClick={() => onPageChange(0)}
                aria-label={t('pagination.page', { n: 1 })}
                aria-current={0 === currentPage ? 'page' : undefined}
            >
                1
            </button>
        );

        if (currentPage > siblingCount + 1) {
            pages.push(<span key="dots1" className={styles.paginationDots} aria-hidden="true">...</span>);
        }

        const startPage = Math.max(1, currentPage - siblingCount);
        const endPage = Math.min(totalPages - 2, currentPage + siblingCount);

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <button
                    key={i}
                    className={`${styles.pageNumber} ${i === currentPage ? styles.active : ""}`}
                    onClick={() => onPageChange(i)}
                aria-label={t('pagination.page', { n: i + 1 })}
                aria-current={i === currentPage ? 'page' : undefined}
                >
                    {i + 1}
                </button>
            );
        }

        if (currentPage < totalPages - siblingCount - 2) {
            pages.push(<span key="dots2" className={styles.paginationDots} aria-hidden="true">...</span>);
        }

        if (totalPages > 1) {
            pages.push(
                <button
                    key={totalPages - 1}
                    className={`${styles.pageNumber} ${totalPages - 1 === currentPage ? styles.active : ""}`}
                    onClick={() => onPageChange(totalPages - 1)}
                aria-label={t('pagination.page', { n: totalPages })}
                aria-current={totalPages - 1 === currentPage ? 'page' : undefined}
                >
                    {totalPages}
                </button>
            );
        }
        return pages;
    };

    if (totalPages <= 1) {
        return null;
    }

    return (
        <nav className={styles.paginationContainer} aria-label={t('pagination.label')}>
            <div className={styles.pagination}>
                <button
                    className={styles.pageBtn}
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    aria-label={t('pagination.prev')}
                >
                    ‹
                </button>

                {renderPageNumbers()}

                <button
                    className={styles.pageBtn}
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages - 1}
                    aria-label={t('pagination.next')}
                >
                    ›
                </button>
            </div>
        </nav>
    );
};

export default Pagination;