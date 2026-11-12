import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import styles from './AuthorPage.module.css';
import ArtCard from '../ArtCard/ArtCard';
import CategoryFilters from '../CategoryFilters/CategoryFilters';
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters'; // Імпорт
import Pagination from '../hooks/Pagination/Pagination';
import { usePagination } from '../hooks/Pagination/usePagination';
import infoIcon from '../../assets/infoIcon.svg'
import globeIcon from '../../assets/icons/globeIcon.svg'
import heartIcon from '../../assets/icons/heartIcon.svg'
import AddCommissionModal from '../Commission/CommissionModals/AddCommissionModal';
import { CATEGORIES } from '../../constants/categories';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';

// Конфіг
const additionalFilterConfig = [
    {
        title: "SORT BY",
        options: [
            { name: "LATEST" },
            { name: "POPULAR" },
            { name: "OLDEST" },
            { name: "PRICE: LOW TO HIGH" },
            { name: "PRICE: HIGH TO LOW" }
        ]
    }
];

const categories = CATEGORIES;

const AuthorPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();

    const [artist, setArtist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState(null);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [reviews, setReviews] = useState({ summary: { average: null, count: 0 }, reviews: [] });

    useEffect(() => {
        const fetchArtist = async () => {
            try {
                const res = await axios.get(`/artists/artist/${id}`);
                setArtist(res.data);
            } catch (error) {
                console.error("Error loading artist:", error);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchArtist();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        axios.get(`/reviews/artist/${id}`, { params: { limit: 20 } })
            .then(res => setReviews({ summary: res.data.summary, reviews: res.data.reviews || [] }))
            .catch(err => console.error("Error loading reviews:", err));
    }, [id]);

    const handleCommissionClick = () => {
        setIsCommissionModalOpen(true);
    };

    const handleCategoryClick = (category) => {
        setActiveCategory(prev => prev === category ? null : category);
    };

    const filteredPaintings = useMemo(() => {
        if (!artist || !artist.paintings) return [];
        let result = artist.paintings;
        if (activeCategory) {
            result = result.filter(p => (p.Style || '').toUpperCase().includes(activeCategory));
        }
        return result;
    }, [artist, activeCategory]);

    const itemsPerPage = 24;
    const {
        currentPage,
        setCurrentPage,
        totalPages,
        displayedData
    } = usePagination(filteredPaintings, itemsPerPage);

    useEffect(() => {
        setCurrentPage(0);
    }, [activeCategory, setCurrentPage]);

    if (loading) return <div className={styles.loading}>Loading...</div>;
    if (!artist) return <div className={styles.loading}>Artist not found</div>;

    const artistName = artist.Name || artist.name;
    const artistImage = artist.imageBase64 || artist.avatar || artist.image || '/images/profileImg.jpg';

    // Resolve styles from DB: creators.styles may be JSON string or array; fallback to single Style or from artworks
    const resolveStyles = (a) => {
        let raw = a.styles !== undefined ? a.styles : (a.Styles !== undefined ? a.Styles : undefined);
        if (Array.isArray(raw)) return raw.filter(Boolean).map(s => String(s));
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(Boolean).map(s => String(s));
            } catch (e) {
                const split = raw.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
                if (split.length) return split;
            }
        }
        const single = a.Style || a.style;
        if (single) return [String(single)];
        if (Array.isArray(a.paintings)) {
            const set = new Set();
            a.paintings.forEach(p => {
                const ps = p.Style || p.style;
                if (ps) set.add(String(ps));
            });
            if (set.size) return Array.from(set);
        }
        return [];
    };

    // Languages from creators table: may be array or JSON string; no longer using Country
    const resolveLanguages = (a) => {
        let raw = a.languages !== undefined ? a.languages : (a.Languages !== undefined ? a.Languages : undefined);
        if (Array.isArray(raw)) return raw.filter(Boolean).map(s => String(s));
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.filter(Boolean).map(s => String(s));
            } catch (e) {
                const split = raw.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
                if (split.length) return split;
            }
        }
        return [];
    };

    const stylesArr = resolveStyles(artist);
    const artistStyle = stylesArr.length ? stylesArr.join(' / ') : 'No style provided yet.';

    const languagesArr = resolveLanguages(artist);
    const artistLanguages = languagesArr.length ? languagesArr.join(' / ') : 'No languages provided yet.';
    const artistBio = artist.bio || artist.Bio || artist.Other_Details || artist.Description || "No bio provided yet.";
    const likesFromPaintings = Array.isArray(artist.paintings) ? artist.paintings.reduce((sum, p) => sum + (Number(p.likes) || 0), 0) : 0;
    const totalLikes = Number(artist.likesCount || artist.likes || artist.Likes || likesFromPaintings) || 0;

    return (
        <div className={styles.pageContainer}>
            <div className={styles.contentWrapper}>

                {/* --- ЛІВА ЧАСТИНА (САЙДБАР) --- */}
                <aside className={styles.sidebar}>
                    <div className={styles.avatarContainer}>
                        <img src={artistImage} alt={artistName} className={styles.avatar} />
                    </div>

                    <div>
                        <h1 className={styles.artistName}>
                            {artistName}
                            <span className={styles.status}>({t(`availability.${['busy', 'vacation'].includes(artist.availability) ? artist.availability : 'open'}`)})</span>
                        </h1>
                    </div>

                    <div className={styles.metaInfo}>
                        <div className={styles.metaRow}>
                            <img src={infoIcon} alt={t('artists.style')}/>
                            <span>{artistStyle}</span>
                        </div>
                        <div className={styles.metaRow}>
                            <img src={globeIcon} alt={t('author.languages')}/>
                            <span>{artistLanguages}</span>
                        </div>
                        <div className={styles.metaRow}>
                            <span className={styles.ratingStar}>★</span>
                            <span>
                                {reviews.summary.count > 0
                                    ? `${Number(reviews.summary.average).toFixed(1)} (${t('author.reviewCount', { count: reviews.summary.count })})`
                                    : t('author.noReviews')}
                            </span>
                        </div>
                        <div className={styles.metaRow}>
                            <img src={heartIcon} alt={t('artists.likes')}/>
                            <span>{totalLikes > 1000 ? (totalLikes/1000).toFixed(1) + 'k' : totalLikes}</span>
                        </div>
                    </div>

                    <p className={styles.bio}>
                        {artistBio}
                    </p>

                    <button className={styles.commissionBtn} onClick={handleCommissionClick}>
                        {t('author.commission')}
                    </button>
                </aside>

                {/* --- ПРАВА ЧАСТИНА (ГАЛЕРЕЯ) --- */}
                <main className={styles.gallerySection}>

                    {/* Верхні контроли */}
                    <div className={styles.topControls}>
                        <CategoryFilters
                            categories={categories}
                            activeCategory={activeCategory}
                            onCategoryClick={handleCategoryClick}
                        />

                        {/* Тепер AdvancedFilters самостійний */}
                        <AdvancedFilters filterConfig={additionalFilterConfig} />
                    </div>

                    {/* Сітка робіт */}
                    <div className={styles.artGrid}>
                        {displayedData.length > 0 ? (
                            displayedData.map(p => (
                                <ArtCard
                                    key={p.Painting_ID || p.id}
                                    art={{
                                        id: p.Painting_ID || p.id,
                                        title: p.Title || p.title,
                                        imageUrl: p.image_url || p.imageBase64 || p.Image,
                                        price: p.Price || p.price,
                                        artistName: artistName,
                                        likes: (p.likes ?? p.Likes ?? 0),
                                        artistId: artist.Creator_ID || artist.Creator_Id || artist.CreatorId || artist.id || id,
                                        category: p.Category,
                                        style: p.Style
                                    }}
                                />
                            ))
                        ) : (
                            <div className={styles.noArt}>{t('artists.noArtworks')}</div>
                        )}
                    </div>

                    {/* Пагінація */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />

                    <section className={styles.reviews}>
                        <h2 className={styles.reviewsTitle}>{t('author.reviews')}</h2>
                        {reviews.reviews.length === 0 ? (
                            <div className={styles.noArt}>{t('author.noReviews')}</div>
                        ) : reviews.reviews.map(r => (
                            <div key={r.id} className={styles.reviewItem}>
                                <div className={styles.reviewHeader}>
                                    <img src={r.customer.avatar} alt="" className={styles.reviewAvatar} />
                                    <span className={styles.reviewAuthor}>{r.customer.name}</span>
                                    <span className={styles.reviewStars} aria-label={`${r.rating} of 5`}>
                                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                                    </span>
                                    <span className={styles.reviewDate}>{formatDate(r.createdAt)}</span>
                                </div>
                                {r.text && <p className={styles.reviewText}>{r.text}</p>}
                            </div>
                        ))}
                    </section>
                </main>
            </div>

            {isCommissionModalOpen && (
                <AddCommissionModal
                    onClose={() => setIsCommissionModalOpen(false)}
                    targetCreatorId={artist.Creator_ID || artist.id}
                />
            )}

        </div>
    );
};

export default AuthorPage;