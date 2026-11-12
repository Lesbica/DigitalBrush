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
const SocialIcon = ({ type }) => {
    const icons = {
        twitter: twitterIcon,
        facebook: facebookIcon,
        instagram: instagramIcon,
    };

    return (
        <a href="#" className={styles.socialIconLink}>
            <img
                src={icons[type]}
                alt={`${type} logo`}
                className={styles.socialIcon}
            />
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