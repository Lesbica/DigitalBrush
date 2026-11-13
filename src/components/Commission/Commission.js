import { useEffect, useState } from 'react';
import styles from './Commission.module.css';
import CategoryFilters from "../CategoryFilters/CategoryFilters";
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters';
import Pagination from '../hooks/Pagination/Pagination';
import useServerList, { useDebouncedValue } from '../hooks/useServerList';
import CommissionModalDetails from './CommissionModals/CommissionModalDetails';
import AddCommissionModal from './CommissionModals/AddCommissionModal';
import logo from '../../assets/logo.svg';
import { CATEGORIES } from '../../constants/categories';
import { COMMISSION_FILTERS, filtersToParams, toggleFilter } from '../../constants/filters';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../i18n/format';

const PAGE_SIZE = 48;

// API commission -> card
const toCard = (c) => ({
    id: c.Commission_ID ?? c.id,
    title: c.Title || '',
    description: c.Description || '',
    price: c.Price ?? 0,
    category: c.Category || '',
    style: c.Style || '',
    fileFormat: c.Format || '',
    size: c.Size || '',
    imageUrl: c.imageUrl || null,
    imageSrc: c.imageUrl || '/images/placeholder.svg',
    about: c.Description || '',
});

function Commission() {
    const { t } = useTranslation();
    const { isLoggedIn } = useAuth();
    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [advanced, setAdvanced] = useState({});
    const [selectedCommission, setSelectedCommission] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const search = useDebouncedValue(searchQuery.trim(), 300);

    const { items: commissions, totalPages, loading, error, page, setPage, reload } = useServerList('/commissions/public', {
        params: { category: activeCategory, q: search, ...filtersToParams(advanced) },
        limit: PAGE_SIZE,
        listKey: 'commissions',
        mapItem: toCard,
    });

    useEffect(() => {
        if (!isModalOpen && !isAddModalOpen) return undefined;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isModalOpen, isAddModalOpen]);

    const handleCategoryClick = (category) => setActiveCategory(activeCategory === category ? null : category);
    const handlePageChange = (next) => {
        setPage(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleOpenModal = (commission) => {
        setSelectedCommission(commission);
        setIsModalOpen(true);
    };
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCommission(null);
        reload();
    };
    const handleOpenAddModal = () => setIsAddModalOpen(true);
    const handleCloseAddModal = () => {
        setIsAddModalOpen(false);
        reload();
    };

    return (
        <div className={styles.commissionPage}>
            <div className={styles.contentWrapper}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.commissionTitle}>{t('nav.commission')}</h1>
                        <div className={styles.searchBarContainer}>
                            <input
                                type="search"
                                className={styles.searchInput}
                                aria-label={t('common.searchLabel')}
                                placeholder={t('commissions.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button type="button" className={styles.searchButton} tabIndex={-1} aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="black" strokeWidth="2" fill="none" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {isLoggedIn && (
                        <button className={styles.addCommissionButton} onClick={handleOpenAddModal}>
                            <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.4158 0C5.56994 0 0 5.56994 0 12.4158C0 19.2617 5.56994 24.8317 12.4158 24.8317C19.2617 24.8317 24.8317 19.2617 24.8317 12.4158C24.8317 5.56994 19.2617 0 12.4158 0ZM12.4158 1.91013C18.2293 1.91013 22.9216 6.60236 22.9216 12.4158C22.9216 18.2293 18.2293 22.9216 12.4158 22.9216C6.60236 22.9216 1.91013 18.2293 1.91013 12.4158C1.91013 6.60236 6.60236 1.91013 12.4158 1.91013ZM11.4608 6.68545V11.4608H6.68545V13.3709H11.4608V18.1462H13.3709V13.3709H18.1462V11.4608H13.3709V6.68545H11.4608Z" fill="white"/>
                            </svg>
                            {t('commissions.add')}
                        </button>
                    )}
                </header>

                <div className={styles.filtersWrapper}>
                    <CategoryFilters
                        categories={CATEGORIES}
                        activeCategory={activeCategory}
                        onCategoryClick={handleCategoryClick}
                    />

                    <div className={styles.filtersContainer}>
                        <AdvancedFilters
                            filterConfig={COMMISSION_FILTERS}
                            selected={advanced}
                            onSelect={(column, value) => setAdvanced(prev => toggleFilter(prev, column, value))}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingSpinnerContainer}>
                        <img src={logo} alt={t('common.loading')} className={styles.loadingLogo} />
                    </div>
                ) : (
                    commissions.length > 0 ? (
                        <>
                            <div className={styles.commissionGrid}>
                                {commissions.map(commission => (
                                    <div key={commission.id} className={styles.commissionCard}>
                                        <div className={styles.imagePriceWrapper}>
                                            <div className={styles.imageWrapper}>
                                                <img
                                                    src={commission.imageSrc || "/images/placeholder.svg"}
                                                    alt={commission.title || "Commission"}
                                                    className={styles.cardImage}
                                                    loading="lazy"
                                                    decoding="async"
                                                    onError={(e) => { if (!e.currentTarget.src.endsWith('/images/placeholder.svg')) e.currentTarget.src = '/images/placeholder.svg'; }}
                                                />
                                            </div>
                                            <div className={styles.priceOverlay}>
                                                <span className={styles.cardPrice}>{formatPrice(commission.price)}</span>
                                            </div>
                                        </div>
                                        <div className={styles.cardContent}>
                                            <div>
                                                <h3 className={styles.cardTitle}>{commission.title}</h3>
                                                <p className={styles.cardDescription}>{commission.description}</p>
                                            </div>
                                            <button
                                                className={styles.takeButton}
                                                onClick={() => handleOpenModal(commission)}
                                            >
                                                {t('commissions.take')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                        </>
                    ) : (
                        <div className={styles.noResults}>
                            {error ? t('commissions.loadError') : t('commissions.empty')}
                        </div>
                    )
                )}
            </div>

            {isAddModalOpen && (
                <AddCommissionModal onClose={handleCloseAddModal} />
            )}

            {isModalOpen && (
                <CommissionModalDetails
                    commission={selectedCommission}
                    onClose={handleCloseModal}
                    variant="detailed"
                />
            )}
        </div>
    );
}

export default Commission;