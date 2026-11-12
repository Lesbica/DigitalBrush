import React, { useState } from 'react';
import styles from './AdvancedFilters.module.css';

// selected: { [columnTitle]: value }; onSelect(columnTitle, value) is called for plain options and for
// sub-options (e.g. a style); without onSelect the panel is display-only.
function AdvancedFilters({ filterConfig, selected = {}, onSelect }) {
    const [isOpen, setIsOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);

    return (
        <div className={styles.wrapper}>
            {/* Кнопка тепер всередині компонента */}
            <button
                className={styles.toggleButton}
                onClick={() => setIsOpen(!isOpen)}
            >
                ADDITIONAL FILTERS
                <svg
                    width="11"
                    height="18"
                    viewBox="0 0 12 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={isOpen ? styles.rotatedIcon : styles.icon}
                >
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="2"/>
                </svg>
            </button>

            {/* Панель фільтрів відображається умовно */}
            {isOpen && (
                <div className={styles.filtersContainer}>
                    {filterConfig.map((column, index) => (
                        <div key={column.title} className={styles.filterColumn}>
                            <h4 className={styles.columnTitle}>{column.title}</h4>
                            <ul className={styles.filterList}>
                                {column.options.map(opt => {
                                    const picked = selected[column.title];
                                    const pickedSub = opt.subOptions?.includes(picked) ? picked : null;
                                    return (
                                    <li
                                        key={opt.name}
                                        className={`${styles.filterItem} ${opt.subOptions ? styles.hasSubMenu : ''} ${picked === opt.name || pickedSub ? styles.selected : ''}`}
                                        onClick={() => {
                                            if (opt.subOptions) setOpenSubMenu(openSubMenu === opt.name ? null : opt.name);
                                            else if (onSelect) onSelect(column.title, opt.name);
                                        }}
                                    >
                                        {pickedSub || opt.name}
                                        {opt.subOptions && <span>{openSubMenu === opt.name ? '‹' : '›'}</span>}

                                        {opt.subOptions && (
                                            <div className={`
                                                ${styles.subList} 
                                                ${openSubMenu === opt.name ? styles.open : ''}
                                                ${index === filterConfig.length - 1 ? styles.opensLeft : ''} 
                                            `}>
                                                {opt.subOptions.map(subOpt => (
                                                    <li
                                                        key={subOpt}
                                                        className={`${styles.subItem} ${picked === subOpt ? styles.selected : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onSelect) onSelect(column.title, subOpt);
                                                            setOpenSubMenu(null);
                                                        }}
                                                    >
                                                        {subOpt}
                                                    </li>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AdvancedFilters;