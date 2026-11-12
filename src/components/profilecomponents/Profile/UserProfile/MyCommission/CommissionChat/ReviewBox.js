import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

// Review of a completed commission: the customer rates it once (1–5 stars + optional text).
export default function ReviewBox({ commission, onSaved }) {
    const { t } = useTranslation();
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (commission.review) {
        return (
            <div style={boxStyle}>
                <div style={{ color: '#ffc94d', letterSpacing: 2 }}>
                    {'★'.repeat(commission.review.rating)}{'☆'.repeat(5 - commission.review.rating)}
                </div>
                {commission.review.text && <div style={{ fontSize: 13, opacity: 0.9 }}>{commission.review.text}</div>}
                <div style={{ fontSize: 12, opacity: 0.7 }}>{t('review.thanks')}</div>
            </div>
        );
    }
    if (!commission.canReview) return null;

    const submit = async () => {
        if (!rating) {
            setError(t('review.chooseRating'));
            return;
        }
        setSaving(true);
        setError('');
        try {
            await axios.post('/reviews', { commissionId: commission.id, rating, text });
            onSaved({ rating, text: text.trim(), createdAt: new Date().toISOString() });
        } catch (err) {
            setError(err.response?.data?.message || t('review.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={boxStyle}>
            <div style={{ fontWeight: 'bold' }}>{t('review.title')}</div>
            <div role="radiogroup" aria-label={t('artists.rating')} style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={t('review.stars', { count: n })}
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: 0, color: n <= (hover || rating) ? '#ffc94d' : 'rgba(255,255,255,0.4)' }}
                    >
                        ★
                    </button>
                ))}
            </div>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={t('review.placeholder')}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', resize: 'vertical' }}
            />
            {error && <div style={{ color: '#ff8a8a', fontSize: 13 }}>{error}</div>}
            <button
                type="button"
                onClick={submit}
                disabled={saving}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7b4dff', color: '#fff', cursor: 'pointer' }}
            >
                {saving ? t('common.saving') : t('review.send')}
            </button>
        </div>
    );
}

const boxStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 320,
    color: '#fff',
};
