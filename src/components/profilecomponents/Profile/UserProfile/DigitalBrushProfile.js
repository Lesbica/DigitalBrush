import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import styles from "./DigitalBrushProfile.module.css";
import MyImages from "./MyImages/MyImages";
import ProfileSettings from "./SettingsProfile/SettingsProfile";
import CommissionChat from "./MyCommission/CommissionChat/CommissionChat";
import Wallet from "./Wallet/Wallet";
import MyCommission from "./MyCommission/MyCommission";
import AddArtModal from "../../../Shop/AddArtModal/AddArtModal";
import AddCommissionModal from "../../../Commission/CommissionModals/AddCommissionModal";
import { CATEGORIES } from '../../../../constants/categories';
import { SHOP_FILTERS } from '../../../../constants/filters';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../context/ToastContext';
import { formatPrice } from '../../../../i18n/format';
import { BrushIcon, ImageIcon, BagIcon, WalletIcon, SettingsIcon, LogoutIcon, PlusIcon } from '../../../Icons/Icons';

const WORK_STAGES = ['Sketch', 'Lineart', 'Color', 'Final'];
const TABS = ['settings', 'images', 'purchases', 'commission', 'wallet'];

// Numbers for the cards above the content: earnings for artists, orders for everyone
function useOverview(user) {
    const [overview, setOverview] = useState(null);
    useEffect(() => {
        let alive = true;
        const isArtist = user.role === 'artist';
        Promise.allSettled([
            axios.get('/commissions/my'),
            isArtist ? axios.get('/wallet') : axios.get('/profile/getboughtpaintings'),
        ]).then(([orders, second]) => {
            if (!alive) return;
            const list = orders.status === 'fulfilled' ? orders.value.data.commissions || [] : [];
            const mine = (c, key) => Number(c[key]) === Number(user.id);
            const active = list.filter((c) => WORK_STAGES.includes(c.Status || c.status));
            setOverview({
                active: active.length,
                // the customer has to approve a submitted stage; the artist waits for that
                toReview: active.filter((c) => c.Review_State === 'pending' && mine(c, 'Customer_ID')).length,
                awaitingCustomer: active.filter((c) => c.Review_State === 'pending' && mine(c, 'Creator_ID')).length,
                newOrders: list.filter((c) => (c.Status || c.status) === 'Open' && mine(c, 'Creator_ID')).length,
                openRequests: list.filter((c) => (c.Status || c.status) === 'Open' && mine(c, 'Customer_ID')).length,
                balance: isArtist && second.status === 'fulfilled' ? second.value.data.balance : null,
                purchases: !isArtist && second.status === 'fulfilled' ? (second.value.data.paintings || []).length : null,
            });
        });
        return () => { alive = false; };
    }, [user.id, user.role]);
    return overview;
}

