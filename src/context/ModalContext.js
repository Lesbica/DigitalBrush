import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';
import ArtDetailsModal from '../components/ArtCard/Modals/ArtDetailsModal';

const ModalContext = createContext();

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children, isLoggedIn }) => {
    const [selectedArt, setSelectedArt] = useState(null);
    const [loading, setLoading] = useState(false);

    // Функція відкриття. Приймає базові дані з картки (id, title, image),
    // щоб показати щось одразу, поки вантажаться деталі.
    const openModal = async (basicArtData) => {
        // 1. Спочатку показуємо те, що є (базові дані з картки)
        setSelectedArt({
            ...basicArtData,
            images: [basicArtData.imageUrl] // Тимчасово, поки не завантажимо галерею
        });

        // 2. Якщо є ID, дозавантажуємо повну інформацію (галерею, батчі)
        if (basicArtData.id) {
            setLoading(true);
            try {
                const res = await axios.get(`/paintings/${basicArtData.id}`);

                if (res.data.success) {
                    const p = res.data.painting;
                    const allImages = [];
                    if (p.mainImage) allImages.push(p.mainImage);
                    if (p.gallery && p.gallery.length) allImages.push(...p.gallery);

                    // 3. Оновлюємо стан повними даними
                    setSelectedArt(prev => ({
                        ...prev, // Зберігаємо попередні поля
                        ...basicArtData, // Пріоритет базовим даним (щоб не стрибало зображення)
                        images: allImages.length > 0 ? allImages : [basicArtData.imageUrl],
                        title: p.title,
                        artistName: p.author_name,
                        artistId: p.artistId || p.Creator_ID || p.creator_id,
                        description: p.description,
                        price: p.price,
                        style: p.style,
                        // Лайки та стан лайку користувача
                        likes: p.likes ?? p.Likes ?? prev?.likes ?? 0,
                        likedByCurrentUser: !!p.likedByCurrentUser,
                        // Нові поля з БД
                        category: p.category ?? prev?.category,
                        fileFormat: p.format ?? prev?.fileFormat,
                        size: p.size || ((p.width && p.height) ? `${p.width}x${p.height}` : prev?.size),
                        width: p.width ?? prev?.width,
                        height: p.height ?? prev?.height,
                        creationDate: p.creationDate ?? p.Creation_Date ?? prev?.creationDate,
                        authorAvatar: p.author_avatar ?? prev?.authorAvatar
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch full painting details:", err);
            } finally {
                setLoading(false);
            }
        }
    };

    const closeModal = () => {
        setSelectedArt(null);
    };

    return (
        <ModalContext.Provider value={{ openModal, closeModal }}>
            {children}
            {selectedArt && (
                <ArtDetailsModal
                    art={selectedArt}
                    onClose={closeModal}
                    isLoggedIn={isLoggedIn}
                />
            )}
        </ModalContext.Provider>
    );
};