import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./Shop.module.css";
import ArtCard from '../ArtCard/ArtCard';
import CategoryFilters from "../CategoryFilters/CategoryFilters";
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters';
import Pagination from '../hooks/Pagination/Pagination';
import useServerList, { useDebouncedValue } from '../hooks/useServerList';
import AddArtModal from "./AddArtModal/AddArtModal";
import logo from "../../assets/logo.svg";
import { CATEGORIES } from '../../constants/categories';
import { SHOP_FILTERS, filtersToParams, toggleFilter } from '../../constants/filters';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { SearchIcon, PlusIcon } from '../Icons/Icons';

const PAGE_SIZE = 48;

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
    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [advanced, setAdvanced] = useState({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const search = useDebouncedValue(searchQuery.trim(), 300);
    const location = useLocation();
    const navigate = useNavigate();

    // The "+" menu on phones opens the upload form here (state set by the navigation).
    // Waits for the session, so the role is known before deciding.
    useEffect(() => {
        if (authLoading || !location.state?.openAddArt) return;
        if (isArtist) setIsAddModalOpen(true);
        navigate(location.pathname, { replace: true, state: null });
    }, [authLoading, location.state, location.pathname, isArtist, navigate]);

    const { items: cards, totalPages, loading, error, page, setPage, reload } = useServerList('/paintings', {
        params: { category: activeCategory, q: search, ...filtersToParams(advanced) },
        limit: PAGE_SIZE,
        listKey: 'paintings',
        mapItem: toCard,
    });

    const handleCategoryClick = (category) => setActiveCategory(activeCategory === category ? null : category);
    const handlePageChange = (next) => {
        setPage(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className={styles.shopPage}>
            <div className={`container ${styles.contentWrapper}`}>
                <header className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.shopTitle}>{t('nav.shop')}</h1>
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

                <div className={styles.filtersWrapper}>
                    <CategoryFilters
                        categories={CATEGORIES}
                        activeCategory={activeCategory}
                        onCategoryClick={handleCategoryClick}
                    />

                    <div className={styles.filtersContainer}>
                        <AdvancedFilters
                            filterConfig={SHOP_FILTERS}
                            selected={advanced}
                            onSelect={(column, value) => setAdvanced(prev => toggleFilter(prev, column, value))}
                        />
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
            </div>

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
