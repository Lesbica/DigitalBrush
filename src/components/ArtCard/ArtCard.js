import React from 'react';
import styles from './ArtCard.module.css';
import { useModal } from '../../context/ModalContext';
import { formatPrice } from '../../i18n/format';
import { useTranslation } from 'react-i18next';
import { onActivateKey } from '../Dialog/useDialog';

function ArtCard(props) {
    const { t } = useTranslation();
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
      <div
        className={styles.artCard}
        role="button"
        tabIndex={0}
        aria-label={t('art.openCard', { title, artist: artistName, price: formatPrice(price), likes })}
        onClick={handleClick}
        onKeyDown={onActivateKey(handleClick)}
      >
      <img
        className={styles.artCardImage}
        src={imageUrl || '/images/placeholder.svg'}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => { if (!e.currentTarget.src.endsWith('/images/placeholder.svg')) e.currentTarget.src = '/images/placeholder.svg'; }}
      />
      <div className={styles.artCardInfo}>
        <div className={styles.cardRow}>
          <span className={styles.artCardTitle}>{title}</span>
          <span className={styles.artCardLikes}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ArtCard;