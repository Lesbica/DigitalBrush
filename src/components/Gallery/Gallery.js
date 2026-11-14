import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import styles from './Gallery.module.css';
import ArtCard from '../ArtCard/ArtCard';
import { useModal } from '../../context/ModalContext';
import { formatPrice } from '../../i18n/format';
import { SearchIcon, ArrowRightIcon } from '../Icons/Icons';

const FRESH_LIMIT = 12;

// Older API rows may still carry the picture as base64 or a Buffer
const normalizeImage = (img) => {
    if (!img) return null;
    if (typeof img === 'string') {
        if (img.startsWith('data:') || img.startsWith('http') || img.startsWith('/')) return img;
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
        } catch {
            return null;
        }
    }
    return null;
};

const toPainting = (p) => ({
    id: p.Painting_ID || p.id || Math.random().toString(36).slice(2, 9),
    title: p.Title || p.title || '',
    artistName: p.author_name || p.creatorName || 'Artist',
    artistId: p.Creator_ID || p.creator_id || p.artistId || null,
    description: p.Description || p.description || '',
    imageUrl: p.imageUrl || p.image_url || normalizeImage(p.Image || p.image) || '/images/placeholder.svg',
    likes: p.likes ?? p.Likes ?? 0,
    price: p.Price ?? p.price ?? '',
    style: p.Style ?? p.style ?? '',
});

// A stable, pleasant colour per artist for the initial avatars
const AVATAR_GRADIENTS = [
    ['#FF7AB6', '#FFB86B'], ['#6EA8FF', '#7C5CFA'], ['#7FE0C3', '#2FB8A0'],
    ['#FFB86B', '#FF5A5A'], ['#C6F57A', '#3FA7D6'], ['#B06AF0', '#FF7AB6'],
];
const gradientFor = (seed) => {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
};

