import React from 'react';
import styles from './CategoryFilters.module.css';
import { useTranslation } from 'react-i18next';

function CategoryFilters({ categories, activeCategory, onCategoryClick }) {
    const { t } = useTranslation();
    return (
        <div className={styles.categoryGrid}>
            {categories.map((cat) => (
                <button
                    key={cat}
                    className={`${styles.categoryButton} ${activeCategory === cat ? styles.active : ''}`}
                    onClick={() => onCategoryClick(cat)}
                >
                    {t(`labels.${cat}`, { defaultValue: String(cat) })}
                </button>
            ))}
        </div>
    );
}

export default CategoryFilters;