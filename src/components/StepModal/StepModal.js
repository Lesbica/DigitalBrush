import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StepModal.module.css';
import useDialog from '../Dialog/useDialog';
import { CloseIcon, PlusIcon } from '../Icons/Icons';

// Dialog shell for the creation forms: steps on the right, a live preview of the result on the left.
// On phones the preview hides behind a "Preview" button and the dialog is a bottom sheet.
export default function StepModal({
    label, steps, step, onBack, onNext, nextLabel, submitting = false,
    previewTitle, preview, onClose, children,
}) {
    const { t } = useTranslation();
    const ref = useRef(null);
    useDialog(ref, onClose);
    const [showPreview, setShowPreview] = useState(false);
    const last = step === steps.length - 1;

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    // a new step starts at the top, with the form visible
    const bodyRef = useRef(null);
    useEffect(() => {
        setShowPreview(false);
        bodyRef.current?.scrollTo?.(0, 0);
    }, [step]);

    return (
        <div className={styles.layer}>
            <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
            <div ref={ref} className={styles.modal} role="dialog" aria-modal="true" aria-label={label}>
                <aside className={`${styles.preview} ${showPreview ? styles.previewOpen : ''}`} aria-label={previewTitle}>
                    <span className={styles.previewTitle}>{previewTitle}</span>
                    <div className={styles.previewStage}>{preview}</div>
                    <button type="button" className={`btn btn-ghost ${styles.previewBack}`} onClick={() => setShowPreview(false)}>
                        {t('stepModal.backToForm')}
                    </button>
                </aside>

                <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); onNext(); }}>
                    <span className={styles.grab} aria-hidden="true" />
                    <div className={styles.head}>
                        <span className={styles.stepName}>
                            {t('stepModal.stepOf', { n: step + 1, total: steps.length })} · {steps[step].name}
                        </span>
                        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
                            <CloseIcon size={18} />
                        </button>
                    </div>
                    <ol className={styles.progress} aria-hidden="true">
                        {steps.map((s, i) => <li key={s.name} className={i <= step ? styles.done : ''} />)}
                    </ol>
                    <h2 className={styles.question}>{steps[step].title}</h2>

                    <div ref={bodyRef} className={styles.body}>{children}</div>

                    <button type="button" className={`btn btn-ghost ${styles.previewToggle}`} onClick={() => setShowPreview(true)}>
                        {t('stepModal.preview')}
                    </button>
                    <div className={styles.foot}>
                        {step > 0
                            ? <button type="button" className="btn btn-ghost" onClick={onBack}>{t('common.back')}</button>
                            : <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>}
                        <button type="submit" className="btn btn-lime" disabled={submitting}>
                            {submitting ? t('stepModal.sending') : last ? nextLabel : t('stepModal.next', { name: steps[step + 1].name.toLowerCase() })}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Single choice as chips (category, style, format)
export function ChipGroup({ label, options, value, onChange, renderLabel = (o) => o, error, id }) {
    return (
        <fieldset className={styles.field} aria-describedby={error ? `${id}-error` : undefined}>
            <legend className={styles.label}>{label}</legend>
            <div className={styles.chips}>
                {options.map((o) => (
                    <button key={o} type="button" className={styles.chip} aria-pressed={value === o} onClick={() => onChange(o)}>
                        {renderLabel(o)}
                    </button>
                ))}
            </div>
            {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
        </fieldset>
    );
}

export function Field({ id, label, error, hint, children }) {
    return (
        <div className={styles.field}>
            <label className={styles.label} htmlFor={id}>{label}</label>
            {children}
            {hint && !error && <p className={styles.hint}>{hint}</p>}
            {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
        </div>
    );
}

// Image picker: a drop zone and the chosen files as thumbnails (first = cover)
export function ImagePicker({ images, max, onAdd, onRemove, label, hint, error, coverLabel }) {
    const { t } = useTranslation();
    const add = (files) => { if (files?.length) onAdd(Array.from(files)); };
    return (
        <div className={styles.field}>
            <span className={styles.label}>{label}</span>
            {images.length < max && (
                <label className={`${styles.drop} ${error ? styles.invalid : ''}`}
                       onDragOver={(e) => e.preventDefault()}
                       onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
                    <PlusIcon size={22} />
                    <strong>{t('stepModal.dropTitle')}</strong>
                    <span>{hint}</span>
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="sr-only"
                           aria-label={label} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
                </label>
            )}
            {images.length > 0 && (
                <ul className={styles.thumbs}>
                    {images.map((img, i) => (
                        <li key={img.preview}>
                            <img src={img.preview} alt="" />
                            {i === 0 && coverLabel && <span className={styles.cover}>{coverLabel}</span>}
                            <button type="button" className={styles.remove} onClick={() => onRemove(i)}
                                    aria-label={t('upload.removeImage', { n: i + 1 })}>
                                <CloseIcon size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className={styles.error}>{error}</p>}
        </div>
    );
}

// Object URLs for picked files, revoked when removed and on close
export function useImageFiles(max, onTooMany) {
    const [images, setImages] = useState([]);
    const latest = useRef(images);
    useEffect(() => { latest.current = images; }, [images]);
    useEffect(() => () => latest.current.forEach((img) => URL.revokeObjectURL(img.preview)), []);
    const add = (files) => {
        const room = max - latest.current.length;
        if (files.length > room) onTooMany?.();
        const next = files.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
        setImages((prev) => [...prev, ...next]);
    };
    const remove = (index) => setImages((prev) => {
        const gone = prev[index];
        if (gone) URL.revokeObjectURL(gone.preview);
        return prev.filter((_, i) => i !== index);
    });
    return { images, add, remove };
}
