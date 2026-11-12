import React, { useEffect, useMemo, useState } from 'react';
import styles from './Commission.module.css';
import CategoryFilters from "../CategoryFilters/CategoryFilters";
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters';
import Pagination from '../hooks/Pagination/Pagination';
import CommissionModalDetails from './CommissionModals/CommissionModalDetails';
import AddCommissionModal from './CommissionModals/AddCommissionModal';
import axios from 'axios';
import logo from '../../assets/logo.svg';
import { CATEGORIES } from '../../constants/categories';

const commissionFilterConfig = [
{ title: "SORT BY", options: [{ name: "NONE" }, { name: "RATING" }, { name: "LATEST" }, { name: "EXPENSIVE" }, { name: "CHEAP" }]},
{ title: "STYLE", options: [{ name: "NONE STYLE", subOptions: ["Retro Futurism", "Mid-Century", "Cyberpunk", "Synthwave"]}]},
{ title: "FORMAT", options: [{ name: "NONE", subOptions: ["PNG", "JPG", "JPEG", "SVG"]}]}
];

const categories = CATEGORIES;

function Commission() {
const [activeCategory, setActiveCategory] = useState(null);
const [searchQuery, setSearchQuery] = useState('');
const [showAdvanced, setShowAdvanced] = useState(false);
const itemsPerPage = 52;
const [selectedCommission, setSelectedCommission] = useState(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const [isAddModalOpen, setIsAddModalOpen] = useState(false);

const [commissions, setCommissions] = useState([]);
const [loading, setLoading] = useState(true);
const [currentPage, setCurrentPage] = useState(0);
const [totalPages, setTotalPages] = useState(0);

const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        axios.get(`/auth/check-session`)
            .then(res => {
                setIsLoggedIn(res.data.loggedIn);
            })
            .catch(() => {
                setIsLoggedIn(false);
            });
    }, []);

    useEffect(() => {
        const fetchCommissions = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/commissions/public`, {
                    params: {
                        page: currentPage + 1,
                        limit: itemsPerPage
                    }
                });

                if (response.data.success && Array.isArray(response.data.commissions)) {
                    const mapped = response.data.commissions.map(c => {
                        let imageSrc = c.imageUrl || c.Image || c.ReferenceImage || null;

                        if (imageSrc && typeof imageSrc === 'string') {
                            const s = imageSrc.trim();
                            if (s.startsWith('data:')) {
                                imageSrc = s;
                            } else {
                                const cleaned = s.replace(/(\r\n|\n|\r|\s)+/gm, "");
                                if (cleaned.length > 50 && /^[A-Za-z0-9+/=]+$/.test(cleaned)) {
                                    imageSrc = `data:image/png;base64,${cleaned}`;
                                } else {
                                    imageSrc = s;
                                }
                            }
                        } else {
                            imageSrc = null;
                        }

                        return {
                            id: c.Commission_ID || c.id,
                            title: c.Title || '',
                            description: c.Description || '',
                            price: c.Price || 0,
                            category: c.Category || '',
                            style: c.Style || '',
                            fileFormat: c.Format || '',
                            size: c.Size || '',
                            imageUrl: c.imageUrl || null,
                            imageSrc: imageSrc || "/images/placeholder.svg",
                            about: c.Description || '',
                            authorIcon: "/images/profileImg.jpg",
                        };
                    });

                    setCommissions(mapped);
                    setTotalPages(response.data.totalPages || 1);
                } else {
                    setCommissions([]);
                    setTotalPages(0);
                }
            } catch (error) {
                console.error("Error fetching commissions:", error);
                setCommissions([]);
                setTotalPages(0);
            } finally {
                setLoading(false);
            }
        };
        fetchCommissions();
    }, [currentPage, itemsPerPage]);

    const displayedCommissions = useMemo(() => {
        let items = commissions;
        if (activeCategory) {
            items = items.filter(c => (c.category || '').toUpperCase() === activeCategory.toUpperCase());
        }
        if (searchQuery) {
            items = items.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return items;
    }, [activeCategory, searchQuery, commissions]);

    useEffect(() => {
        if (isModalOpen || isAddModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isModalOpen, isAddModalOpen]);

    const handleCategoryClick = (category) => {
        if (activeCategory === category) {
            setActiveCategory(null);
        } else {
            setActiveCategory(category);
        }
        setCurrentPage(0);
    };

    const handleOpenModal = (commission) => {
        setSelectedCommission(commission);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCommission(null);
    };

    const handleOpenAddModal = () => {
        setIsAddModalOpen(true);
    };

    const handleCloseAddModal = () => {
        setIsAddModalOpen(false);
    };

    return (
        <div className={styles.commissionPage}>
            <div className={styles.contentWrapper}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.commissionTitle}>COMMISSION</h1>
                        <div className={styles.searchBarContainer}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Title of the art..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button className={styles.searchButton}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="black" strokeWidth="2" fill="none" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {isLoggedIn && (
                        <button className={styles.addCommissionButton} onClick={handleOpenAddModal}>
                            <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.4158 0C5.56994 0 0 5.56994 0 12.4158C0 19.2617 5.56994 24.8317 12.4158 24.8317C19.2617 24.8317 24.8317 19.2617 24.8317 12.4158C24.8317 5.56994 19.2617 0 12.4158 0ZM12.4158 1.91013C18.2293 1.91013 22.9216 6.60236 22.9216 12.4158C22.9216 18.2293 18.2293 22.9216 12.4158 22.9216C6.60236 22.9216 1.91013 18.2293 1.91013 12.4158C1.91013 6.60236 6.60236 1.91013 12.4158 1.91013ZM11.4608 6.68545V11.4608H6.68545V13.3709H11.4608V18.1462H13.3709V13.3709H18.1462V11.4608H13.3709V6.68545H11.4608Z" fill="white"/>
                            </svg>
                            ADD COMMISSION
                        </button>
                    )}
                </header>

                <div className={styles.filtersWrapper}>
                    <CategoryFilters
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategoryClick={handleCategoryClick}
                    />

                    <div className={styles.filtersContainer}>
                        <AdvancedFilters filterConfig={commissionFilterConfig} />
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingSpinnerContainer}>
                        <img src={logo} alt="Loading" className={styles.loadingLogo} />
                    </div>
                ) : (
                    displayedCommissions.length > 0 ? (
                        <>
                            <div className={styles.commissionGrid}>
                                {displayedCommissions.map(commission => (
                                    <div key={commission.id} className={styles.commissionCard}>
                                        <div className={styles.imagePriceWrapper}>
                                            <div className={styles.imageWrapper}>
                                                <img
                                                    src={commission.imageSrc || "/images/placeholder.svg"}
                                                    alt={commission.title || "Commission"}
                                                    className={styles.cardImage}
                                                    onError={(e) => { e.target.src = "/images/placeholder.svg"; }}
                                                />
                                            </div>
                                            <div className={styles.priceOverlay}>
                                                <span className={styles.cardPrice}>${commission.price}</span>
                                            </div>
                                        </div>
                                        <div className={styles.cardContent}>
                                            <div>
                                                <h3 className={styles.cardTitle}>{commission.title}</h3>
                                                <p className={styles.cardDescription}>{commission.description}</p>
                                            </div>
                                            <button
                                                className={styles.takeButton}
                                                onClick={() => handleOpenModal(commission)}
                                            >
                                                Take
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </>
                    ) : (
                        <div className={styles.noResults}>There are no commissions available at the moment</div>
                    )
                )}
            </div>

            {isAddModalOpen && (
                <AddCommissionModal onClose={handleCloseAddModal} />
            )}

            {isModalOpen && (
                <CommissionModalDetails
                    commission={selectedCommission}
                    onClose={handleCloseModal}
                    variant="detailed"
                />
            )}
        </div>
    );
}

export default Commission;