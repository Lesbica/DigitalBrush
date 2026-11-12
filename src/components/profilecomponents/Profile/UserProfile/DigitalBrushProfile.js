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


const filterConfig = [
    { title: "SORT BY", options: [{ name: "NONE" }, { name: "RATING" }, { name: "LATEST" }, { name: "EXPENSIVE" }, { name: "CHEAP" }]},
    { title: "STYLE", options: [{ name: "NONE STYLE", subOptions: [
                "Retro Futurism", "Mid-Century", "Modern, Art Deco", "Bauhaus, Y2K", "Aesthetic", "Memphis Style",
                "Grunge", "Psychedelic Art", "Surrealism, Neo-Psychedelia, Op Art", "Dreamcore", "Weirdcore",
                "Hyperrealism", "Social Realism", "Digital Realism", "Cinematic Realism", "Cyberpunk",
                "Synthwave", "Vaporwave", "Minimalism", "Brutalism", "Postmodern", "Collage."
            ] }]}
];

const categories = CATEGORIES;

function DigitalBrushProfile({ user, onLogout }) {
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
        if (commissionId) {
            setActiveChatCommissionId(Number(commissionId));
            setActiveTab('chat');
        } else if (tab && ['settings', 'images', 'commission', 'wallet'].includes(tab)) {
            setActiveTab(tab);
        }
        if (commissionId || tab) setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams]);

    const handleOpenChat = (commissionId) => {
        setActiveChatCommissionId(commissionId);
        setActiveTab('chat');
    };

    const formatTags = (tags) => {
        if (!tags || tags.length === 0) return "Not specified";
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
                            {user.name || "Artist"}
                            <span className={styles.status}>(available)</span>
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
                            <img src={heartIcon} alt="Likes" className={styles.socialicon} />
                            {/* Показуємо сумарні лайки, обчислені на фронті */}
                            <span>{totalLikes}</span>
                        </div>
                    </div>

                    <p className={styles.bio}>
                        {user.bio || "Welcome to my profile! No description provided yet."}
                    </p>

                    {/* КНОПКИ З ЛОГІКОЮ АКТИВНОГО СТАНУ */}
                    <div className={styles.actionButtonsContainer}>

                        <button
                            className={`${styles.profileSettingsBtn} ${activeTab === 'settings' ? styles.active : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            <img src={userIcon} alt="UserIcon" className={styles.btnicon} />
                            Settings profile
                        </button>

                        <button
                            className={`${styles.imagesBtn} ${activeTab === 'images' ? styles.active : ''}`}
                            onClick={() => setActiveTab('images')}
                        >
                            <img src={pictureIcon} alt="PictureIcon" className={styles.btnicon} />
                            My images
                            <img src={plusIcon} alt="PlusIcon" className={styles.plusIcon}
                                 onClick={handleOpenAddArt}
                            />
                        </button>

                        <button
                            className={`${styles.comissionBtn} ${activeTab === 'commission' ? styles.active : ''}`}
                            onClick={() => setActiveTab('commission')}
                        >
                            <img src={comissionIcon} alt="ComissionIcon" className={styles.btnicon} />
                            My Commission
                            <img src={plusIcon} alt="PlusIcon" className={styles.plusIcon} onClick={handleOpenAddCommission}/>
                        </button>

                        <button
                            className={`${styles.paymentBtn} ${activeTab === 'wallet' ? styles.active : ''}`}
                            onClick={() => setActiveTab('wallet')}
                        >
                            <img src={walletIcon} alt="PaymentIcon" className={styles.btnicon} />
                            Payment
                        </button>

                        <button
                            className={`${styles.calendarBtn} ${activeTab === 'calendar' ? styles.active : ''}`}
                            onClick={() => setActiveTab('calendar')}
                        >
                            <img src={calendarIcon} alt="CalendarIcon" className={styles.btnicon} />
                            Calendar
                        </button>

                        <button className={styles.logoutBtn} onClick={onLogout}>
                            <img src={closeIcon} alt="LogoutIcon" className={styles.btnicon} />
                            Log out
                        </button>
                    </div>
                </aside>

                {/* --- ПРАВА ЧАСТИНА (ЗМІННИЙ КОНТЕНТ) --- */}
                <main className={styles.gallerySection}>
                    {renderContent()}
                </main>
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