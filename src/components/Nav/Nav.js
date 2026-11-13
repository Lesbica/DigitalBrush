import {useNavigate, useLocation} from "react-router-dom";
import React, {useEffect, useRef, useState} from "react";
import styles from "./Nav.module.css";
import logo from "../../assets/mainIconNavbar.svg";
import {useCart} from "../Cart/CartContext";
import BasketModal from "./BasketModal/BasketModal";
import NotificationBell from "./NotificationBell/NotificationBell";
import {useAuth} from "../../context/AuthContext";
import {useModal} from "../../context/ModalContext";
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from "./LanguageSwitcher/LanguageSwitcher";

export function Navbar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {isLoggedIn} = useAuth();
    const {openModal} = useModal();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const [isBasketOpen, setIsBasketOpen] = useState(false);
    const {cartItems} = useCart();
    const basketIconRef = useRef(null);
    const [basketPosition, setBasketPosition] = useState(null);

    useEffect(() => {
        if (isMenuOpen) {
            document.body.classList.add('no-scroll');
        } else {
            document.body.classList.remove('no-scroll');
        }
        return () => {
            document.body.classList.remove('no-scroll');
        };
    }, [isMenuOpen]);

    // Focus goes into the opened menu and back to the burger button when it closes
    const burgerRef = useRef(null);
    const closeMenuRef = useRef(null);
    const wasMenuOpen = useRef(false);
    useEffect(() => {
        if (isMenuOpen) closeMenuRef.current?.focus({ preventScroll: true });
        else if (wasMenuOpen.current) burgerRef.current?.focus({ preventScroll: true });
        wasMenuOpen.current = isMenuOpen;
    }, [isMenuOpen]);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (path) => {
        navigate(path);
        setIsMenuOpen(false);
    };

    const getButtonClass = (path, linkName) => {
        if (linkName === 'MAIN' && (location.pathname === '/' || location.pathname === '/homepage')) {
            return styles.navButtonActive;
        }
        if (location.pathname === path) {
            return styles.navButtonActive;
        }
        return styles.navLink;
    };

    const handleBasketToggle = () => {
        if (isBasketOpen) {
            setIsBasketOpen(false);
        } else {
            if (basketIconRef.current) {
                const rect = basketIconRef.current.getBoundingClientRect();
                setBasketPosition({
                    top: rect.bottom + 15,
                    right: window.innerWidth - rect.right
                });
            }
            setIsBasketOpen(true);
        }
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.navbarMain}>
                <div className={styles.navbarContainer}>
                    <div className={styles.navbarLogo}>
                        <img src={logo} className={styles.logo} alt="DigitalBrush"/>
                    </div>
                    <div className={styles.navbarLeft}>
                        <div className={styles.navbarLinks}>
                            <button
                                className={getButtonClass('/homepage', 'MAIN')}
                                aria-current={getButtonClass('/homepage', 'MAIN') === styles.navButtonActive ? 'page' : undefined}
                                onClick={() => handleNavigation('/homepage')}
                            >
                                {t('nav.main')}
                            </button>
                            <button
                                className={getButtonClass('/shop', 'SHOP')}
                                aria-current={getButtonClass('/shop', 'SHOP') === styles.navButtonActive ? 'page' : undefined}
                                onClick={() => handleNavigation('/shop')}
                            >
                                {t('nav.shop')}
                            </button>
                            <button
                                className={getButtonClass('/artists', 'ARTISTS')}
                                aria-current={getButtonClass('/artists', 'ARTISTS') === styles.navButtonActive ? 'page' : undefined}
                                onClick={() => handleNavigation('/artists')}
                            >
                                {t('nav.artists')}
                            </button>
                            <button
                                className={getButtonClass('/commission', 'COMMISSION')}
                                aria-current={getButtonClass('/commission', 'COMMISSION') === styles.navButtonActive ? 'page' : undefined}
                                onClick={() => handleNavigation('/commission')}
                            >
                                {t('nav.commission')}
                            </button>
                        </div>
                    </div>

                    <div className={styles.navbarRight}>
                        <div className={styles.iconsLeft}>
                            {isLoggedIn && <NotificationBell />}
                            {isLoggedIn && (
                                <div className={styles.settingsAndBasket} ref={basketIconRef}>
                                    <button
                                        type="button"
                                        className="unstyled-button"
                                        onClick={handleBasketToggle}
                                        aria-label={t('nav.basketCount', { count: cartItems.length })}
                                        aria-expanded={isBasketOpen}
                                        aria-haspopup="dialog"
                                        style={{ display: 'flex', position: 'relative' }}
                                    >
                                    {cartItems.length > 0 && (
                                        <span className={styles.cartBadge} aria-hidden="true">{cartItems.length}</span>
                                    )}
                                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true"
                                         xmlns="http://www.w3.org/2000/svg"
                                         xmlnsXlink="http://www.w3.org/1999/xlink">
                                        <rect width="36" height="36" fill="url(#pattern0_3189_486)"/>
                                        <defs>
                                            <pattern id="pattern0_3189_486" patternContentUnits="objectBoundingBox"
                                                     width="1" height="1">
                                                <use xlinkHref="#image0_3189_486" transform="scale(0.015625)"/>
                                            </pattern>
                                            <image id="image0_3189_486" width="64" height="64"
                                                   preserveAspectRatio="none"
                                                   xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAABMFJREFUeJzlm0mIHVUUhr/7bE3EOMQhRBONGsmwMeAmDqi4CChZiIuIuowxcSGIoAazFIxKFjEguBCXbiK4MCAq4kAgiUhEXDhhvyQOQQMJHRPJ1N2fi1fV777q6jf1q+pO9b+pV6/Ouee/p+5wzq17AyVAvQl4ALgHWAksB64DFiQip4HjwDDwC7AP2BtCOFoGv0KgLlSfV/er4/aOcXVfUsY1RfEMgy5QXQxsAzYCV+SInAF+A/6h8eah0RIWA3cA83N0TgPvAdtDCMcGzXkgUIfUV9R/M2/yrPqR+oy6Wp3S6WpIZDare9RzmbJOqi+rQ2XWrSPUVeq3GbJH1BfVhdMod6H6kvp7puxv1BWDrEPfUNcnbybFSFLxeQO0MT9xRNbOI4Oy0S+xTepoROoz9eYC7d2ifh7ZG1U3FmWvE5ktNkf3cXW7WivBbk19PbI9pj5dtN0sifXRmx9TN5dKgIkXMJZwuKA+XJbhFbaO9JtKMZzPZUvE46S6vGiDl9o62r9WqMHuOL0R8dlnkVOkujUy9kUZfb4LTpeoX0e8XijK0OKo6Z9SlxZiqA+oy9TTCbcRdVERRnZGXt46cAPThLot4rdj0IVfm7x11aNqXrw+o1AvV/+OBsSuEqhu+/BTNFPXnSGEs32xLBAhhDPAruT2KuDJgRWuHkg8e169YWAFDxjqooSj6t5BFppGXXsGUmiBUD9OuI6p13eS76YLPERz3eCTabErB58m1xrwYCfhbhywNvr9VR+EysaX0e+7Owl344BVyfU88Gs/jErGTzS4AqzuJDykvgtc3Ubm3uQ6CryvTo9eORgFLgPuU3e3kTsR1IPAXeXwmnU4UAPqM81iBlEfotUBq0MIP88UmzKgrgG+T26Hsy3g9vIplY54zeDQXHRAXMd61gG3lUxmJhDXsV4DjtCYNmButYBzwF+1EMIo8EfmYZWR1vFwCGE8jQTrmYeVRLKEtyy5rUMzFE4dsKCQ5aTZg6VA+sVqGJoOOBQJ9dQKomWodiFnnt6GSHdDj7q7U8Ve9Git2yFoOmB4CqGqoWUKhMldAFoDhaqhKwdUORbI7wIhhBPASI5Q1ZDW7VgI4RS0LojMhakwrdtEi89zwBIHuLlhtkC9EkhXtNs6oAbcWg6tUhG37IlZL3ZA37HARYJJAyDkt4CscFUwaQqEVgdUPRjq6ICqp8UtaXD654QD5kBa3JIGp39mP4xUMhbIS4NTTOWAqqXFk9LgFFkHVHUqzJ0CYeoWkFW62JE7A8DccUDLSnD8oJ0DqpQWd9cFQgjHaabFVVoYSesykQanyNsfUMWpcFIanCJvW2mdxufyJeq8EMK5DoU/nlz/7JHU/kh3f4+6O4EPuhFUF5CTBrdTeDNarV3ZI7FZB3VNVJ9Xs8/zukDVYoEpB0BoPwZklS9WTBkDQL4D4lCxCjNBWwdMgo3jb/8lfea74niVA/XHpC4jdru9P9ptqbquYI6FQX00qseHvSiuixSPq48VyLMQqE/YPGY3rt6fJ9fuFOc7wLPRX4eBH2isqMxmzAfupJn/A7wVQujtJImNoyi77O/g82zBuLrDNn2/4+FpdS3wHI2NxzeSHz3OJlwAjtLYM/x2COFgO+H/Aab2un8K8ZF7AAAAAElFTkSuQmCC"/>
                                        </defs>
                                    </svg>
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
                            {/*<div className={styles.settingsAndBasket}>*/}
                            {/*    <svg width="32" height="34" viewBox="0 0 32 34" fill="none"*/}
                            {/*         xmlns="http://www.w3.org/2000/svg">*/}
                            {/*        <path*/}
                            {/*            d="M15.75 21.5502C18.386 21.5502 20.5229 19.4012 20.5229 16.7502C20.5229 14.0992 18.386 11.9502 15.75 11.9502C13.114 11.9502 10.9771 14.0992 10.9771 16.7502C10.9771 19.4012 13.114 21.5502 15.75 21.5502Z"*/}
                            {/*            stroke="white" strokeWidth="1.5"/>*/}
                            {/*        <path*/}
                            {/*            d="M18.5581 0.9932C17.9742 0.75 17.2328 0.75 15.75 0.75C14.2672 0.75 13.5258 0.75 12.9419 0.9932C12.5556 1.15402 12.2046 1.38983 11.9089 1.68716C11.6133 1.98448 11.3788 2.33749 11.2189 2.726C11.0725 3.0828 11.0137 3.5004 10.9914 4.1068C10.9815 4.54518 10.8609 4.97384 10.6411 5.35251C10.4212 5.73118 10.1093 6.04745 9.73453 6.2716C9.35412 6.48607 8.92574 6.59976 8.48964 6.602C8.05354 6.60424 7.62403 6.49495 7.24147 6.2844C6.7069 5.9996 6.32029 5.8428 5.93687 5.7916C5.10053 5.68099 4.25473 5.90889 3.58541 6.4252C3.08584 6.814 2.71356 7.4588 1.97216 8.75C1.23077 10.0412 0.858481 10.686 0.777341 11.318C0.722667 11.7347 0.750167 12.1582 0.858268 12.5642C0.96637 12.9703 1.15296 13.3509 1.40737 13.6844C1.64283 13.9916 1.97216 14.2492 2.48287 14.5724C3.2354 15.0476 3.71905 15.8572 3.71905 16.75C3.71905 17.6428 3.2354 18.4524 2.48287 18.926C1.97216 19.2508 1.64124 19.5084 1.40737 19.8156C1.15296 20.1491 0.96637 20.5297 0.858268 20.9358C0.750167 21.3418 0.722667 21.7653 0.777341 22.182C0.860071 22.8124 1.23077 23.4588 1.97057 24.75C2.71356 26.0412 3.08425 26.686 3.58541 27.0748C3.91703 27.3307 4.29552 27.5183 4.69926 27.627C5.103 27.7357 5.52409 27.7634 5.93846 27.7084C6.3203 27.6572 6.7069 27.5004 7.24147 27.2156C7.62403 27.005 8.05354 26.8958 8.48964 26.898C8.92574 26.9002 9.35412 27.0139 9.73453 27.2284C10.503 27.6764 10.9596 28.5004 10.9914 29.3932C11.0137 30.0012 11.0709 30.4172 11.2189 30.774C11.3788 31.1625 11.6133 31.5155 11.9089 31.8128C12.2046 32.1102 12.5556 32.346 12.9419 32.5068C13.5258 32.75 14.2672 32.75 15.75 32.75C17.2328 32.75 17.9742 32.75 18.5581 32.5068C18.9444 32.346 19.2954 32.1102 19.5911 31.8128C19.8867 31.5155 20.1212 31.1625 20.2811 30.774C20.4275 30.4172 20.4863 30.0012 20.5086 29.3932C20.5404 28.5004 20.997 27.6748 21.7655 27.2284C22.1459 27.0139 22.5743 26.9002 23.0104 26.898C23.4465 26.8958 23.876 27.005 24.2585 27.2156C24.7931 27.5004 25.1797 27.6572 25.5615 27.7084C25.9759 27.7634 26.397 27.7357 26.8007 27.627C27.2045 27.5183 27.583 27.3307 27.9146 27.0748C28.4157 26.6876 28.7864 26.0412 29.5278 24.75C30.2692 23.4588 30.6415 22.814 30.7227 22.182C30.7773 21.7653 30.7498 21.3418 30.6417 20.9358C30.5336 20.5297 30.347 20.1491 30.0926 19.8156C29.8572 19.5084 29.5278 19.2508 29.0171 18.9276C28.6444 18.6998 28.3354 18.3804 28.1192 17.9995C27.9029 17.6186 27.7866 17.1886 27.7809 16.75C27.7809 15.8572 28.2646 15.0476 29.0171 14.574C29.5278 14.2492 29.8588 13.9916 30.0926 13.6844C30.347 13.3509 30.5336 12.9703 30.6417 12.5642C30.7498 12.1582 30.7773 11.7347 30.7227 11.318C30.6399 10.6876 30.2692 10.0412 29.5294 8.75C28.7864 7.4588 28.4157 6.814 27.9146 6.4252C27.583 6.16935 27.2045 5.9817 26.8007 5.87299C26.397 5.76427 25.9759 5.73662 25.5615 5.7916C25.1797 5.8428 24.7931 5.9996 24.2569 6.2844C23.8746 6.49466 23.4454 6.6038 23.0096 6.60156C22.5738 6.59932 22.1457 6.48578 21.7655 6.2716C21.3907 6.04745 21.0788 5.73118 20.8589 5.35251C20.6391 4.97384 20.5185 4.54518 20.5086 4.1068C20.4863 3.4988 20.4291 3.0828 20.2811 2.726C20.1212 2.33749 19.8867 1.98448 19.5911 1.68716C19.2954 1.38983 18.9444 1.15402 18.5581 0.9932Z"*/}
                            {/*            stroke="white" strokeWidth="1.5"/>*/}
                            {/*    </svg>*/}
                            {/*</div>*/}
                        </div>

                        <LanguageSwitcher />
                        <button
                            className={getButtonClass('/profile', 'PROFILE')}
                                aria-current={getButtonClass('/profile', 'PROFILE') === styles.navButtonActive ? 'page' : undefined}
                            onClick={() => handleNavigation('/profile')}
                        >
                            {isLoggedIn ? t('nav.profile') : t('nav.signIn')}
                        </button>
                    </div>

                    <button className={`${styles.burgerMenu} ${isMenuOpen ? styles.hidden : ''}`}
                            type="button"
                            onClick={toggleMenu}
                            aria-label={t('nav.openMenu')}
                            aria-expanded={isMenuOpen}
                            aria-controls="mobile-menu"
                            ref={burgerRef}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                             fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className={styles.navbarBottomBorder}/>
            </div>
            <div id="mobile-menu" className={`${styles.mobileMenu} ${isMenuOpen ? styles.open : ''}`}
                 role="dialog" aria-modal="true" aria-label={t('nav.menu')}
                 onKeyDown={(e) => { if (e.key === 'Escape') setIsMenuOpen(false); }}>
                <button className={styles.closeButton} type="button" onClick={toggleMenu} aria-label={t('nav.closeMenu')}
                        ref={closeMenuRef}>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div className={styles.mobileNavLinks}>
                    <button onClick={() => handleNavigation('/homepage')}>{t('nav.main')}</button>
                    <button onClick={() => handleNavigation('/shop')}>{t('nav.shop')}</button>
                    <button onClick={() => handleNavigation('/artists')}>{t('nav.artists')}</button>
                    <button onClick={() => handleNavigation('/commission')}>{t('nav.commission')}</button>
                    <button onClick={() => handleNavigation('/profile')}>{isLoggedIn ? t('nav.profile') : t('nav.signIn')}</button>
                    <LanguageSwitcher />
                </div>
            </div>
        </nav>
    );
}

export default Navbar;