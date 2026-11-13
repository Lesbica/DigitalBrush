import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./DigitalBrushProfile.module.css";
import MyImages from "./MyImages/MyImages";
import ProfileSettings from "./SettingsProfile/SettingsProfile";
import CommissionChat from "./MyCommission/CommissionChat/CommissionChat";
import Wallet from "./Wallet/Wallet";

import infoIcon from '../../../../assets/infoIcon.svg';
import globeIcon from '../../../../assets/icons/globeIcon.svg';
import heartIcon from '../../../../assets/icons/heartIcon.svg';
import userIcon from "../../../../assets/icons/userIcon.svg";
import pictureIcon from "../../../../assets/icons/pictureIcon.svg";
import calendarIcon from "../../../../assets/icons/calendarIcon.svg";
import comissionIcon from "../../../../assets/icons/comissionIcon.svg";
import walletIcon from "../../../../assets/icons/walletIcon.svg";
import closeIcon from "../../../../assets/closeCross.svg";
import plusIcon from "../../../../assets/icons/plusIcon.svg";
import MyCommission from "./MyCommission/MyCommission";
import AddArtModal from "../../../Shop/AddArtModal/AddArtModal";
import AddCommissionModal from "../../../Commission/CommissionModals/AddCommissionModal";
import { CATEGORIES } from '../../../../constants/categories';
import { SHOP_FILTERS } from '../../../../constants/filters';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../context/ToastContext';


const filterConfig = SHOP_FILTERS;

const categories = CATEGORIES;

