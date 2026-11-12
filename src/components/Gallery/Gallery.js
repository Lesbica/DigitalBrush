import React, { useState, useMemo, useEffect } from "react";
import styles from "./Gallery.module.css";
import { useNavigate } from "react-router-dom";
import ArtCard from '../ArtCard/ArtCard';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const placeholderFeaturedCards = [
    { id: 'card-back', imageUrl: '/images/card-center.webp', className: styles.cardBack, title: "DigitalBrush", likes: "253.5k" },
    { id: 'card-middle', imageUrl: '/images/card-right.webp', className: styles.cardMiddle, title: "DigitalBrush", likes: "253.5k" },
    { id: 'card-front', imageUrl: '/images/card-left.webp', className: styles.cardFront, title: "DigitalBrush", likes: "253.5k" }
];

const placeholderScatteredImages = [
    { id: 'scatter-1', imageUrl: '/images/image1.webp', className: styles.image1 },
    { id: 'scatter-2', imageUrl: '/images/image5.webp', className: styles.image2 },
    { id: 'scatter-3', imageUrl: '/images/image4.webp', className: styles.image3 },
    { id: 'scatter-4', imageUrl: '/images/image2.webp', className: styles.image4 },
    { id: 'scatter-5', imageUrl: '/images/image3.webp', className: styles.image5 }
];

const Gallery = () => {
    const { t } = useTranslation();
    const [paintings, setPaintings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    // Mapping helper from Shop.js
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

    // Fetch paintings using Shop logic
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        axios.get(`/paintings`)
            .then(res => {
                const payload = res.data;
                const list = Array.isArray(payload) ? payload : (payload.paintings || []);
                const mapped = list.map(p => {
                    const imageSrc = p.imageUrl || p.Image || p.image || p.image_url || normalizeImage(p.Image);
                    return {
                        id: p.Painting_ID || p.id || Math.random().toString(36).slice(2, 9),
                        title: p.Title || p.title || '',
                        artistName: p.author_name || p.creatorName || 'Artist',
                        artistId: p.Creator_ID || p.creator_id || p.artistId || null,
                        description: p.Description || p.description || '',
                        imageUrl: imageSrc || '/images/placeholder.svg',
                        likes: p.likes ?? p.Likes ?? 0,
                        price: p.Price ?? p.price ?? '',
                        style: p.Style ?? p.style ?? '',
                    };
                });
                if (mounted) {
                    setPaintings(mapped);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to fetch paintings:', err);
                if (mounted) {
                    setPaintings([]);
                    setLoading(false);
                }
            });
        return () => { mounted = false; };
    }, []);

    const gridImages = useMemo(() => {
        if (paintings.length === 0) return [];

        const ROWS = 4;
        const COLS = 8;
        const TOTAL_SLOTS = ROWS * COLS;

        let result = [...paintings];

        if (result.length < TOTAL_SLOTS) {
            while (result.length < TOTAL_SLOTS) {
                result = [...result, ...paintings];
            }
            result = result.sort(() => 0.5 - Math.random());
        }

        return result.slice(0, TOTAL_SLOTS);
    }, [paintings]);

    const slides = useMemo(() => {
        const itemsPerSlide = 16;
        const filtered = paintings.filter(card =>
            card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.style.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const newSlides = [];
        for (let i = 0; i < filtered.length; i += itemsPerSlide) {
            newSlides.push(filtered.slice(i, i + itemsPerSlide));
        }
        return newSlides;
    }, [searchQuery, paintings]);

    const handleNavigation = (path) => navigate(path);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setCurrentSlide(0);
    };

    return (
        <main id="mainContent" className={styles.container}>
            <div className={styles.gallery}>
                {/* --- TOP SCROLLING GRID (Real Images) --- */}
                <div className={styles.ScrollContainer}>
                    <div className={styles.scrollingGrid}>
                        <div className={styles.gridTrack}>
                            {[...Array(2)].map((_, trackIndex) => (
                                <div key={trackIndex} className={styles.imageGrid}>
                                    {gridImages.map((painting, i) => (
                                        <div
                                            key={`${trackIndex}-${painting.id}-${i}`}
                                            className={styles.gridImage}
                                            style={{ backgroundImage: `url(${painting.imageUrl})` }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={styles['main-image']} />
                </div>

                <div className={styles.textContentWrapper}>
                    {/* RESTORED: Artist registration section */}
                    <div className={styles.contentSection}>
                        <div className={styles.textContainer}>
                            <div className={styles.textHeader1}>{t('home.artistTitle1')} <br /> {t('home.artistTitle2')}</div>
                            <div className={styles.text1}>
                                {t('home.artistText')}
                            </div>
                            <button className={styles.button1} onClick={() => handleNavigation('/profile')}>{t('common.registration')}</button>
                        </div>
                        <div className={styles.imageCardsContainer}>
                            {placeholderFeaturedCards.map(card => (
                                <div key={card.id} className={card.className}>
                                    <div className={styles.cardContentWrapper}>
                                        <div className={styles.cardImage} style={{ backgroundImage: `url(${card.imageUrl})` }}></div>
                                        <div className={styles.cardInfo}>
                                            <p className={styles.cardTitle}>{card.title}</p>
                                            <span className={styles.cardLikes}>{card.likes}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RESTORED: Non-artist registration section */}
                    <div className={styles.contentSection}>
                        <div className={styles.ImagesContainer}>
                            {placeholderScatteredImages.map(image => (
                                <div
                                    key={image.id}
                                    className={image.className}
                                    style={{ backgroundImage: `url(${image.imageUrl})` }}
                                />
                            ))}
                        </div>
                        <div className={styles.textContainer}>
                            <div className={styles.textHeader1}>{t('home.buyerTitle1')} <br /> {t('home.buyerTitle2')}</div>
                            <div className={styles.text1}>
                                {t('home.buyerText')}
                            </div>
                            <button className={styles.button1} onClick={() => handleNavigation('/profile')}>{t('common.registration')}</button>
                        </div>
                    </div>
                </div>

                {/* --- TRENDS SECTION (Real Images) --- */}
                <div className={styles.trendsContentWrapper}>
                    <div className={styles.TrendsContainer}>
                        <div className={styles.TrendsHeader}>{t('home.trends')}</div>
                        <div className={styles.searchBarContainer}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder={t('home.searchPlaceholder')}
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                            <button className={styles.searchButton}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="black" strokeWidth="2" fill="none" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.noResults}>{t('home.loading')}</div>
                    ) : slides.length > 0 ? (
                        <div className={styles.artGridSection}>
                            <div className={styles.artGridCarouselWrapper}>
                                <div className={styles.artGridCarousel} style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                    {slides.map((slide, index) => (
                                        <div key={index} className={styles.artGridSlide}>
                                            {slide.map((card) => (
                                                <ArtCard key={card.id} art={card} />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                {slides.length > 1 && (
                                    <div className={styles.carouselDots}>
                                        {slides.map((_, i) => (
                                            <span 
                                                key={i} 
                                                className={`${styles.dot} ${currentSlide === i ? styles.active : ""}`} 
                                                onClick={() => setCurrentSlide(i)} 
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.noResults}>{t('home.noResults')}</div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default Gallery; 