const Gallery = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { openModal } = useModal();
    const [paintings, setPaintings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let mounted = true;
        axios.get('/paintings')
            .then((res) => {
                const payload = res.data;
                const list = Array.isArray(payload) ? payload : (payload.paintings || []);
                if (mounted) setPaintings(list.map(toPainting));
            })
            .catch((err) => {
                console.error('Failed to fetch paintings:', err);
                if (mounted) setPaintings([]);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => { mounted = false; };
    }, []);

    const featured = paintings.slice(0, 3);

    const artists = useMemo(() => {
        const seen = new Map();
        for (const p of paintings) {
            if (p.artistId != null && !seen.has(p.artistId)) seen.set(p.artistId, { id: p.artistId, name: p.artistName });
        }
        return [...seen.values()].slice(0, 12);
    }, [paintings]);

    const fresh = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return paintings.slice(0, FRESH_LIMIT);
        return paintings.filter((card) =>
            card.title.toLowerCase().includes(q)
            || card.artistName.toLowerCase().includes(q)
            || String(card.style).toLowerCase().includes(q));
    }, [searchQuery, paintings]);

    return (
        <div id="mainContent" className={styles.page}>
            {/* --- Hero --- */}
            <section className={`container ${styles.hero}`} aria-labelledby="home-title">
                <div className={styles.heroCopy}>
                    <span className={`glass ${styles.eyebrow}`}>{t('home.eyebrow')}</span>
                    <h1 id="home-title" className={styles.heroTitle}>
                        {t('home.heroTitleStart')} <span className="gradient-text">{t('home.heroTitleAccent')}</span>
                    </h1>
                    <p className={styles.heroText}>{t('home.heroText')}</p>
                    <div className={styles.heroActions}>
                        <button type="button" className="btn btn-lime" onClick={() => navigate('/shop')}>
                            {t('home.toShop')} <ArrowRightIcon size={18} />
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => navigate('/commission')}>
                            {t('home.toCommission')}
                        </button>
                    </div>
                </div>

                {featured.length > 0 && (
                    <div className={styles.stack}>
                        {featured.slice(1).map((p, i) => (
                            <img
                                key={p.id}
                                src={p.imageUrl}
                                alt=""
                                className={`${styles.stackBack} ${i === 0 ? styles.stackLeft : styles.stackRight}`}
                                aria-hidden="true"
                            />
                        ))}
                        <button type="button" className={styles.stackFront} onClick={() => openModal(featured[0])}
                                aria-label={t('art.openCard', { title: featured[0].title, artist: featured[0].artistName, price: formatPrice(featured[0].price), likes: featured[0].likes })}>
                            <img src={featured[0].imageUrl} alt="" />
                            <span className={`glass ${styles.stackLabel}`}>
                                <span className={styles.stackMeta}>
                                    <small>{t('home.featured')}</small>
                                    <strong>{featured[0].title}</strong>
                                    <span>{featured[0].artistName} · {formatPrice(featured[0].price)}</span>
                                </span>
                                <span className={`btn btn-lime ${styles.stackView}`} aria-hidden="true">{t('home.view')}</span>
                            </span>
                        </button>
                    </div>
                )}
            </section>

            {/* --- Artists --- */}
            {artists.length > 0 && (
                <section className={`container ${styles.section}`} aria-labelledby="home-artists">
                    <div className={styles.sectionHead}>
                        <h2 id="home-artists">{t('home.artistsTitle')}</h2>
                        <button type="button" className={styles.textLink} onClick={() => navigate('/artists')}>
                            {t('home.allArtists')} <ArrowRightIcon size={16} />
                        </button>
                    </div>
                    <ul className={styles.stories}>
                        {artists.map((a) => (
                            <li key={a.id}>
                                <button type="button" className={styles.story} onClick={() => navigate(`/author/${a.id}`)}>
                                    <span className={styles.ring}>
                                        <span className={styles.avatar} style={{ background: gradientFor(a.id) }} aria-hidden="true">
                                            {a.name.trim().charAt(0).toUpperCase()}
                                        </span>
                                    </span>
                                    <span className={styles.storyName}>{a.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* --- Fresh works --- */}
            <section className={`container ${styles.section}`} aria-labelledby="home-fresh">
                <div className={styles.sectionHead}>
                    <h2 id="home-fresh">{t('home.freshTitle')}</h2>
                    <label className={`glass ${styles.search}`}>
                        <SearchIcon size={18} />
                        <input
                            type="search"
                            aria-label={t('common.searchLabel')}
                            placeholder={t('home.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </label>
                </div>

                {loading ? (
                    <p className={styles.note}>{t('home.loading')}</p>
                ) : fresh.length > 0 ? (
                    <div className={styles.masonry}>
                        {fresh.map((card) => <ArtCard key={card.id} art={card} />)}
                    </div>
                ) : (
                    <p className={styles.note}>{t('home.noResults')}</p>
                )}

                {!searchQuery && paintings.length > FRESH_LIMIT && (
                    <div className={styles.more}>
                        <button type="button" className="btn btn-ghost" onClick={() => navigate('/shop')}>{t('home.seeAll')}</button>
                    </div>
                )}
            </section>

            {/* --- Commission prompt --- */}
            <section className={`container ${styles.section}`}>
                <div className={`glass ${styles.ctaStrip}`}>
                    <div>
                        <h2>{t('home.commissionTitle')}</h2>
                        <p>{t('home.commissionText')}</p>
                    </div>
                    <button type="button" className="btn btn-lime" onClick={() => navigate('/commission')}>{t('home.startRequest')}</button>
                </div>
            </section>

            {/* --- For artists / for buyers --- */}
            <section className={`container ${styles.section} ${styles.duo}`}>
                <div className={`glass ${styles.duoCard}`}>
                    <h2>{t('home.artistTitle1')} <span className="gradient-text">{t('home.artistTitle2')}</span></h2>
                    <p>{t('home.artistText')}</p>
                    <button type="button" className="btn btn-lime" onClick={() => navigate('/profile')}>{t('common.registration')}</button>
                </div>
                <div className={`glass ${styles.duoCard}`}>
                    <h2>{t('home.buyerTitle1')} <span className="gradient-text">{t('home.buyerTitle2')}</span></h2>
                    <p>{t('home.buyerText')}</p>
                    <button type="button" className="btn btn-ghost" onClick={() => navigate('/shop')}>{t('home.toShop')}</button>
                </div>
            </section>
        </div>
    );
};

export default Gallery;
