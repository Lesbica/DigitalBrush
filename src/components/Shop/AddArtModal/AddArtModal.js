import { useState } from 'react';
import axios from "axios";
import { useTranslation } from 'react-i18next';
import styles from './AddArtModal.module.css';
import StepModal, { ChipGroup, Field, ImagePicker, useImageFiles } from '../../StepModal/StepModal';
import modal from '../../StepModal/StepModal.module.css';
import { PAINTING_FORMATS, STYLES } from '../../../constants/filters';
import { CATEGORIES } from '../../../constants/categories';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice } from '../../../i18n/format';
import { HeartIcon } from '../../Icons/Icons';

const MAX_IMAGES = 10;
const digits = (v) => v.replace(/\D/g, '');
const styleOptions = (config) => config?.find((f) => f.title === 'STYLE')?.options?.[0]?.subOptions || STYLES;

// Upload of a new artwork to the shop (artists only)
const AddArtModal = ({ onClose, categories = CATEGORIES, filterConfig }) => {
    const { t } = useTranslation();
    const toast = useToast();
    const { user } = useAuth();
    const styleList = styleOptions(filterConfig);
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '', about: '', category: categories[0] || '', style: styleList[0] || '', format: PAINTING_FORMATS[0],
        sizeW: '', sizeH: '', price: '',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const files = useImageFiles(MAX_IMAGES, () => toast.error(t('upload.maxImages', { count: MAX_IMAGES })));

    const set = (key) => (value) => {
        setForm((f) => ({ ...f, [key]: value }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
    };
    const label = (c) => t(`labels.${c}`, { defaultValue: c });

    // the cover's own pixel size fills in the size fields
    const addImages = (list) => {
        const wasEmpty = files.images.length === 0;
        files.add(list);
        setErrors((e) => ({ ...e, images: null }));
        if (wasEmpty && list[0] && !form.sizeW && typeof Image !== 'undefined') {
            const probe = new Image();
            const url = URL.createObjectURL(list[0]);
            probe.onload = () => {
                setForm((f) => (f.sizeW ? f : { ...f, sizeW: String(probe.naturalWidth), sizeH: String(probe.naturalHeight) }));
                URL.revokeObjectURL(url);
            };
            probe.src = url;
        }
    };

    const steps = [
        { name: t('stepModal.art.images'), title: t('stepModal.art.imagesTitle') },
        { name: t('stepModal.art.details'), title: t('stepModal.art.detailsTitle') },
        { name: t('stepModal.art.price'), title: t('stepModal.art.priceTitle') },
    ];

    const checkStep = (n) => {
        const e = {};
        if (n === 0 && files.images.length === 0) e.images = t('upload.required.image');
        if (n === 1) {
            if (!form.name.trim()) e.name = t('upload.required.name');
            if (!form.about.trim()) e.about = t('upload.required.about');
        }
        if (n === 2) {
            if (!form.sizeW || !form.sizeH) e.size = t('upload.required.size');
            if (!form.price) e.price = t('upload.required.price');
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const submit = async () => {
        setSubmitting(true);
        try {
            const data = new FormData();
            data.append('title', form.name.trim());
            data.append('description', form.about.trim());
            data.append('category', form.category);
            data.append('style', form.style);
            data.append('format', form.format);
            data.append('price', form.price);
            data.append('width', form.sizeW);
            data.append('height', form.sizeH);
            data.append('size', `${form.sizeW}x${form.sizeH}`);
            files.images.forEach((img, i) => data.append(i === 0 ? 'image' : 'images', img.file));

            const res = await axios.post('/paintings/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                toast.success(t('stepModal.art.published'));
                onClose();
            } else {
                toast.error(res.data.message || t('upload.saveFailed'));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || t('upload.saveFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const next = () => {
        if (!checkStep(step)) return;
        if (step < steps.length - 1) setStep(step + 1);
        else submit();
    };

    const cover = files.images[0]?.preview;
    const preview = (
        <article className={styles.tile}>
            <div className={styles.tileImage}>
                {cover ? <img src={cover} alt="" /> : <span className={styles.tileEmpty}>{t('stepModal.art.coverHere')}</span>}
                <span className={styles.likes}><HeartIcon size={13} /> 0</span>
            </div>
            <div className={styles.tileInfo}>
                <div className={styles.tileText}>
                    <strong className={form.name ? '' : styles.placeholder}>{form.name || t('stepModal.art.titlePlaceholder')}</strong>
                    <span>{user?.name}{form.style ? ` · ${form.style}` : ''}</span>
                </div>
                <span className={styles.pricePill}>{form.price ? formatPrice(form.price) : '₴—'}</span>
            </div>
        </article>
    );

    return (
        <StepModal
            label={t('shop.addImage')}
            steps={steps}
            step={step}
            onBack={() => { setErrors({}); setStep(step - 1); }}
            onNext={next}
            nextLabel={t('stepModal.art.publish')}
            submitting={submitting}
            previewTitle={t('stepModal.art.previewTitle')}
            preview={preview}
            onClose={onClose}
        >
            {step === 0 && (
                <ImagePicker images={files.images} max={MAX_IMAGES} onAdd={addImages} onRemove={files.remove}
                             label={t('upload.addImages')} hint={t('stepModal.imageHint', { count: MAX_IMAGES })}
                             coverLabel={t('stepModal.art.cover')} error={errors.images} />
            )}

            {step === 1 && (
                <>
                    <Field id="art-name" label={t('upload.name')} error={errors.name}>
                        <input id="art-name" value={form.name} maxLength={255} autoComplete="off"
                               aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'art-name-error' : undefined}
                               placeholder={t('stepModal.art.titlePlaceholder')} onChange={(e) => set('name')(e.target.value)} />
                    </Field>
                    <Field id="art-about" label={t('upload.about')} error={errors.about}>
                        <textarea id="art-about" value={form.about} maxLength={2000}
                                  aria-invalid={Boolean(errors.about)} aria-describedby={errors.about ? 'art-about-error' : undefined}
                                  placeholder={t('stepModal.art.aboutPlaceholder')} onChange={(e) => set('about')(e.target.value)} />
                    </Field>
                    <ChipGroup id="art-category" label={t('upload.category')} options={categories} value={form.category}
                               onChange={set('category')} renderLabel={label} />
                    <ChipGroup id="art-style" label={t('upload.style')} options={styleList} value={form.style} onChange={set('style')} />
                </>
            )}

            {step === 2 && (
                <>
                    <ChipGroup id="art-format" label={t('upload.format')} options={PAINTING_FORMATS} value={form.format} onChange={set('format')} />
                    <div className={modal.row}>
                        <Field id="art-w" label={t('stepModal.sizePx')} error={errors.size} hint={t('stepModal.art.sizeHint')}>
                            <div className={modal.size}>
                                <input id="art-w" inputMode="numeric" placeholder="W" value={form.sizeW} aria-label={t('upload.width')}
                                       aria-invalid={Boolean(errors.size)} onChange={(e) => set('sizeW')(digits(e.target.value))} />
                                ×
                                <input inputMode="numeric" placeholder="H" value={form.sizeH} aria-label={t('upload.height')}
                                       aria-invalid={Boolean(errors.size)} onChange={(e) => set('sizeH')(digits(e.target.value))} />
                            </div>
                        </Field>
                        <Field id="art-price" label={t('upload.price')} error={errors.price} hint={t('stepModal.art.priceHint')}>
                            <div className={modal.money}>
                                <span aria-hidden="true">₴</span>
                                <input id="art-price" inputMode="numeric" value={form.price} placeholder="1500"
                                       aria-invalid={Boolean(errors.price)} onChange={(e) => set('price')(digits(e.target.value))} />
                            </div>
                        </Field>
                    </div>
                </>
            )}
        </StepModal>
    );
};

export default AddArtModal;
