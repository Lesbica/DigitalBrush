import { useId, useState } from 'react';
import styles from './AdvancedFilters.module.css';
import { useTranslation } from 'react-i18next';

// selected: { [columnTitle]: value }; onSelect(columnTitle, value) is called for plain options and for
// sub-options (e.g. a style); without onSelect the panel is display-only.
// Every option is a real <button> (keyboard, screen readers); aria-pressed marks the chosen one.
function AdvancedFilters({ filterConfig, selected = {}, onSelect }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);
    const panelId = useId();
    const label = (name) => t(`labels.${name}`, { defaultValue: name });

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={panelId}
            >
                {t('filters.additional')}
                <svg
                    width="11"
                    height="18"
                    viewBox="0 0 12 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className={isOpen ? styles.rotatedIcon : styles.icon}
                >
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="2"/>
                </svg>
            </button>

            {isOpen && (
                <div className={styles.filtersContainer} id={panelId}>
                    {filterConfig.map((column, index) => {
                        const headingId = `${panelId}-col-${index}`;
                        return (
                            <div key={column.title} className={styles.filterColumn} role="group" aria-labelledby={headingId}>
                                <h4 className={styles.columnTitle} id={headingId}>{label(column.title)}</h4>
                                <ul className={styles.filterList}>
                                    {column.options.map(opt => {
                                        const picked = selected[column.title];
                                        const pickedSub = opt.subOptions?.includes(picked) ? picked : null;
                                        const subId = `${panelId}-sub-${index}-${opt.name.replace(/\W+/g, '')}`;
                                        const subOpen = openSubMenu === opt.name;
                                        return (
                                            <li
                                                key={opt.name}
                                                className={`${styles.filterItem} ${opt.subOptions ? styles.hasSubMenu : ''} ${picked === opt.name || pickedSub ? styles.selected : ''}`}
                                            >
                                                {opt.subOptions ? (
                                                    <button
                                                        type="button"
                                                        className={`unstyled-button ${styles.optionButton}`}
                                                        onClick={() => setOpenSubMenu(subOpen ? null : opt.name)}
                                                        aria-expanded={subOpen}
                                                        aria-controls={subId}
                                                    >
                                                        <span>{pickedSub || label(opt.name)}</span>
                                                        <span aria-hidden="true">{subOpen ? '‹' : '›'}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className={`unstyled-button ${styles.optionButton}`}
                                                        onClick={() => onSelect && onSelect(column.title, opt.name)}
                                                        aria-pressed={picked === opt.name}
                                                    >
                                                        {label(opt.name)}
                                                    </button>
                                                )}

                                                {opt.subOptions && (
                                                    <ul
                                                        id={subId}
                                                        className={`${styles.subList} ${subOpen ? styles.open : ''} ${index === filterConfig.length - 1 ? styles.opensLeft : ''}`}
                                                    >
                                                        {opt.subOptions.map(subOpt => (
                                                            <li key={subOpt} className={`${styles.subItem} ${picked === subOpt ? styles.selected : ''}`}>
                                                                <button
                                                                    type="button"
                                                                    className={`unstyled-button ${styles.optionButton}`}
                                                                    aria-pressed={picked === subOpt}
                                                                    onClick={() => {
                                                                        if (onSelect) onSelect(column.title, subOpt);
                                                                        setOpenSubMenu(null);
                                                                    }}
                                                                >
                                                                    {subOpt}
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default AdvancedFilters;
