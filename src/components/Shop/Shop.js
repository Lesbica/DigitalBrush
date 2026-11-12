import { useState } from "react";
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
    const { isArtist } = useAuth();
    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [advanced, setAdvanced] = useState({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const search = useDebouncedValue(searchQuery.trim(), 300);

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
            <div className={styles.contentWrapper}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.shopTitle}>SHOP</h1>
                        <div className={styles.searchBarContainer}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Title of the art..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button className={styles.searchButton}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="black" strokeWidth="2" fill="none" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {isArtist && (
                        <button className={styles.addImageButton} onClick={() => setIsAddModalOpen(true)}>
                            <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.4158 0C5.56994 0 0 5.56994 0 12.4158C0 19.2617 5.56994 24.8317 12.4158 24.8317C19.2617 24.8317 24.8317 19.2617 24.8317 12.4158C24.8317 5.56994 19.2617 0 12.4158 0ZM12.4158 1.91013C18.2293 1.91013 22.9216 6.60236 22.9216 12.4158C22.9216 18.2293 18.2293 22.9216 12.4158 22.9216C6.60236 22.9216 1.91013 18.2293 1.91013 12.4158C1.91013 6.60236 6.60236 1.91013 12.4158 1.91013ZM11.4608 6.68545V11.4608H6.68545V13.3709H11.4608V18.1462H13.3709V13.3709H18.1462V11.4608H13.3709V6.68545H11.4608Z" fill="white"/>
                            </svg>
                            ADD IMAGE
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
                            filterConfig={SHOP_FILTERS}
                            selected={advanced}
                            onSelect={(column, value) => setAdvanced(prev => toggleFilter(prev, column, value))}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingSpinnerContainer}>
                        <img src={logo} alt="Loading" className={styles.loadingLogo} />
                    </div>
                ) : cards.length ? (
                    <>
                        <div className={styles.artGridFull}>
                            {cards.map(card => <ArtCard key={card.id} art={card} />)}
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
                    </>
                ) : (
                    <div className={styles.noResults}>
                        {error ? 'Could not load the paintings. Please try again later.' : 'No paintings match your search'}
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
