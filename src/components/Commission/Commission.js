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
import { formatPrice, formatDate } from '../../i18n/format';
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
    customerName: c.customer_name || '',
    deadline: c.Deadline || null,
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
                        <h1 className={styles.commissionTitle}>
                            {t('commissions.titleStart')}<span className="gradient-text">{t('commissions.titleAccent')}</span>
                        </h1>
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

                <div className={styles.layout}>
                    <section className={styles.board} aria-label={t('commissions.listLabel')}>
                        {loading ? (
                            <div className={styles.loadingSpinnerContainer}>
                                <img src={logo} alt={t('common.loading')} className={styles.loadingLogo} />
                            </div>
                        ) : commissions.length > 0 ? (
                            <>
                                <ul className={styles.requestList}>
                                    {commissions.map(commission => (
                                        <li key={commission.id}>
                                            <article className={`glass ${styles.requestCard}`} aria-labelledby={`request-${commission.id}`}>
                                                <div className={styles.requestMain}>
                                                    {(commission.category || commission.style) && (
                                                        <div className={styles.tags}>
                                                            {commission.category && <span className={styles.tag}>{t(`labels.${commission.category}`, { defaultValue: commission.category })}</span>}
                                                            {commission.style && <span className={styles.tag}>{commission.style}</span>}
                                                        </div>
                                                    )}
                                                    <h3 id={`request-${commission.id}`} className={styles.cardTitle}>{commission.title}</h3>
                                                    <p className={styles.cardDescription}>{commission.description}</p>
                                                    {commission.imageUrl && (
                                                        <img
                                                            src={commission.imageUrl}
                                                            alt={t('commissions.referenceAlt', { title: commission.title })}
                                                            className={styles.thumb}
                                                            loading="lazy"
                                                            decoding="async"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                    <p className={styles.meta}>
                                                        {commission.customerName && <span>{t('commissions.postedBy', { name: commission.customerName })}</span>}
                                                        {commission.deadline && <span>{t('commissions.deadline', { date: formatDate(commission.deadline) })}</span>}
                                                        {commission.size && <span>{commission.size}</span>}
                                                    </p>
                                                </div>
                                                <div className={styles.requestSide}>
                                                    <span className={styles.budgetLabel}>{t('commissions.budget')}</span>
                                                    <strong className={styles.cardPrice}>{formatPrice(commission.price)}</strong>
                                                    <button type="button" className={`btn btn-lime ${styles.takeButton}`} onClick={() => handleOpenModal(commission)}>
                                                        {t('commissions.take')}
                                                    </button>
                                                </div>
                                            </article>
                                        </li>
                                    ))}
                                </ul>

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
                        )}
                    </section>

                    <aside className={`glass ${styles.postPanel}`} aria-labelledby="post-request-title">
                        <h2 id="post-request-title">{t('commissions.postTitle')}</h2>
                        <p>{t('commissions.postText')}</p>
                        <ol className={styles.postSteps}>
                            <li>{t('commissions.postStep1')}</li>
                            <li>{t('commissions.postStep2')}</li>
                            <li>{t('commissions.postStep3')}</li>
                        </ol>
                        {isLoggedIn ? (
                            <button type="button" className="btn btn-lime" onClick={handleOpenAddModal}>{t('commissions.add')}</button>
                        ) : (
                            <button type="button" className="btn btn-lime" onClick={() => navigate('/profile')}>{t('commissions.signInToPost')}</button>
                        )}
                    </aside>
                </div>
            </div>

            {isLoggedIn && (
                <button type="button" className={styles.fab} onClick={handleOpenAddModal} aria-label={t('commissions.add')}>
                    <PlusIcon size={18} /> <span aria-hidden="true">{t('commissions.postShort')}</span>
                </button>
            )}

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