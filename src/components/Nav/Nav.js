import { useNavigate, useLocation } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Nav.module.css';
import { useCart } from '../Cart/CartContext';
import BasketModal from './BasketModal/BasketModal';
import NotificationBell from './NotificationBell/NotificationBell';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import useDialog from '../Dialog/useDialog';
import { HomeIcon, ShopIcon, PlusIcon, BrushIcon, UserIcon, BagIcon, UploadIcon, SparkIcon } from '../Icons/Icons';

const LINKS = [
    { path: '/', key: 'nav.main', Icon: HomeIcon, match: ['/', '/homepage'] },
    { path: '/shop', key: 'nav.shop', Icon: ShopIcon },
    { path: '/artists', key: 'nav.artists' },
    { path: '/commission', key: 'nav.commission', Icon: BrushIcon },
];

// "+" sheet on phones: the two ways to create something on the site
function CreateSheet({ onClose, onPick, isArtist }) {
    const { t } = useTranslation();
    const ref = useRef(null);
    useDialog(ref, onClose);
    return (
        <div className={styles.sheetLayer}>
            <div className={styles.sheetBackdrop} onClick={onClose} aria-hidden="true" />
            <div ref={ref} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="create-sheet-title">
                <span className={styles.grab} aria-hidden="true" />
                <h2 id="create-sheet-title" className={styles.sheetTitle}>{t('nav.createTitle')}</h2>
                {isArtist && (
                    <button type="button" className={styles.sheetAction} onClick={() => onPick('/shop', 'openAddArt')}>
                        <span className={`${styles.sheetIcon} ${styles.sheetIconLime}`}><UploadIcon /></span>
                        <span>
                            <strong>{t('nav.sellArt')}</strong>
                            <small>{t('nav.sellArtHint')}</small>
                        </span>
                    </button>
                )}
                <button type="button" className={styles.sheetAction} onClick={() => onPick('/commission', 'openAddCommission')}>
                    <span className={`${styles.sheetIcon} ${styles.sheetIconPeach}`}><SparkIcon /></span>
                    <span>
                        <strong>{t('nav.postRequest')}</strong>
                        <small>{t('nav.postRequestHint')}</small>
                    </span>
                </button>
                <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
            </div>
        </div>
    );
}

export function Navbar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { isLoggedIn, isArtist } = useAuth();
    const { openModal } = useModal();
    const { cartItems } = useCart();

    const [isBasketOpen, setIsBasketOpen] = useState(false);
    const [basketPosition, setBasketPosition] = useState(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const basketIconRef = useRef(null);

    const isActive = (link) => (link.match || [link.path]).includes(location.pathname);
    const profileActive = location.pathname === '/profile';

    const handleBasketToggle = () => {
        if (isBasketOpen) {
            setIsBasketOpen(false);
            return;
        }
        if (basketIconRef.current) {
            const rect = basketIconRef.current.getBoundingClientRect();
            setBasketPosition({ top: rect.bottom + 12, right: Math.max(12, window.innerWidth - rect.right) });
        }
        setIsBasketOpen(true);
    };

    const pickCreate = (path, flag) => {
        setIsCreateOpen(false);
        if (!isLoggedIn) {
            navigate('/profile');
            return;
        }
        navigate(path, { state: { [flag]: true } });
    };

    return (
        <>
            <header className={styles.header}>
                <div className={`container ${styles.bar}`}>
                    <button type="button" className={`unstyled-button ${styles.logo}`} onClick={() => navigate('/')}
                            aria-label={t('nav.logoHome')}>
                        Digital<span>Brush</span>
                    </button>

                    <nav className={styles.links} aria-label={t('nav.menu')}>
                        {LINKS.map((link) => (
                            <button
                                key={link.path}
                                type="button"
                                className={`${styles.link} ${isActive(link) ? styles.linkActive : ''}`}
                                aria-current={isActive(link) ? 'page' : undefined}
                                onClick={() => navigate(link.path)}
                            >
                                {t(link.key)}
                            </button>
                        ))}
                    </nav>

                    <div className={styles.actions}>
                        {isLoggedIn && <NotificationBell />}
                        {isLoggedIn && (
                            <div className={styles.cartWrap} ref={basketIconRef}>
                                <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={handleBasketToggle}
                                    aria-label={t('nav.basketCount', { count: cartItems.length })}
                                    aria-expanded={isBasketOpen}
                                    aria-haspopup="dialog"
                                >
                                    <BagIcon />
                                    {cartItems.length > 0 && (
                                        <span className={styles.cartBadge} aria-hidden="true">{cartItems.length}</span>
                                    )}
                                </button>
                                {isBasketOpen && (
                                    <BasketModal
                                        onClose={() => setIsBasketOpen(false)}
                                        onViewItemDetails={openModal}
                                        position={basketPosition}
                                    />
                                )}
                            </div>
                        )}
                        <LanguageSwitcher />
                        <button
                            type="button"
                            className={`btn ${profileActive ? 'btn-ghost' : 'btn-lime'} ${styles.profileButton}`}
                            aria-current={profileActive ? 'page' : undefined}
                            onClick={() => navigate('/profile')}
                        >
                            {isLoggedIn ? t('nav.profile') : t('nav.signIn')}
                        </button>
                    </div>
                </div>
            </header>

            {/* Phones: fixed tab bar at the bottom, with a "+" create button in the middle */}
            <nav className={styles.tabbar} aria-label={t('nav.mobileMenu')}>
                {LINKS.filter((l) => l.Icon).slice(0, 2).map((link) => (
                    <button
                        key={link.path}
                        type="button"
                        className={`${styles.tab} ${isActive(link) ? styles.tabActive : ''}`}
                        aria-current={isActive(link) ? 'page' : undefined}
                        onClick={() => navigate(link.path)}
                    >
                        <link.Icon />
                        <span>{t(link.key)}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className={styles.tabPlus}
                    aria-label={t('nav.createTitle')}
                    aria-haspopup="dialog"
                    aria-expanded={isCreateOpen}
                    onClick={() => setIsCreateOpen(true)}
                >
                    <PlusIcon size={26} />
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${isActive(LINKS[3]) ? styles.tabActive : ''}`}
                    aria-current={isActive(LINKS[3]) ? 'page' : undefined}
                    onClick={() => navigate('/commission')}
                >
                    <BrushIcon />
                    <span>{t('nav.commission')}</span>
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${profileActive ? styles.tabActive : ''}`}
                    aria-current={profileActive ? 'page' : undefined}
                    onClick={() => navigate('/profile')}
                >
                    <UserIcon />
                    <span>{isLoggedIn ? t('nav.profile') : t('nav.signIn')}</span>
                </button>
            </nav>

            {isCreateOpen && (
                <CreateSheet onClose={() => setIsCreateOpen(false)} onPick={pickCreate} isArtist={isArtist} />
            )}
        </>
    );
}

export default Navbar;
