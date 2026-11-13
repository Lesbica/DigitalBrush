import React from 'react';
import styles from './Footer.module.css';
import twitterIcon from '../../assets/twitterIcon.svg';
import instagramIcon from '../../assets/instagram-icon.svg';
import facebookIcon from '../../assets/icons/facebook-icon.svg';
import { useTranslation } from 'react-i18next';

/*
 * Цей компонент SocialIcon використовує <img> теги,
 * щоб показувати повноколірні логотипи.
*/
const SOCIAL = {
    twitter: { icon: twitterIcon, name: 'X (Twitter)', url: import.meta.env.VITE_SOCIAL_TWITTER },
    facebook: { icon: facebookIcon, name: 'Facebook', url: import.meta.env.VITE_SOCIAL_FACEBOOK },
    instagram: { icon: instagramIcon, name: 'Instagram', url: import.meta.env.VITE_SOCIAL_INSTAGRAM },
};

// A link only when the account address is configured (VITE_SOCIAL_*); otherwise just the named icon
const SocialIcon = ({ type }) => {
    const { t } = useTranslation();
    const { icon, name, url } = SOCIAL[type];
    if (!url) {
        return (
            <span className={styles.socialIconLink} title={t('footer.social', { name })}>
                <img src={icon} alt={t('footer.social', { name })} className={styles.socialIcon} />
            </span>
        );
    }
    return (
        <a href={url} className={styles.socialIconLink} target="_blank" rel="noopener noreferrer">
            <img src={icon} alt={name} className={styles.socialIcon} />
        </a>
    );
};


function Footer() {
    const { t } = useTranslation();
    return (
        <footer className={styles.footer}>
            <div className={styles.footerTop}>
                <div className={styles.footerContainer}>
                    <div className={styles.footerLeft}>
                        <div className={styles.footerLogo}>Digital Brush</div>
                        <p className={styles.footerText}>{t('footer.about')}</p>
                    </div>
                    <div className={styles.footerRight}>
                        <div className={styles.footerContact}>
                            <p>{t('footer.contact')}</p>
                            <a href="mailto:digital_brush@gmail.com">digital_brush@gmail.com</a>
                        </div>
                        <div className={styles.footerSocial}>
                            <p>{t('footer.follow')}</p>
                            <div className={styles.socialIconsContainer}>
                                <SocialIcon type="twitter" />
                                <SocialIcon type="facebook" />
                                <SocialIcon type="instagram" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.footerBottom}>
                <p>2025</p>
            </div>
        </footer>
    );
}

export default Footer;