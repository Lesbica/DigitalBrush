import React, { useMemo, useState, useEffect } from "react";
import styles from "./Shop.module.css";
import ArtCard from '../ArtCard/ArtCard';
import CategoryFilters from "../CategoryFilters/CategoryFilters";
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters';
import { usePagination } from '../hooks/Pagination/usePagination';
import Pagination from '../hooks/Pagination/Pagination';
import axios from 'axios';
import AddArtModal from "./AddArtModal/AddArtModal";
import logo from "../../assets/logo.svg";
import { CATEGORIES } from '../../constants/categories';
import { useAuth } from '../../context/AuthContext';


const shopFilterConfig = [
    { title: "SORT BY", options: [{ name: "NONE" }, { name: "RATING" }, { name: "LATEST" }, { name: "EXPENSIVE" }, { name: "CHEAP" }]},
    { title: "STYLE", options: [{ name: "NONE STYLE", subOptions: [
        "Retro Futurism", "Mid-Century", "Modern, Art Deco", "Bauhaus, Y2K", "Aesthetic", "Memphis Style",
        "Grunge", "Psychedelic Art", "Surrealism, Neo-Psychedelia, Op Art", "Dreamcore", "Weirdcore",
        "Hyperrealism", "Social Realism", "Digital Realism", "Cinematic Realism", "Cyberpunk",
        "Synthwave", "Vaporwave", "Minimalism", "Brutalism", "Postmodern", "Collage."
    ] }]}
];

const categories = CATEGORIES;

const Shop = () => {
    const [cards, setCards] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { isArtist } = useAuth();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const normalizeImage = (img) => {
        if (!img) return null;
        if (typeof img === 'string') {
            if (img.startsWith('data:') || img.startsWith('http')) return img;
            const cleaned = img.replace(/[\r\n\s]+/g, '');
            if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length > 50) return `data:image/png;base64,${cleaned}`;
            return img;
        }
        if (typeof img === 'object' && Array.isArray(img.data)) {
            try {
                const bytes = Uint8Array.from(img.data);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                return `data:image/png;base64,${btoa(binary)}`;
            } catch (e) { return null; }
        }
        return null;
    };

    // fetch all paintings
    useEffect(() => {
    let mounted = true;
        setLoading(true);
    axios.get(`/paintings`)
        .then(res => {
            const payload = res.data;
            const list = Array.isArray(payload) ? payload : (payload.paintings || []);
            const mapped = list.map(p => {
                const imageSrc = p.imageUrl || p.Image || p.image || p.image_url || normalizeImage(p.Image);
                const images = [];
                if (p.images && Array.isArray(p.images)) {
                    p.images.forEach(it => {
                        const src = normalizeImage(it) || it;
                        if (src) images.push(src);
                    });
                } else if (imageSrc) {
                    images.push(imageSrc);
                }
                return {
                    id: p.Painting_ID || p.id || Math.random().toString(36).slice(2,9),
                    title: p.Title || p.title || '',
                    artistName: p.author_name || p.creatorName || 'Artist',
                    artistId: p.Creator_ID || p.creator_id || p.artistId || null,
                    description: p.Description || p.description || '',
                    imageUrl: imageSrc || '/images/placeholder.svg',
                    images,
                    // Лайки ТІЛЬКИ з БД, без рандому
                    likes: p.likes ?? p.Likes ?? 0,
                    // Ціна ТІЛЬКИ з БД, без рандому
                    price: p.Price ?? p.price ?? '',
                    // Додаткові поля не вигадуємо — віддамо як є або порожнє
                    category: p.Category ?? p.category ?? '',
                    style: p.Style ?? p.style ?? '',
                    fileFormat: p.Format ?? p.format ?? '',
                    size: p.Size ?? p.size ?? ''
                };
            });
            if (mounted) setCards(mapped);
        })
        .catch(err => {
            console.error('Failed to fetch paintings:', err);
            if (mounted) setCards([]);
        })
        .finally(() => {
            if (mounted) setLoading(false);
        });
    return () => { mounted = false; };
}, []);



    const filteredCards = useMemo(() => {
        let filtered = cards;
        if (activeCategory) filtered = filtered.filter(c => (c.category || '').toUpperCase() === activeCategory.toUpperCase());
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                (c.title || '').toLowerCase().includes(q) ||
                (c.artistName || '').toLowerCase().includes(q) ||
                (c.style || '').toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [cards, activeCategory, searchQuery]);

    const itemsPerPage = 96;
    const { currentPage, setCurrentPage, totalPages, displayedData: displayedCards } = usePagination(filteredCards, itemsPerPage);

    const handleCategoryClick = (category) => setActiveCategory(activeCategory === category ? null : category);

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
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategoryClick={handleCategoryClick}
                    />

                    <div className={styles.filtersContainer}>
                        <AdvancedFilters filterConfig={shopFilterConfig} />
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingSpinnerContainer}>
                        <img src={logo} alt="Loading" className={styles.loadingLogo} />
                    </div>
                ) : (
                    displayedCards.length ? (
                    <>
                        <div className={styles.artGridFull}>
                            {displayedCards.map(card =>
                                <ArtCard key={card.id} art={card} />
                            )}
                        </div>
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                    </>
                ) : (
                    <div className={styles.noResults}>There are no paintings available at the moment</div>
                )
                )}
            </div>

            {isAddModalOpen && <AddArtModal onClose={() => setIsAddModalOpen(false)} categories={categories} filterConfig={shopFilterConfig} />}
        </div>
    );
};

export default Shop;