function DigitalBrushProfile({ user, onLogout }) {
    const { t } = useTranslation();
    const toast = useToast();
    // Стан для відстеження поточної вкладки
    // Можливі варіанти: 'settings', 'images', 'commission', 'payment', 'calendar'
    const [activeTab, setActiveTab] = useState('images');
    const [showAddArtModal, setShowAddArtModal] = useState(false);
    const [showAddCommissionModal, setShowAddCommissionModal] = useState(false);
    const [activeChatCommissionId, setActiveChatCommissionId] = useState(null);

    const [totalLikes, setTotalLikes] = useState(0);

    // Links from notifications: /profile?commission=<id> opens that chat, /profile?tab=wallet a tab
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const commissionId = searchParams.get('commission');
        const tab = searchParams.get('tab');
        // back from linking a payout card on the WayForPay page
        const card = searchParams.get('card');
        if (card === 'ok') toast.success(t('wallet.card.ok'));
        else if (card === 'pending') toast.info(t('wallet.card.pending'));
        else if (card === 'fail') toast.error(t('wallet.card.fail'));
        if (commissionId) {
            setActiveChatCommissionId(Number(commissionId));
            setActiveTab('chat');
        } else if (tab && ['settings', 'images', 'purchases', 'commission', 'wallet'].includes(tab)) {
            setActiveTab(tab);
        }
        if (commissionId || tab) setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams, toast, t]);

    const handleOpenChat = (commissionId) => {
        setActiveChatCommissionId(commissionId);
        setActiveTab('chat');
    };

    const formatTags = (tags) => {
        if (!tags || tags.length === 0) return t('profile.notSpecified');
        if (Array.isArray(tags)) return tags.slice(0, 2).join('/'); // Беремо перші 2
        return tags; // Якщо це просто рядок
    };

    const handleOpenAddArt = (e) => {
        e.stopPropagation();
        setShowAddArtModal(true);
    };

    const handleOpenAddCommission = (e) => {
        e.stopPropagation();
        setShowAddCommissionModal(true);
    };

    const handleBackToCommissionList = () => {
        setActiveChatCommissionId(null);
        setActiveTab('commission');
    };

    // Функція для рендерингу правої частини
    const renderContent = () => {
        switch (activeTab) {
            case 'settings':
                return <ProfileSettings user={user} />;
            case 'images':
                return <MyImages user={user} onTotalLikesChange={setTotalLikes} />;
            case 'purchases':
                return <MyImages user={user} initialView="bought" />;
            case 'commission':
                return <MyCommission user={user} onOpenChat={handleOpenChat} />;
            case 'chat':
                return (
                    <CommissionChat
                        commissionId={activeChatCommissionId}
                        user={user}
                        onBack={handleBackToCommissionList}
                    />
                );
            case 'wallet':
                return <Wallet />;
            case 'calendar':
                return <div className={styles.placeholder}>Calendar Component (Coming Soon)</div>;
            default:
                return <MyImages user={user} />;
        }
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.contentWrapper}>

                {/* --- ЛІВА ЧАСТИНА (SIDEBAR) --- */}
                <aside className={styles.sidebar}>
                    <div className={styles.avatarContainer}>
                        <img
                            src={user.profileImage || "/images/profileImg.jpg"}
                            alt={user.name}
                            className={styles.avatar}
                        />
                    </div>

                    <div>
                        <h1 className={styles.artistName}>
                            {user.name}
                            {user.role === 'artist' && (
                                <span className={styles.status}>({t(`availability.${['busy', 'vacation'].includes(user.availability) ? user.availability : 'open'}`)})</span>
                            )}
                        </h1>
                    </div>

                    <div className={styles.metaInfo}>
                        <div className={styles.metaRow}>
                            <img src={infoIcon} alt="Style" className={styles.socialicon} />
                            {/* Відображаємо стилі з об'єкта user */}
                            <span>{formatTags(user.styles)}</span>
                        </div>
                        <div className={styles.metaRow}>
                            <img src={globeIcon} alt="Country" className={styles.socialicon} />
                            {/* Відображаємо мови з об'єкта user */}
                            <span>{formatTags(user.languages)}</span>
                        </div>
                        <div className={styles.metaRow}>
                            <img src={heartIcon} alt={t('artists.likes')} className={styles.socialicon} />
                            {/* Показуємо сумарні лайки, обчислені на фронті */}
                            <span>{totalLikes}</span>
                        </div>
                    </div>

                    <p className={styles.bio}>
                        {user.bio || t('profile.noBio')}
                    </p>

                    {/* КНОПКИ З ЛОГІКОЮ АКТИВНОГО СТАНУ */}
                    <div className={styles.actionButtonsContainer}>

                        <button
                            className={`${styles.profileSettingsBtn} ${activeTab === 'settings' ? styles.active : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            <img src={userIcon} alt="" className={styles.btnicon} />
                            {t('profile.settings')}
                        </button>

                        <div className={styles.tabWithAction}>
                            <button
                                className={`${styles.imagesBtn} ${activeTab === 'images' ? styles.active : ''}`}
                                onClick={() => setActiveTab('images')}
                                aria-current={activeTab === 'images' ? 'page' : undefined}
                            >
                                <img src={pictureIcon} alt="" className={styles.btnicon} />
                                {t('profile.myImages')}
                            </button>
                            <button type="button" className={styles.plusButton} onClick={handleOpenAddArt} aria-label={t('shop.addImage')}>
                                <img src={plusIcon} alt="" />
                            </button>
                        </div>

                        <div className={styles.tabWithAction}>
                            <button
                                className={`${styles.comissionBtn} ${activeTab === 'commission' ? styles.active : ''}`}
                                onClick={() => setActiveTab('commission')}
                                aria-current={activeTab === 'commission' ? 'page' : undefined}
                            >
                                <img src={comissionIcon} alt="" className={styles.btnicon} />
                                {t('profile.myCommissions')}
                            </button>
                            <button type="button" className={styles.plusButton} onClick={handleOpenAddCommission} aria-label={t('commissions.add')}>
                                <img src={plusIcon} alt="" />
                            </button>
                        </div>

                        <button
                            className={`${styles.paymentBtn} ${activeTab === 'wallet' ? styles.active : ''}`}
                            onClick={() => setActiveTab('wallet')}
                        >
                            <img src={walletIcon} alt="" className={styles.btnicon} />
                            {t('profile.wallet')}
                        </button>

                        <button
                            className={`${styles.calendarBtn} ${activeTab === 'calendar' ? styles.active : ''}`}
                            onClick={() => setActiveTab('calendar')}
                        >
                            <img src={calendarIcon} alt="" className={styles.btnicon} />
                            {t('profile.calendar')}
                        </button>

                        <button className={styles.logoutBtn} onClick={onLogout}>
                            <img src={closeIcon} alt="" className={styles.btnicon} />
                            {t('profile.logout')}
                        </button>
                    </div>
                </aside>

                {/* --- ПРАВА ЧАСТИНА (ЗМІННИЙ КОНТЕНТ) --- */}
                <section className={styles.gallerySection}>
                    {renderContent()}
                </section>
            </div>

            {showAddArtModal && (
                <AddArtModal
                    onClose={() => setShowAddArtModal(false)}
                    categories={categories}       // Переконайтеся, що ці дані приходять у DigitalBrushProfile
                    filterConfig={filterConfig}   // або передайте сюди дефолтні значення
                />
            )}

            {showAddCommissionModal && (
                <AddCommissionModal
                    onClose={() => setShowAddCommissionModal(false)}
                    targetCreatorId={null}
                />
            )}
        </div>
    );
}

export default DigitalBrushProfile;