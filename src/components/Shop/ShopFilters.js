import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ShopFilters.module.css';
import useDialog from '../Dialog/useDialog';
import { CATEGORIES } from '../../constants/categories';
import { STYLES } from '../../constants/filters';
import { formatPrice } from '../../i18n/format';
import { CloseIcon } from '../Icons/Icons';

export const PRICE_STEP = 250;
export const PRICE_MAX = 5000;

// Category, style and price filters of the shop: a sidebar on desktop, a bottom sheet on phones.
// value = { category, style, maxPrice }; onChange(patch)
export function FilterPanel({ value, onChange, onClear, idPrefix = 'f' }) {
    const { t } = useTranslation();
    const anyPrice = value.maxPrice == null;
    return (
        <div className={styles.panel}>
            <fieldset className={styles.group}>
                <legend>{t('shop.filters.category')}</legend>
                <div className={styles.chips}>
                    {CATEGORIES.map((c) => (
                        <button key={c} type="button" className={styles.chip} aria-pressed={value.category === c}
                                onClick={() => onChange({ category: value.category === c ? null : c })}>
                            {t(`labels.${c}`, { defaultValue: c })}
                        </button>
                    ))}
                </div>
            </fieldset>

            <div className={styles.group}>
                <label className={styles.legend} htmlFor={`${idPrefix}-style`}>{t('shop.filters.style')}</label>
                <select id={`${idPrefix}-style`} className={styles.select} value={value.style || ''}
                        onChange={(e) => onChange({ style: e.target.value || null })}>
                    <option value="">{t('shop.filters.anyStyle')}</option>
                    {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className={styles.group}>
                <label className={styles.legend} htmlFor={`${idPrefix}-price`}>{t('shop.filters.maxPrice')}</label>
                <input id={`${idPrefix}-price`} type="range" className={styles.range} min={PRICE_STEP} max={PRICE_MAX} step={PRICE_STEP}
                       value={anyPrice ? PRICE_MAX : value.maxPrice}
                       aria-valuetext={anyPrice ? t('shop.filters.anyPrice') : formatPrice(value.maxPrice)}
                       onChange={(e) => {
                           const v = Number(e.target.value);
                           onChange({ maxPrice: v >= PRICE_MAX ? null : v });
                       }} />
                <div className={styles.rangeLabels}>
                    <span>{formatPrice(PRICE_STEP)}</span>
                    <strong>{anyPrice ? t('shop.filters.anyPrice') : t('shop.filters.upTo', { price: formatPrice(value.maxPrice) })}</strong>
                </div>
            </div>

            <button type="button" className={`btn btn-ghost ${styles.clear}`} onClick={onClear}>{t('shop.filters.clear')}</button>
        </div>
    );
}

export function FilterSheet({ onClose, total, children }) {
    const { t } = useTranslation();
    const ref = useRef(null);
    useDialog(ref, onClose);
    return (
        <div className={styles.sheetLayer}>
            <div className={styles.sheetBackdrop} onClick={onClose} aria-hidden="true" />
            <div ref={ref} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="shop-filters-title">
                <span className={styles.grabber} aria-hidden="true" />
                <div className={styles.sheetHead}>
                    <h2 id="shop-filters-title">{t('shop.filters.title')}</h2>
                    <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}><CloseIcon size={18} /></button>
                </div>
                <div className={styles.sheetBody}>{children}</div>
                <button type="button" className="btn btn-lime" onClick={onClose}>{t('shop.filters.show', { count: total })}</button>
            </div>
        </div>
    );
}
