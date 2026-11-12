import React from 'react';
import styles from './ArtCard.module.css';
import { useModal } from '../../context/ModalContext'; // Імпортуємо хук

function ArtCard(props) {
    const { openModal } = useModal(); // Дістаємо функцію відкриття

    const {
        art,
        imageUrl: imgProp,
        title: titleProp,
        artistName: artistNameProp,
        artistStyle: artistStyleProp,
        likes: likesProp,
        price: priceProp,
        // onArtClick видаляємо або залишаємо як опціональний callback, якщо треба
    } = props || {};

    const source = art || {
        imageUrl: imgProp,
        title: titleProp,
        artistName: artistNameProp,
        artistStyle: artistStyleProp,
        likes: likesProp,
        price: priceProp,
        // Важливо: переконайтеся, що тут є ID, якщо ви передаєте пропси окремо
        id: props.id
    };

    const {
        imageUrl = '/images/placeholder.svg',
        title = '',
        artistName = '',
        artistStyle = '',
    } = source;
    const price = (source && (source.price ?? source.Price)) ?? '';
    const likes = (source && (source.likes ?? source.Likes)) ?? '';

    // Обробник кліку
    const handleClick = () => {
        // Викликаємо глобальну модалку
        openModal(source);
    };

  return (
      <div className={styles.artCard} onClick={handleClick}>
      <img
        className={styles.artCardImage}
        src={imageUrl || '/images/placeholder.svg'}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={(e) => { if (!e.currentTarget.src.endsWith('/images/placeholder.svg')) e.currentTarget.src = '/images/placeholder.svg'; }}
      />
      <div className={styles.artCardInfo}>
        <div className={styles.cardRow}>
          <span className={styles.artCardTitle}>{title}</span>
          <span className={styles.artCardLikes}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {likes}
          </span>
        </div>
        <div className={styles.cardRow}>
          <div className={styles.artistInfo}>
            <span className={styles.artistName}>{artistName}</span>
            <span className={styles.artistStyle}>{artistStyle}</span>
          </div>
          <span className={styles.artCardPrice}>
            <svg width="17" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(5 0) scale(1.3333 1.3333) translate(-7 -3)">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-.9.6-1.75 2.1-1.75 1.7 0 2.2.8 2.3 2.1h2.1c-.1-1.7-1.1-3.2-3-3.8V3h-3v2.1c-1.9.5-3.1 1.9-3.1 3.8 0 2.2 1.8 3.4 4.5 4 2.8.6 3 1.3 3 2.2 0 1-.6 1.8-2.2 1.8-1.8 0-2.3-.9-2.4-2.1H7c.1 1.7 1.1 3.2 3.1 3.8V21h3v-2.1c1.9-.5 3.1-1.9 3.1-3.8 0-2.3-1.8-3.5-4.6-4.1z"/>
              </g>
            </svg>
            {price}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ArtCard;