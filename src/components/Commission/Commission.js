import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { SearchIcon, PlusIcon } from '../Icons/Icons';

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
    const { isLoggedIn, loading: authLoading } = useAuth();
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

    // The "+" menu on phones opens the request form here (state set by the navigation)
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (authLoading || !location.state?.openAddCommission) return;
        if (isLoggedIn) setIsAddModalOpen(true);
        navigate(location.pathname, { replace: true, state: null });
    }, [authLoading, location.state, location.pathname, isLoggedIn, navigate]);

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
            <div className={`container ${styles.contentWrapper}`}>
                <header className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.commissionTitle}>{t('nav.commission')}</h1>
                        <p className={styles.subtitle}>{t('commissions.subtitle')}</p>
                    </div>
                    <div className={styles.headerActions}>
                        <label className={`glass ${styles.searchBarContainer}`}>
                            <SearchIcon size={18} />
                            <input
                                type="search"
                                className={styles.searchInput}
                                aria-label={t('common.searchLabel')}
                                placeholder={t('commissions.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </label>
                        {isLoggedIn && (
                            <button type="button" className="btn btn-warm" onClick={handleOpenAddModal}>
                                <PlusIcon size={18} />
                                {t('commissions.add')}
                            </button>
                        )}
                    </div>
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