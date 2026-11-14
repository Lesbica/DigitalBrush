import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import styles from "./Shop.module.css";
import ArtCard from '../ArtCard/ArtCard';
import Pagination from '../hooks/Pagination/Pagination';
import useServerList, { useDebouncedValue } from '../hooks/useServerList';
import AddArtModal from "./AddArtModal/AddArtModal";
import { FilterPanel, FilterSheet } from './ShopFilters';
import logo from "../../assets/logo.svg";
import { CATEGORIES } from '../../constants/categories';
import { SHOP_FILTERS, SORT_PARAMS } from '../../constants/filters';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { SearchIcon, PlusIcon, FilterIcon } from '../Icons/Icons';

const PAGE_SIZE = 48;
const SORTS = ['LATEST', 'POPULAR', 'EXPENSIVE', 'CHEAP'];
const NO_FILTERS = { category: null, style: null, maxPrice: null };

// API painting -> card
const toCard = (p) => ({
    id: p.id ?? p.Painting_ID,
    title: p.title ?? p.Title ?? '',
    artistName: p.author_name || 'Artist',
    artistId: p.Creator_ID ?? null,
    description: p.description ?? p.Description ?? '',
    imageUrl: p.image || '/images/placeholder.svg',
    likes: p.likes ?? p.Likes ?? 0,
    price: p.price ?? p.Price ?? '',
    category: p.category ?? p.Category ?? '',
    style: p.style ?? p.Style ?? '',
});

const Shop = () => {
    const { t } = useTranslation();
    const { isArtist, loading: authLoading } = useAuth();
    const [searchParams] = useSearchParams();
    // ?q= and ?style= come from the home page links
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
    const [filters, setFilters] = useState(() => ({ ...NO_FILTERS, style: searchParams.get('style') || null }));
    const [sort, setSort] = useState('LATEST');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const search = useDebouncedValue(searchQuery.trim(), 300);
    const location = useLocation();
    const navigate = useNavigate();

    // The "+" menu on phones opens the upload form here (state set by the navigation).
    // Waits for the session, so the role is known before deciding.
    useEffect(() => {
        if (authLoading || !location.state?.openAddArt) return;
        if (isArtist) setIsAddModalOpen(true);
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }, [authLoading, location.state, location.pathname, location.search, isArtist, navigate]);

    const { items: cards, total, totalPages, loading, error, page, setPage, reload } = useServerList('/paintings', {
        params: { category: filters.category, style: filters.style, maxPrice: filters.maxPrice, q: search, sort: SORT_PARAMS[sort] },
        limit: PAGE_SIZE,
        listKey: 'paintings',
        mapItem: toCard,
    });

    const changeFilters = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
    const clearFilters = () => setFilters(NO_FILTERS);
    const activeCount = Object.values(filters).filter((v) => v != null).length;
    const handlePageChange = (next) => {
        setPage(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className={styles.shopPage}>
            <div className={`container ${styles.contentWrapper}`}>
                <header className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.shopTitle}>
                            {t('shop.titleStart')}<span className="gradient-text">{t('shop.titleAccent')}</span>
                        </h1>
                        <p className={styles.subtitle}>{t('shop.subtitle')}</p>
                    </div>
                    <div className={styles.headerActions}>
                        <label className={`glass ${styles.searchBarContainer}`}>
                            <SearchIcon size={18} />
                            <input
                                type="search"
                                className={styles.searchInput}
                                aria-label={t('common.searchLabel')}
                                placeholder={t('shop.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </label>
                        {isArtist && (
                            <button type="button" className="btn btn-lime" onClick={() => setIsAddModalOpen(true)}>
                                <PlusIcon size={18} />
                                {t('shop.addImage')}
                            </button>
                        )}
                    </div>
                </header>

                <div className={styles.layout}>
                    <aside className={`glass ${styles.sidebar}`} aria-label={t('shop.filters.title')}>
                        <FilterPanel value={filters} onChange={changeFilters} onClear={clearFilters} idPrefix="side" />
                    </aside>

                    <section className={styles.results} aria-label={t('shop.resultsLabel')}>
                        <div className={styles.toolbar}>
                            <p className={styles.count} aria-live="polite">{loading ? '' : t('shop.count', { count: total })}</p>
                            <div className={styles.toolbarActions}>
                                <button type="button" className={`glass ${styles.filterButton}`} onClick={() => setSheetOpen(true)}
                                        aria-haspopup="dialog">
                                    <FilterIcon size={18} />
                                    {t('shop.filters.title')}
                                    {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
                                </button>
                                <label className={`glass ${styles.sortLabel}`}>
                                    <span className="sr-only">{t('shop.sortLabel')}</span>
                                    <select className={styles.sort} value={sort} onChange={(e) => setSort(e.target.value)}>
                                        {SORTS.map((s) => <option key={s} value={s}>{t(`shop.sort.${s}`)}</option>)}
                                    </select>
                                </label>
                            </div>
                        </div>

                        {loading ? (
                            <div className={styles.loadingSpinnerContainer}>
                                <img src={logo} alt={t('common.loading')} className={styles.loadingLogo} />
                            </div>
                        ) : cards.length ? (
                            <>
                                <div className={styles.masonry}>
                                    {cards.map(card => <ArtCard key={card.id} art={card} />)}
                                </div>
                                <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
                            </>
                        ) : (
                            <div className={styles.noResults}>
                                {error ? t('shop.loadError') : t('shop.empty')}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {sheetOpen && (
                <FilterSheet onClose={() => setSheetOpen(false)} total={total}>
                    <FilterPanel value={filters} onChange={changeFilters} onClear={clearFilters} idPrefix="sheet" />
                </FilterSheet>
            )}

            {isAddModalOpen && (
                <AddArtModal
                    onClose={() => { setIsAddModalOpen(false); reload(); }}
                    categories={CATEGORIES}
                    filterConfig={SHOP_FILTERS}
                />
            )}
        </div>
    );
};

export default Shop;
