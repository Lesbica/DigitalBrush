import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './MyCommission.module.css';
import CategoryFilters from "../../../../CategoryFilters/CategoryFilters";
import CommissionModalDetails from "../../../../Commission/CommissionModals/CommissionModalDetails";
import logo from '../../../../../assets/logo.svg'
import { useSocket } from '../../../../../context/SocketContext';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../../../../i18n/format';

const commissionFilters = ['MY ORDERS', 'MY TASKS'];

function MyCommission({ user, onOpenChat}) {
    const { t } = useTranslation();
    const currentUserId = Number(user?.id) || null;
    const socket = useSocket();

    const [activeFilter, setActiveFilter] = useState('MY ORDERS');
    const [commissions, setCommissions] = useState([]);
    const [selectedCommission, setSelectedCommission] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleCardClick = (item) => {
        const creatorId = item.Creator_ID || item.creator_id;
        const statusRaw = item.Status || item.status || '';
        const status = statusRaw.toLowerCase();

        console.log("Card Click info:", {
            id: item.Commission_ID,
            creatorId: creatorId,
            status: status
        });
        const isTaken = (creatorId && status !== 'open' && status !== 'search') ||
            (status === 'in_progress' || status === 'edits' || status === 'completed');

        if (status === 'open') {
            // Open: the addressed artist can accept/decline, the customer can cancel
            setSelectedCommission({
                ...prepareModalData(item),
                respond: Number(creatorId) === Number(currentUserId),
                cancel: Number(item.Customer_ID) === Number(currentUserId) && !item.is_paid,
            });
        } else if (isTaken) {
            console.log("Action: Opening Chat");
            if (onOpenChat) {
                onOpenChat(item.Commission_ID || item.id);
            }
        } else {
            console.log("Action: Opening Modal Details");
            setSelectedCommission(prepareModalData(item));
        }
    };

    useEffect(() => {
        if (!currentUserId) return;

        setIsLoading(true);
        axios.get(`/commissions/my`)
            .then(response => {
                if (response.data.success) {
                    setCommissions(response.data.commissions);
                }
            })
            .catch(error => {
                console.error("Error fetching my commissions:", error);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [currentUserId]);

    const handleFilterClick = (category) => {
        setActiveFilter(category);
    };

    const displayedCommissions = commissions.filter(item => {
        const itemCustomerId = Number(item.Customer_ID);
        const itemCreatorId = Number(item.Creator_ID);

        if (activeFilter === 'MY ORDERS') {
            return itemCustomerId === currentUserId;
        } else if (activeFilter === 'MY TASKS') {
            return itemCreatorId === currentUserId;
        }
        return false;
    });

    const getFilledDotsCount = (status) => {
        const s = String(status || '').toLowerCase();
        // Новый enum: open -> 0, sketch -> 1, edits -> 2, completed -> 3, cancelled -> 0 (без прогресса)
        // lineart/color/final share the middle dot
        if (s === 'sketch') return 1;
        if (s === 'lineart' || s === 'color' || s === 'final') return 2;
        if (s === 'completed') return 3;
        return 0; // open/cancelled/unknown
    };

    // ОНОВЛЕНА ФУНКЦІЯ RENDER DOTS
    const renderDots = (status) => {
        const filledCount = getFilledDotsCount(status);
        const dots = [];
        for (let i = 0; i < 3; i++) {
            // Визначаємо стиль для кожної конкретної крапки
            let specificClass = '';
            if (i === 0) specificClass = styles.dotFirst;
            if (i === 1) specificClass = styles.dotSecond;
            if (i === 2) specificClass = styles.dotThird;

            dots.push(
                <div
                    key={i}
                    className={`${styles.dot} ${specificClass} ${i < filledCount ? styles.filled : ''}`}
                ></div>
            );
        }
        return <div className={styles.dotsContainer}>{dots}</div>;
    };

    const prepareModalData = (item) => {
        return {
            id: item.Commission_ID,
            title: item.Title,
            description: item.Description,
            price: item.Price,
            imageUrl: item.ReferenceImage, // Це поле ми обробили на бекенді
            category: item.Category || "",
            style: item.Style || "",
            fileFormat: item.Format || "",
            size: item.Size || "",
            // Додаємо статус, якщо потрібно відобразити в модалці
            status: item.Status
        };
    };

    // Live-обновление статусов через сокет
    useEffect(() => {
        if (!socket) return undefined;
        const onStatusUpdated = (payload) => {
            if (!payload || !payload.commissionId) return;
            setCommissions(prev => prev.map(c =>
                Number(c.Commission_ID) === Number(payload.commissionId)
                    ? { ...c, Status: payload.status, status: payload.status }
                    : c
            ));
        };

        socket.on('statusUpdated', onStatusUpdated);
        return () => socket.off('statusUpdated', onStatusUpdated);
    }, [socket]);

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    {/* Використовуйте ваш лоадер або просто текст */}
                    <img src={logo} alt="Loading..."  className={styles.loadingLogo}/>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.filtersWrapper}>
                <CategoryFilters
                    categories={commissionFilters}
                    activeCategory={activeFilter}
                    onCategoryClick={handleFilterClick}
                />
            </div>

            {displayedCommissions.length > 0 ? (
                <div className={styles.commissionGrid}>
                    {displayedCommissions.map((item) => (
                        <div key={item.Commission_ID} className={styles.commissionCard}
                             onClick={() => handleCardClick(item)}
                             style={{ cursor: 'pointer' }}>
                            <div className={styles.imagePriceWrapper}>
                                <div className={styles.imageWrapper}>
                                    <img
                                        src={item.ReferenceImage || "/images/placeholder.svg"}
                                        alt={item.Title}
                                        className={styles.cardImage}
                                        onError={(e) => { e.target.src = "/images/placeholder.svg"; }}
                                    />
                                </div>
                                <div className={styles.priceOverlay}>
                                    <span className={styles.cardPrice}>{formatPrice(item.Price)}</span>
                                </div>
                            </div>

                            <div className={styles.cardContent}>
                                <div className={styles.textContent}>
                                    <h3 className={styles.cardTitle}>{item.Title}</h3>
                                    <p className={styles.cardDescription}>{item.Description}</p>
                                </div>

                                <div className={styles.statusRow}>
                                    <span className={styles.statusLabel}>
                                        {t(`status.${item.Status || item.status || 'Unknown'}`, { defaultValue: item.Status || item.status })}
                                    </span>
                                    {renderDots(item.Status || item.status)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.noResults}>
                    {activeFilter === 'MY ORDERS' ? t('profile.noOrders') : t('profile.noTasks')}
                </div>
            )}

            {selectedCommission && (
                <CommissionModalDetails
                    commission={selectedCommission}
                    disableTake
                    respondAsArtist={Boolean(selectedCommission.respond)}
                    canCancel={Boolean(selectedCommission.cancel)}
                    onStatusChange={(newStatus) => setCommissions(prev => prev.map(c =>
                        (c.Commission_ID === selectedCommission.id ? { ...c, Status: newStatus, status: newStatus } : c)))}
                    onClose={() => setSelectedCommission(null)}
                />
            )}
        </div>
    );
}

export default MyCommission;