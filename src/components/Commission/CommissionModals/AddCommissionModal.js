import { useState } from 'react';
import axios from "axios";
import { useTranslation } from 'react-i18next';
import styles from './AddCommissionModal.module.css';
import StepModal, { ChipGroup, Field, ImagePicker, useImageFiles } from '../../StepModal/StepModal';
import modal from '../../StepModal/StepModal.module.css';
import { CATEGORIES } from '../../../constants/categories';
import { STYLES, COMMISSION_FORMATS } from '../../../constants/filters';
import { useToast } from '../../../context/ToastContext';
import { formatDate, formatPrice } from '../../../i18n/format';

const MAX_IMAGES = 5;
const digits = (v) => v.replace(/\D/g, '');
const today = () => new Date().toISOString().slice(0, 10);

// New commission request: public (board) or direct to one artist (targetCreatorId)
const AddCommissionModal = ({ onClose, targetCreatorId = null }) => {
    const { t } = useTranslation();
    const toast = useToast();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '', about: '', category: CATEGORIES[0], style: STYLES[0], format: COMMISSION_FORMATS[0],
        sizeW: '', sizeH: '', price: '', deadline: '',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const files = useImageFiles(MAX_IMAGES, () => toast.error(t('upload.maxImages', { count: MAX_IMAGES })));

    const set = (key) => (value) => {
        setForm((f) => ({ ...f, [key]: value }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
    };
    const label = (c) => t(`labels.${c}`, { defaultValue: c });

    const steps = [
        { name: t('stepModal.commission.idea'), title: t('stepModal.commission.ideaTitle') },
        { name: t('stepModal.commission.details'), title: t('stepModal.commission.detailsTitle') },
        { name: t('stepModal.commission.budget'), title: t('stepModal.commission.budgetTitle') },
    ];

    const checkStep = (n) => {
        const e = {};
        if (n === 0) {
            if (!form.name.trim()) e.name = t('upload.required.name');
            if (!form.about.trim()) e.about = t('upload.required.about');
            if (files.images.length === 0) e.images = t('upload.required.image');
        }
        if (n === 1 && (!form.sizeW || !form.sizeH)) e.size = t('upload.required.size');
        if (n === 2 && !form.price) e.price = t('upload.required.price');
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
            data.append('size', `${form.sizeW}x${form.sizeH}`);
            data.append('format', form.format);
            data.append('price', form.price);
            if (form.deadline) data.append('deadline', form.deadline);
            if (targetCreatorId) data.append('creatorId', targetCreatorId);
            files.images.forEach((img, i) => data.append(i === 0 ? 'referenceImage' : `image${i + 1}`, img.file));

            const res = await axios.post('/commissions/create', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                toast.success(targetCreatorId ? t('upload.directSent') : t('upload.publicCreated'));
                onClose();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || t('upload.serverError'));
        } finally {
            setSubmitting(false);
        }
    };

    const next = () => {
        if (!checkStep(step)) return;
        if (step < steps.length - 1) setStep(step + 1);
        else submit();
    };

    const preview = (
        <article className={styles.card}>
            <div className={styles.cardMain}>
                <div className={styles.tags}>
                    <span>{label(form.category)}</span>
                    <span>{form.style}</span>
                </div>
                <h3 className={form.name ? '' : styles.placeholder}>{form.name || t('stepModal.commission.titlePlaceholder')}</h3>
                <p className={form.about ? styles.desc : `${styles.desc} ${styles.placeholder}`}>
                    {form.about || t('stepModal.commission.aboutPlaceholder')}
                </p>
                {files.images[0] && <img src={files.images[0].preview} alt="" className={styles.thumb} />}
                <p className={styles.meta}>
                    {form.deadline && <span>{t('commissions.deadline', { date: formatDate(form.deadline) })}</span>}
                    {form.sizeW && form.sizeH && <span>{form.sizeW} × {form.sizeH} px</span>}
                    <span>{form.format}</span>
                </p>
            </div>
            <div className={styles.cardSide}>
                <small>{t('commissions.budget')}</small>
                <strong>{form.price ? formatPrice(form.price) : '—'}</strong>
                <span className={styles.fakeBtn}>{t('commissions.take')}</span>
            </div>
        </article>
    );

    return (
        <StepModal
            label={t('commissions.add')}
            steps={steps}
            step={step}
            onBack={() => { setErrors({}); setStep(step - 1); }}
            onNext={next}
            nextLabel={targetCreatorId ? t('stepModal.commission.sendToArtist') : t('stepModal.commission.publish')}
            submitting={submitting}
            previewTitle={targetCreatorId ? t('stepModal.commission.previewDirect') : t('stepModal.commission.previewBoard')}
            preview={preview}
            onClose={onClose}
        >
            {step === 0 && (
                <>
                    <Field id="commission-name" label={t('upload.name')} error={errors.name}>
                        <input id="commission-name" value={form.name} maxLength={255} autoComplete="off"
                               aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'commission-name-error' : undefined}
                               placeholder={t('stepModal.commission.titlePlaceholder')} onChange={(e) => set('name')(e.target.value)} />
                    </Field>
                    <Field id="commission-about" label={t('upload.about')} error={errors.about}>
                        <textarea id="commission-about" value={form.about} maxLength={2000}
                                  aria-invalid={Boolean(errors.about)} aria-describedby={errors.about ? 'commission-about-error' : undefined}
                                  placeholder={t('stepModal.commission.aboutPlaceholder')} onChange={(e) => set('about')(e.target.value)} />
                    </Field>
                    <ImagePicker images={files.images} max={MAX_IMAGES}
                                 onAdd={(list) => { files.add(list); setErrors((e) => ({ ...e, images: null })); }}
                                 onRemove={files.remove} label={t('stepModal.commission.references')}
                                 hint={t('stepModal.imageHint', { count: MAX_IMAGES })} error={errors.images} />
                </>
            )}

            {step === 1 && (
                <>
                    <ChipGroup id="commission-category" label={t('upload.category')} options={CATEGORIES} value={form.category}
                               onChange={set('category')} renderLabel={label} />
                    <ChipGroup id="commission-style" label={t('upload.style')} options={STYLES} value={form.style} onChange={set('style')} />
                    <div className={modal.row}>
                        <ChipGroup id="commission-format" label={t('upload.format')} options={COMMISSION_FORMATS} value={form.format} onChange={set('format')} />
                        <Field id="commission-w" label={t('stepModal.sizePx')} error={errors.size}>
                            <div className={modal.size}>
                                <input id="commission-w" inputMode="numeric" placeholder="W" value={form.sizeW} aria-label={t('upload.width')}
                                       aria-invalid={Boolean(errors.size)} onChange={(e) => { set('sizeW')(digits(e.target.value)); setErrors((x) => ({ ...x, size: null })); }} />
                                ×
                                <input inputMode="numeric" placeholder="H" value={form.sizeH} aria-label={t('upload.height')}
                                       aria-invalid={Boolean(errors.size)} onChange={(e) => { set('sizeH')(digits(e.target.value)); setErrors((x) => ({ ...x, size: null })); }} />
                            </div>
                        </Field>
                    </div>
                </>
            )}

            {step === 2 && (
                <>
                    <div className={modal.row}>
                        <Field id="commission-price" label={t('stepModal.commission.budgetLabel')} error={errors.price}
                               hint={t('stepModal.commission.budgetHint')}>
                            <div className={modal.money}>
                                <span aria-hidden="true">₴</span>
                                <input id="commission-price" inputMode="numeric" value={form.price} placeholder="2000"
                                       aria-invalid={Boolean(errors.price)} onChange={(e) => set('price')(digits(e.target.value))} />
                            </div>
                        </Field>
                        <Field id="commission-deadline" label={t('upload.deadline')}>
                            <input id="commission-deadline" type="date" min={today()} value={form.deadline} onChange={(e) => set('deadline')(e.target.value)} />
                        </Field>
                    </div>
                    <dl className={modal.summary}>
                        <div><dt>{t('upload.name')}</dt><dd>{form.name}</dd></div>
                        <div><dt>{t('upload.category')}</dt><dd>{label(form.category)} · {form.style}</dd></div>
                        <div><dt>{t('upload.format')}</dt><dd>{form.format} · {form.sizeW} × {form.sizeH} px</dd></div>
                        <div><dt>{t('stepModal.commission.references')}</dt><dd>{files.images.length}</dd></div>
                    </dl>
                </>
            )}
        </StepModal>
    );
};

export default AddCommissionModal;
