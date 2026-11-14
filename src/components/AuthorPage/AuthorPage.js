import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import styles from './AuthorPage.module.css';
import ArtCard from '../ArtCard/ArtCard';
import Pagination from '../hooks/Pagination/Pagination';
import { usePagination } from '../hooks/Pagination/usePagination';
import AddCommissionModal from '../Commission/CommissionModals/AddCommissionModal';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice } from '../../i18n/format';

const ITEMS_PER_PAGE = 24;
const TABS = ['works', 'about', 'reviews'];
const SORTS = {
    latest: (a, b) => new Date(b.Creation_Date || 0) - new Date(a.Creation_Date || 0) || (b.Painting_ID - a.Painting_ID),
    popular: (a, b) => (b.likes ?? 0) - (a.likes ?? 0),
    cheap: (a, b) => Number(a.Price) - Number(b.Price),
    expensive: (a, b) => Number(b.Price) - Number(a.Price),
};

// creators.styles / languages may come as an array or a JSON string
const toList = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
        } catch {
            return value.split(/[;,/|]+/).map((s) => s.trim()).filter(Boolean);
        }
    }
    return [];
};

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const AuthorPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();

    const [artist, setArtist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('works');
    const [category, setCategory] = useState(null);
    const [sort, setSort] = useState('latest');
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [reviews, setReviews] = useState({ summary: { average: null, count: 0 }, reviews: [] });

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        axios.get(`/artists/artist/${id}`)
            .then((res) => setArtist(res.data))
            .catch((error) => { console.error('Error loading artist:', error); setArtist(null); })
            .finally(() => setLoading(false));
        axios.get(`/reviews/artist/${id}`, { params: { limit: 20 } })
            .then((res) => setReviews({ summary: res.data.summary, reviews: res.data.reviews || [] }))
            .catch((err) => console.error('Error loading reviews:', err));
    }, [id]);

    const paintings = useMemo(() => (Array.isArray(artist?.paintings) ? artist.paintings : []), [artist]);
    const categories = useMemo(() => [...new Set(paintings.map((p) => p.Category).filter(Boolean))], [paintings]);
    const shown = useMemo(() => {
        const list = category ? paintings.filter((p) => p.Category === category) : paintings;
        return [...list].sort(SORTS[sort]);
    }, [paintings, category, sort]);

    const { currentPage, setCurrentPage, totalPages, displayedData } = usePagination(shown, ITEMS_PER_PAGE);
    useEffect(() => { setCurrentPage(0); }, [category, sort, setCurrentPage]);

    if (loading) return <div className={styles.loading}>{t('common.loading')}</div>;
    if (!artist) return <div className={styles.loading}>{t('author.notFound')}</div>;

    const artistId = artist.Creator_ID || artist.id || id;
    const artistName = artist.Name || artist.name;
    const avatar = artist.avatar || artist.imageBase64 || '/images/profileImg.jpg';
    const availability = ['busy', 'vacation'].includes(artist.availability) ? artist.availability : 'open';
    const stylesList = artist.stylesArray || toList(artist.styles);
    const languages = artist.languagesArray || toList(artist.languages);
    const bio = artist.bio || artist.Other_Details || '';
    const likes = Number(artist.likesCount ?? paintings.reduce((sum, p) => sum + (Number(p.likes) || 0), 0)) || 0;
    const cover = paintings[0]?.image_url;
    const minPrice = artist.minPrice ?? (paintings.length ? Math.min(...paintings.map((p) => Number(p.Price) || 0)) : null);

    const stats = [
        [compact(paintings.length), t('author.stats.artworks')],
        [compact(likes), t('author.stats.likes')],
        [reviews.summary.count > 0 ? `${Number(reviews.summary.average).toFixed(1)} ★` : '—', t('author.reviewCount', { count: reviews.summary.count })],
        [minPrice ? formatPrice(minPrice) : '—', t('author.stats.from')],
    ];

    return (
        <div className={styles.pageContainer}>
            <div className={`container ${styles.contentWrapper}`}>
                <div className={styles.cover} style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden="true" />

                <header className={styles.head}>
                    <img src={avatar} alt="" className={styles.avatar} />
                    <div className={styles.identity}>
                        <span className={`${styles.badge} ${styles[availability]}`}>{t(`author.availability.${availability}`)}</span>
                        <h1 className={styles.artistName}>{artistName}</h1>
                        {stylesList.length > 0 && <p className={styles.tagline}>{stylesList.join(' · ')}</p>}
                    </div>
                    <div className={styles.headActions}>
                        <button type="button" className="btn btn-lime" onClick={() => setIsCommissionModalOpen(true)}
                                disabled={availability === 'vacation'}>
                            {t('author.commissionWith', { name: artistName.split(' ')[0] })}
                        </button>
                    </div>
                </header>

                <dl className={`glass ${styles.stats}`}>
                    {stats.map(([value, label]) => (
                        <div key={label} className={styles.stat}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>

                <div className={styles.tabs} role="tablist" aria-label={t('author.sections')}>
                    {TABS.map((name) => (
                        <button key={name} type="button" role="tab" id={`author-tab-${name}`} aria-controls={`author-panel-${name}`}
                                aria-selected={tab === name} className={styles.tab} onClick={() => setTab(name)}>
                            {t(`author.tabs.${name}`)}
                            {name === 'reviews' && reviews.summary.count > 0 && <span className={styles.tabCount}>{reviews.summary.count}</span>}
                        </button>
                    ))}
                </div>

                {tab === 'works' && (
                    <section id="author-panel-works" role="tabpanel" aria-labelledby="author-tab-works">
                        <div className={styles.toolbar}>
                            {categories.length > 1 && (
                                <div className={styles.chips} role="group" aria-label={t('shop.filters.category')}>
                                    <button type="button" className={styles.chip} aria-pressed={!category} onClick={() => setCategory(null)}>
                                        {t('home.filterAll')}
                                    </button>
                                    {categories.map((c) => (
                                        <button key={c} type="button" className={styles.chip} aria-pressed={category === c}
                                                onClick={() => setCategory(category === c ? null : c)}>
                                            {t(`labels.${c}`, { defaultValue: c })}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <label className={`glass ${styles.sortLabel}`}>
                                <span className="sr-only">{t('shop.sortLabel')}</span>
                                <select className={styles.sort} value={sort} onChange={(e) => setSort(e.target.value)}>
                                    <option value="latest">{t('shop.sort.LATEST')}</option>
                                    <option value="popular">{t('shop.sort.POPULAR')}</option>
                                    <option value="expensive">{t('shop.sort.EXPENSIVE')}</option>
                                    <option value="cheap">{t('shop.sort.CHEAP')}</option>
                                </select>
                            </label>
                        </div>

                        {displayedData.length > 0 ? (
                            <div className={styles.artGrid}>
                                {displayedData.map((p) => (
                                    <ArtCard
                                        key={p.Painting_ID || p.id}
                                        art={{
                                            id: p.Painting_ID || p.id,
                                            title: p.Title || p.title,
                                            imageUrl: p.image_url || p.Image,
                                            price: p.Price || p.price,
                                            artistName,
                                            likes: p.likes ?? p.Likes ?? 0,
                                            artistId,
                                            category: p.Category,
                                            style: p.Style,
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className={styles.noArt}>{t('artists.noArtworks')}</div>
                        )}

                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                    </section>
                )}

                {tab === 'about' && (
                    <section id="author-panel-about" role="tabpanel" aria-labelledby="author-tab-about" className={`glass ${styles.about}`}>
                        <p className={styles.bio}>{bio || t('author.noBio')}</p>
                        <dl className={styles.facts}>
                            <div>
                                <dt>{t('artists.style')}</dt>
                                <dd>{stylesList.length ? stylesList.join(', ') : '—'}</dd>
                            </div>
                            <div>
                                <dt>{t('author.languages')}</dt>
                                <dd>{languages.length ? languages.join(', ') : '—'}</dd>
                            </div>
                            <div>
                                <dt>{t('artists.status')}</dt>
                                <dd>{t(`availability.${availability}`)}</dd>
                            </div>
                        </dl>
                    </section>
                )}

                {tab === 'reviews' && (
                    <section id="author-panel-reviews" role="tabpanel" aria-labelledby="author-tab-reviews" className={styles.reviews}>
                        {reviews.reviews.length === 0 ? (
                            <div className={styles.noArt}>{t('author.noReviews')}</div>
                        ) : reviews.reviews.map((r) => (
                            <article key={r.id} className={`glass ${styles.reviewItem}`}>
                                <div className={styles.reviewHeader}>
                                    <img src={r.customer.avatar} alt="" className={styles.reviewAvatar} />
                                    <span className={styles.reviewAuthor}>{r.customer.name}</span>
                                    <span className={styles.reviewStars} role="img" aria-label={t('author.ratingOf', { rating: r.rating })}>
                                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                                    </span>
                                    <span className={styles.reviewDate}>{formatDate(r.createdAt)}</span>
                                </div>
                                {r.text && <p className={styles.reviewText}>{r.text}</p>}
                            </article>
                        ))}
                    </section>
                )}
            </div>

            {isCommissionModalOpen && (
                <AddCommissionModal onClose={() => setIsCommissionModalOpen(false)} targetCreatorId={artistId} />
            )}
        </div>
    );
};

export default AuthorPage;
