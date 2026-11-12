import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';
import styles from "./ArtistsPage.module.css";
import ArtCard from '../ArtCard/ArtCard';
import CategoryFilters from "../CategoryFilters/CategoryFilters";
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters';
import { usePagination } from '../hooks/Pagination/usePagination';
import Pagination from '../hooks/Pagination/Pagination';
import leftArrow from '../../assets/leftArrow.svg';
import rightArrow from '../../assets/rightArrow.svg';
import axios from 'axios';
import URL from "../../URL";

const categories = [
    "2D AVATARS", "3D MODELS", "BOOKS", "ANIME", "ICONS", "GAMES",
    "MOCKUPS", "UI/UX", "ADVERTISING", "BRENDING", "POSTER",
    "ARCHITECTURE", "FASHION", "SKETCH", "PHOTOGRAPHY"
];

const artistFilterConfig = [
    { title: "SORT BY", options: [
            { name: "NONE" }, { name: "NAME (A-Z)" }, { name: "NAME (Z-A)" }, { name: "TOP RATED" }, { name: "LATEST" }
        ]},
    { title: "RATING", options: [
            { name: "ANY" }, { name: "4★ & UP" }, { name: "3★ & UP" }
        ]},
    { title: "AVAILABILITY", options: [
            { name: "ANY" }, { name: "OPEN" }, { name: "BUSY" }, { name: "VACATION" }
        ]},
    { title: "PRICE", options: [
            { name: "ANY" }, { name: "UP TO 500" }, { name: "UP TO 1000" }, { name: "UP TO 5000" }
        ]}
];

const DEFAULT_FILTERS = { "SORT BY": "NONE", "RATING": "ANY", "AVAILABILITY": "ANY", "PRICE": "ANY" };

// Selected panel options → query params of /artists/getartists
function filtersToParams(f) {
    const params = {};
    const sort = { "NAME (A-Z)": "name_asc", "NAME (Z-A)": "name_desc", "TOP RATED": "rating", "LATEST": "newest" }[f["SORT BY"]];
    if (sort) params.sort = sort;
    const minRating = { "4★ & UP": 4, "3★ & UP": 3 }[f["RATING"]];
    if (minRating) params.minRating = minRating;
    if (f["AVAILABILITY"] !== "ANY") params.availability = f["AVAILABILITY"].toLowerCase();
    const maxPrice = { "UP TO 500": 500, "UP TO 1000": 1000, "UP TO 5000": 5000 }[f["PRICE"]];
    if (maxPrice) params.maxPrice = maxPrice;
    return params;
}

