import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import styles from "./MyImages.module.css";
import ArtCard from "../../../../ArtCard/ArtCard";
import CategoryFilters from "../../../../CategoryFilters/CategoryFilters";
import Pagination from "../../../../hooks/Pagination/Pagination";
import { usePagination } from "../../../../hooks/Pagination/usePagination";

function MyImages({ user, onTotalLikesChange, initialView = 'created' }) {
    const [paintings, setPaintings] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [viewMode, setViewMode] = useState(initialView); // 'created' | 'bought'
    const itemsPerPage = 24;
    const viewFilters = ['MyImages', 'BoughtImages'];

    // Логіка завантаження перенесена сюди
    useEffect(() => {
        const fetchPaintings = async () => {
            try {
                // Выбираем URL в зависимости от режима
                // Use relative paths with axios.defaults.baseURL = 'http://localhost:8080/api'
                const url = viewMode === 'created'
                    ? "/profile/getuserpaintings"
                    : "/profile/getboughtpaintings";

                const response = await axios.get(url);
                if (response.data.success) {
                    const list = response.data.paintings || [];
                    setPaintings(list);

                    // Считаем лайки только для собственных картин (опционально)
                    if (viewMode === 'created' && typeof onTotalLikesChange === 'function') {
                        const total = list.reduce((sum, p) => sum + (Number(p.likes ?? p.Likes) || 0), 0);
                        onTotalLikesChange(total);
                    }
                } else {
                    console.error("Failed to load paintings:", response.data.message);
                }
            } catch (err) {
                console.error("Error fetching paintings:", err);
            }
        };

        if (user) {
            fetchPaintings();
        }
    }, [user, viewMode, onTotalLikesChange]);

    // Перераховуємо суму лайків при зміні локального списку картин
    useEffect(() => {
        if (typeof onTotalLikesChange === 'function') {
            const total = (paintings || []).reduce((sum, p) => sum + (Number(p.likes ?? p.Likes) || 0), 0);
            onTotalLikesChange(total);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paintings]);

    const handleCategoryClick = (category) => {
        if (activeCategory === category) {
            setActiveCategory(null);
        } else {
            setActiveCategory(category);
        }
        setCurrentPage(0);
    };

    // Обработчик для переключения между MyImages / BoughtImages через CategoryFilters
    const handleViewFilterClick = (filter) => {
        if (!filter) return; // не допускаем состояния без выбранной вкладки
        const nextMode = filter === 'BoughtImages' ? 'bought' : 'created';
        if (nextMode !== viewMode) {
            setViewMode(nextMode);
            setActiveCategory(null); // сброс категорий при смене источника
            setCurrentPage(0);
        }
    };

    const filteredPaintings = useMemo(() => {
        if (!activeCategory) {
            return paintings;
        }
        return paintings.filter(painting =>
            (painting.style || "").toUpperCase().includes(activeCategory.toUpperCase())
        );
    }, [paintings, activeCategory]);

    const {
        currentPage,
        setCurrentPage,
        totalPages,
        displayedData
    } = usePagination(filteredPaintings, itemsPerPage);

    useEffect(() => {
        setCurrentPage(0);
    }, [activeCategory, setCurrentPage]);

    return (
        <div className={styles.galleryContainer}>
            {/* Переключатель MyImages / BoughtImages через общий компонент CategoryFilters */}
            <div className={styles.viewSwitch}>
                <CategoryFilters
                    categories={viewFilters}
                    activeCategory={viewMode === 'created' ? 'MyImages' : 'BoughtImages'}
                    onCategoryClick={handleViewFilterClick}
                />
            </div>

            {/*/!* Фільтри *!/*/}
            {/*<div className={styles.topControls}>*/}
            {/*    <CategoryFilters*/}
            {/*        categories={profileCategories}*/}
            {/*        activeCategory={activeCategory}*/}
            {/*        onCategoryClick={handleCategoryClick}*/}
            {/*    />*/}
            {/*    <AdvancedFilters filterConfig={additionalFilterConfig} />*/}
            {/*</div>*/}

            {/* Сітка */}
            <div className={styles.artGrid}>
                {displayedData.length > 0 ? (
                    displayedData.map((painting) => (
                        <ArtCard
                            key={painting.id}
                            art={{
                                id: painting.id,
                                title: painting.title,
                                imageUrl: painting.image_url,
                                price: painting.price,
                                artistName: painting.artistName || user.name,
                                likes: (painting.likes ?? painting.Likes ?? 0),
                                artistId: painting.artistId || user.id,
                                category: painting.Category,
                                style: painting.style
                            }}
                        />
                    ))
                ) : (
                    <div className={styles.noArtworks}>
                        {viewMode === 'created'
                            ? "You haven't uploaded any artworks yet."
                            : "You haven't bought any artworks yet."}
                    </div>
                )}
            </div>

            {/* Пагінація */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </div>
    );
}

export default MyImages;