function DigitalBrushProfile({ user, onLogout }) {
    const { t } = useTranslation();
    const toast = useToast();
    const isArtist = user.role === 'artist';
    const [activeTab, setActiveTab] = useState(isArtist ? 'images' : 'commission');
    const [showAddArtModal, setShowAddArtModal] = useState(false);
    const [showAddCommissionModal, setShowAddCommissionModal] = useState(false);
    const [activeChatCommissionId, setActiveChatCommissionId] = useState(null);
    const overview = useOverview(user);

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
        } else if (tab && TABS.includes(tab)) {
            setActiveTab(tab);
        }
        if (commissionId || tab) setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams, toast, t]);

    const handleOpenChat = (commissionId) => {
        setActiveChatCommissionId(commissionId);
        setActiveTab('chat');
    };

    const handleBackToCommissionList = () => {
        setActiveChatCommissionId(null);
        setActiveTab('commission');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'settings':
                return <ProfileSettings user={user} />;
            case 'purchases':
                return <MyImages user={user} initialView="bought" />;
            case 'commission':
                return <MyCommission user={user} onOpenChat={handleOpenChat} />;
            case 'chat':
                return <CommissionChat commissionId={activeChatCommissionId} user={user} onBack={handleBackToCommissionList} />;
            case 'wallet':
                return <Wallet />;
            case 'images':
            default:
                return <MyImages user={user} />;
        }
    };

    const commissionBadge = overview ? (isArtist ? overview.newOrders : overview.toReview) : 0;
    const menu = [
        { key: 'commission', icon: BrushIcon, label: t('profile.myCommissions'), badge: commissionBadge || null, current: ['commission', 'chat'],
          action: { label: t('commissions.add'), onClick: () => setShowAddCommissionModal(true) } },
        isArtist && { key: 'images', icon: ImageIcon, label: t('profile.myImages'),
          action: { label: t('shop.addImage'), onClick: () => setShowAddArtModal(true) } },
        { key: 'purchases', icon: BagIcon, label: t('profile.purchases'), count: overview?.purchases ?? null },
        isArtist && { key: 'wallet', icon: WalletIcon, label: t('profile.wallet') },
        { key: 'settings', icon: SettingsIcon, label: t('profile.settings') },
    ].filter(Boolean);

    const stats = !overview ? [] : isArtist ? [
        { label: t('profile.overview.available'), value: formatPrice(overview.balance?.available ?? 0), hint: t('profile.overview.availableHint'), accent: true, tab: 'wallet' },
        { label: t('profile.overview.onHold'), value: formatPrice(overview.balance?.escrow ?? 0), hint: t('profile.overview.onHoldHint'), tab: 'wallet' },
        { label: t('profile.overview.active'), value: overview.active, hint: t('profile.overview.awaitingCustomer', { count: overview.awaitingCustomer }), tab: 'commission' },
    ] : [
        { label: t('profile.overview.active'), value: overview.active, hint: t('profile.overview.toReview', { count: overview.toReview }), accent: overview.toReview > 0, tab: 'commission' },
        { label: t('profile.overview.openRequests'), value: overview.openRequests, hint: t('profile.overview.openRequestsHint'), tab: 'commission' },
        { label: t('profile.overview.purchases'), value: overview.purchases ?? 0, hint: t('profile.overview.purchasesHint'), tab: 'purchases' },
    ];

    const availability = ['busy', 'vacation'].includes(user.availability) ? user.availability : 'open';

    return (
        <div className={styles.pageContainer}>
            <div className={styles.contentWrapper}>
                <aside className={`glass ${styles.sidebar}`}>
                    <div className={styles.identity}>
                        <img src={user.profileImage || "/images/profileImg.jpg"} alt="" className={styles.avatar} />
                        <div className={styles.identityText}>
                            <h1 className={styles.userName}>{user.name}</h1>
                            <span className={styles.role}>
                                {isArtist ? t(`author.availability.${availability}`) : t('profile.customer')}
                            </span>
                        </div>
                    </div>

                    <nav className={styles.menu} aria-label={t('profile.menu')}>
                        {menu.map(({ key, icon: Icon, label, badge, count, current, action }) => {
                            const isCurrent = (current || [key]).includes(activeTab);
                            return (
                                <div key={key} className={styles.menuRow}>
                                    <button type="button" className={`${styles.menuItem} ${isCurrent ? styles.active : ''}`}
                                            aria-current={isCurrent ? 'page' : undefined} onClick={() => setActiveTab(key)}>
                                        <Icon size={19} />
                                        <span className={styles.menuLabel}>{label}</span>
                                        {badge ? <span className={styles.badge}>{t('profile.newBadge', { count: badge })}</span> : null}
                                        {count != null && !badge ? <span className={styles.count}>{count}</span> : null}
                                    </button>
                                    {action && (
                                        <button type="button" className={styles.menuAction} onClick={action.onClick} aria-label={action.label} title={action.label}>
                                            <PlusIcon size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        <button type="button" className={`${styles.menuItem} ${styles.logout}`} onClick={onLogout}>
                            <LogoutIcon size={19} />
                            <span className={styles.menuLabel}>{t('profile.logout')}</span>
                        </button>
                    </nav>
                </aside>

                <div className={styles.main}>
                    {stats.length > 0 && (
                        <ul className={styles.stats} aria-label={t('profile.overview.label')}>
                            {stats.map((s) => (
                                <li key={s.label}>
                                    <button type="button" className={`glass ${styles.stat} ${s.accent ? styles.statAccent : ''}`} onClick={() => setActiveTab(s.tab)}>
                                        <span className={styles.statLabel}>{s.label}</span>
                                        <strong className={styles.statValue}>{s.value}</strong>
                                        <span className={styles.statHint}>{s.hint}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <section className={`glass ${styles.gallerySection}`}>
                        {renderContent()}
                    </section>
                </div>
            </div>

            {showAddArtModal && (
                <AddArtModal onClose={() => setShowAddArtModal(false)} categories={CATEGORIES} filterConfig={SHOP_FILTERS} />
            )}

            {showAddCommissionModal && (
                <AddCommissionModal onClose={() => setShowAddCommissionModal(false)} targetCreatorId={null} />
            )}
        </div>
    );
}

export default DigitalBrushProfile;