export default function ArtistsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null);
    // const [showAdvanced, setShowAdvanced] = useState(false); // ВИДАЛЕНО: компонент тепер керує цим сам
    const [galleryStates, setGalleryStates] = useState({});
    const [artistsData, setArtistsData] = useState([]);
    const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_FILTERS);

    useEffect(() => {
        axios.get(`/auth/check-session`)
            .catch(err => console.log(err));
    }, []);

    const galleryRefs = useRef({});

    const checkGalleryOverflow = (artistId) => {
        const gallery = galleryRefs.current[artistId];
        if (gallery) {
            const hasOverflow = gallery.scrollWidth > gallery.clientWidth;
            setGalleryStates(prev => ({
                ...prev,
                [artistId]: {
                    hasOverflow,
                    showLeft: false,
                    showRight: hasOverflow
                }
            }));
        }
    };

    useEffect(() => {
        const fetchArtists = async () => {
            try {
                const res = await axios.get(`/artists/getartists`, { params: filtersToParams(advancedFilters) });
                const serverArtists = Array.isArray(res.data) ? res.data : (res.data.artists || []);

                const mapped = serverArtists.map((a, idx) => {
                    const name = a.Name || a.name || `Artist ${idx}`;
                    const currentArtistId = a.Creator_ID || a.Creator_Id || a.id || idx;

                    const artworks = Array.isArray(a.paintings)
                        ? a.paintings.map(p => ({
                            id: p.id || p.Painting_ID || p.PaintingId || `${idx}-${Math.random()}`,
                            title: p.title || p.Title || '',
                            imageUrl: p.image_url || p.imageBase64 || p.Image || p.image || null,
                            artistName: name,
                            artistStyle: p.style || a.Style || a.style || '',
                            likes: p.likes || 0,
                            price: p.Price || p.price || '',
                            artistId: currentArtistId
                        }))
                        : [];

                    // styles: prefer creators.styles (can be JSON string or array)
                    const resolveStyles = () => {
                        let raw = a.styles !== undefined ? a.styles : (a.Styles !== undefined ? a.Styles : undefined);
                        if (Array.isArray(raw)) {
                            return raw.filter(Boolean).map(s => String(s));
                        }
                        if (typeof raw === 'string' && raw.trim()) {
                            try {
                                const parsed = JSON.parse(raw);
                                if (Array.isArray(parsed)) return parsed.filter(Boolean).map(s => String(s));
                            } catch (e) {
                                // not JSON, try to split by common separators
                                const split = raw.split(/[;,/|]+/).map(s => s.trim()).filter(Boolean);
                                if (split.length) return split;
                            }
                        }
                        // fallback to single style field or from artworks
                        const single = a.Style || a.style;
                        if (single) return [String(single)];
                        if (artworks.length) {
                            const set = new Set();
                            artworks.forEach(p => {
                                const ps = p.style || p.Style || p.artistStyle;
                                if (ps) set.add(String(ps));
                            });
                            if (set.size) return Array.from(set);
                        }
                        return [];
                    };

                    const stylesArr = resolveStyles();
                    const styleDisplay = stylesArr.length ? stylesArr.join(' / ') : 'Unknown';

                    // likes: prefer aggregated creator likes if present, else sum artworks likes
                    const likesFromArtworks = artworks.reduce((s, p) => s + (Number(p.likes) || 0), 0);
                    const likesCount = a.likesCount || a.likes || a.Likes || likesFromArtworks || 0;
                    return {
                        id: currentArtistId,
                        name,
                        country: a.Country || a.country || 'Unknown',
                        style: styleDisplay,
                        styles: stylesArr,
                        avatar: a.imageBase64 || a.profileImage || '/images/profileImg.jpg',
                        likesCount,
                        ratingAvg: a.ratingAvg ?? null,
                        ratingCount: a.ratingCount || 0,
                        availability: a.availability || 'open',
                        artworks
                    };
                });
                setArtistsData(mapped);
            } catch (err) {
                console.error('Error fetching artists from backend:', err);
                setArtistsData([]);
            }
        };

        fetchArtists();
    }, [advancedFilters]);

    const filteredArtists = useMemo(() => {
        let items = artistsData;
        if (activeCategory) {
            items = items.filter(a => (a.style || '').toUpperCase() === activeCategory.toUpperCase());
        }
        if (searchQuery) {
            items = items.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return items;
    }, [activeCategory, searchQuery, artistsData]);

    const itemsPerPage = 12;
    const {
        currentPage,
        setCurrentPage,
        totalPages,
        displayedData: displayedArtists
    } = usePagination(filteredArtists, itemsPerPage);

    useEffect(() => {
        const galleries = galleryRefs.current;
        const artistIds = Object.keys(galleries);
        artistIds.forEach(id => checkGalleryOverflow(id));
        const handleResize = () => artistIds.forEach(id => checkGalleryOverflow(id));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [displayedArtists]);

    const handleGalleryScroll = (artistId) => {
        const gallery = galleryRefs.current[artistId];
        if (gallery) {
            const tolerance = 5;
            const atStart = gallery.scrollLeft <= tolerance;
            const atEnd = gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - tolerance;
            setGalleryStates(prev => ({
                ...prev,
                [artistId]: {
                    ...prev[artistId],
                    showLeft: !atStart,
                    showRight: !atEnd
                }
            }));
        }
    };

    const scrollGallery = (artistId, direction) => {
        const gallery = galleryRefs.current[artistId];
        if (gallery) {
            const cardWidth = 210;
            const gap = 20;
            const itemsToScroll = 6;
            const scrollAmount = (itemsToScroll * cardWidth) + (itemsToScroll * gap);
            gallery.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    const handleCategoryClick = (category) => {
        setActiveCategory(prev => prev === category ? null : category);
        setCurrentPage(0);
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(0);
    };

    return (
        <div className={styles.artistsPage}>
            <div className={styles.contentWrapper}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.artistsTitle}>Artists</h1>
                        <div className={styles.searchBarContainer}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search by artist name..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                            <button className={styles.searchButton}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0 -16 8 8 0 0 1 0 16z" strokeWidth="2" fill="none" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>

                <div className={styles.filtersWrapper}>
                    <CategoryFilters
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategoryClick={handleCategoryClick}
                    />

                    {/* ОНОВЛЕНО: Просто вставляємо AdvancedFilters */}
                    <div className={styles.filtersContainer}>
                        <AdvancedFilters
                            filterConfig={artistFilterConfig}
                            selected={advancedFilters}
                            onSelect={(title, option) => {
                                setAdvancedFilters(prev => ({ ...prev, [title]: option }));
                                setCurrentPage(0);
                            }}
                        />
                    </div>
                </div>

                {/* AdvancedFilters тепер знаходиться всередині filtersWrapper, тому окремий рендер тут не потрібен */}

                <div className={styles.artistsList}>
                    {displayedArtists.length > 0 ? (
                        displayedArtists.map(artist => {
                            const state = galleryStates[artist.id] || { hasOverflow: false, showLeft: false, showRight: false };

                            return (
                                <div key={artist.id} className={styles.artistSection}>
                                    <Link
                                        to={`/author/${artist.id}`}
                                        className={styles.artistLeftInfoLink}
                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                    >
                                        <div className={styles.artistLeftInfo}>
                                            <img src={artist.avatar} alt={artist.name} className={styles.artistAvatar} />
                                            <h3 className={styles.artistName}>{artist.name}</h3>

                                            <div className={styles.artistDetails}>
                                                <span>Style: {artist.style}</span><br/>
                                                <span>Likes: {artist.likesCount}</span><br/>
                                                <span>
                                                    Rating: {artist.ratingCount > 0
                                                        ? `${artist.ratingAvg.toFixed(1)} ★ (${artist.ratingCount})`
                                                        : 'no reviews yet'}
                                                </span><br/>
                                                <span>Status: {artist.availability}</span>
                                            </div>
                                        </div>
                                    </Link>

                                    <div className={styles.artistRightGallery}>
                                        {state.hasOverflow && state.showLeft && (
                                            <button
                                                className={`${styles.navButton} ${styles.left}`}
                                                onClick={() => scrollGallery(artist.id, 'left')}
                                            >
                                                <img src={leftArrow} alt="Scroll left" />
                                            </button>
                                        )}

                                        <div
                                            className={styles.artistGalleryInner}
                                            ref={el => galleryRefs.current[artist.id] = el}
                                            onScroll={() => handleGalleryScroll(artist.id)}
                                        >
                                            {artist.artworks && artist.artworks.length > 0 ? (
                                                artist.artworks.map(card => (
                                                    <ArtCard key={card.id} art={card} />
                                                ))
                                            ) : (
                                                <div className={styles.noArtworks}>No artworks available</div>
                                            )}
                                        </div>

                                        {state.hasOverflow && state.showRight && (
                                            <button
                                                className={`${styles.navButton} ${styles.right}`}
                                                onClick={() => scrollGallery(artist.id, 'right')}
                                            >
                                                <img src={rightArrow} alt="Scroll right" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className={styles.noResults}>No artists found</div>
                    )}
                </div>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
}