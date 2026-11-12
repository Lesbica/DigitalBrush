import React, {useEffect, useState, useRef } from 'react';
import styles from './AddCommissionModal.module.css';
import closeIcon from '../../../assets/closeCross.svg';
import addImageIcon from '../../../assets/image-placeholder-icon.svg';
import axios from "axios";
import { CATEGORIES } from '../../../constants/categories';
import { useToast } from '../../../context/ToastContext';
import { STYLES, COMMISSION_FORMATS } from '../../../constants/filters';
import { useTranslation } from 'react-i18next';

const categories = CATEGORIES;

const AddCommissionModal = ({ onClose, targetCreatorId = null }) => {
    const { t } = useTranslation();
    const toast = useToast();
    const [name, setName] = useState('');
    const [category, setCategory] = useState(categories[0]);
    const [style, setStyle] = useState(STYLES[0]);
    const [fileFormat, setFileFormat] = useState(COMMISSION_FORMATS[0]);
    const [sizeW, setSizeW] = useState('');
    const [sizeH, setSizeH] = useState('');
    const [about, setAbout] = useState('');
    const [price, setPrice] = useState('');
    const [deadline, setDeadline] = useState(''); // optional, YYYY-MM-DD
    const [images, setImages] = useState([]);
    const MAX_IMAGES = 5;
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Previews are revoked when an image is removed and the rest on close; revoking on every
    // change would break the previews that are still shown
    const imagesRef = useRef(images);
    useEffect(() => { imagesRef.current = images; }, [images]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
            imagesRef.current.forEach(img => URL.revokeObjectURL(img.preview));
        };
    }, []);

    const handlePriceChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setPrice(value);
        if (errors.price) setErrors(prev => ({...prev, price: null}));
    };

    const handleSizeChange = (e, type) => {
        const value = e.target.value.replace(/\D/g, '');
        if (type === 'w') {
            setSizeW(value);
        } else {
            setSizeH(value);
        }
        if (errors.size) setErrors(prev => ({...prev, size: null}));
    };

    const handleFileAdd = (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        const currentImageCount = images.length;
        const allowedFiles = files.slice(0, MAX_IMAGES - currentImageCount);
        if (allowedFiles.length < files.length) {
            toast.error(t('upload.maxImages', { count: MAX_IMAGES }));
        }
        if (allowedFiles.length === 0) {
            e.target.value = null;
            return;
        }
        const newFileObjects = allowedFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setImages(prevImages => [...prevImages, ...newFileObjects]);

        if (errors.images) setErrors(prev => ({...prev, images: null}));
        e.target.value = null;
    };

    const handleImageDelete = (e, index) => {
        e.stopPropagation();
        const newImages = [...images];
        const removedImage = newImages.splice(index, 1)[0];
        if (removedImage) {
            URL.revokeObjectURL(removedImage.preview);
        }
        setImages(newImages);
    };

    const validate = () => {
        const newErrors = {};
        if (!name.trim()) newErrors.name = t('upload.required.name');
        if (!category) newErrors.category = t('upload.required.category');
        if (!style) newErrors.style = t('upload.required.style');
        if (!fileFormat) newErrors.fileFormat = t('upload.required.format');
        if (!sizeW.trim() || !sizeH.trim()) newErrors.size = t('upload.required.size');
        if (!about.trim()) newErrors.about = t('upload.required.about');
        if (!price.trim()) newErrors.price = t('upload.required.price');
        if (images.length === 0) {
            newErrors.images = t('upload.required.image');
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("title", name);
            formData.append("description", about);
            formData.append("category", category);
            formData.append("style", style);
            formData.append("size", `${sizeW}x${sizeH}`);
            formData.append("format", fileFormat);
            formData.append("price", price);
            if (deadline) formData.append("deadline", deadline);

            // Використовуємо ЄДИНИЙ ендпоінт
            const apiUrl = `/commissions/create`;

            // Додаємо creatorId тільки якщо він існує
            if (targetCreatorId) {
                formData.append("creatorId", targetCreatorId);
            }

            // Додаємо зображення
            if (images.length > 0) formData.append("referenceImage", images[0].file);
            if (images.length > 1) {
                images.slice(1).forEach((img, index) => {
                    formData.append(`image${index + 2}`, img.file);
                });
            }

            const response = await axios.post(apiUrl, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (response.data.success) {
                // Показуємо повідомлення залежно від типу
                toast.success(targetCreatorId ? t('upload.directSent') : t('upload.publicCreated'));
                onClose();
                window.location.reload();
            }
        } catch (error) {
            console.error("Error creating commission:", error);
            // Виводимо конкретну помилку з бекенду (наприклад, про самозамовлення)
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else {
                toast.error(t('upload.serverError'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const mainDisplay = images[4] || null;
    const preview0 = images[0] || null;
    const preview1 = images[1] || null;
    const preview2 = images[2] || null;
    const preview3 = images[3] || null;
    const previews = [preview0, preview1, preview2, preview3];

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.contentWrapper}>
                    <div className={styles.leftColumn}>
                        <div className={`${styles.imageUploadArea} ${errors.images && images.length === 0 ? styles.errorBorder : ''}`}>
                            {mainDisplay ? (
                                <>
                                    <img src={mainDisplay.preview} alt="Main preview" className={styles.imagePreview} />
                                    <div className={styles.deleteOverlay} onClick={(e) => handleImageDelete(e, 4)}>
                                        <img src={closeIcon} alt="Delete" className={styles.deleteIcon} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <img src={addImageIcon} alt="Upload" className={styles.uploadIcon} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className={styles.fileInput}
                                        onChange={handleFileAdd}
                                        multiple
                                        disabled={images.length >= MAX_IMAGES}
                                    />
                                </>
                            )}
                        </div>
                        <div className={styles.previewRow}>
                            {previews.map((img, index) => (
                                <div key={index} className={styles.previewImg}>
                                    {img ? (
                                        <>
                                            <img src={img.preview} alt={`preview ${index}`} className={styles.imagePreview} />
                                            <div className={styles.deleteOverlay} onClick={(e) => handleImageDelete(e, index)}>
                                                <img src={closeIcon} alt="Delete" className={styles.deleteIcon} />
                                            </div>
                                        </>
                                    ) : (
                                        <img src={addImageIcon} alt="preview slot" className={styles.uploadIconPreview} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={styles.rightColumn}>
                        <div className={styles.formGroup}>
                            <div className={styles.formHeader}>
                                <p>{t('upload.name')}</p>
                                <button className={styles.closeBtn} onClick={onClose}>
                                    <img src={closeIcon} alt={t('common.close')} />
                                </button>
                            </div>
                            <input
                                type="text"
                                id="name"
                                className={`${styles.formInput} ${styles.formInputName} ${errors.name ? styles.errorBorderInput : ''}`}
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors(prev => ({...prev, name: null}));
                                }}
                            />
                            {errors.name && <span className={styles.error}>{errors.name}</span>}
                        </div>
                        {/* ... Інші поля форми (category, style, format, size) ... */}
                        <div className={styles.formGroup}>
                            <p>{t('art.category')}</p>
                            <select id="category" className={styles.formSelect} value={category} onChange={(e) => setCategory(e.target.value)}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <p>{t('art.style')}</p>
                            <select id="style" className={styles.formSelect} value={style} onChange={(e) => setStyle(e.target.value)}>
                                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <p>{t('art.format')}</p>
                            <select id="fileFormat" className={styles.formSelect} value={fileFormat} onChange={(e) => setFileFormat(e.target.value)}>
                                {COMMISSION_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <p>{t('art.size')}</p>
                            <div className={`${styles.sizeInputGroup} ${errors.size ? styles.errorBorderInput : ''}`}>
                                <input
                                    type="text"
                                    value={sizeW}
                                    className={styles.formInput}
                                    onChange={(e) => handleSizeChange(e, 'w')}
                                    placeholder="W"
                                />
                                <span>X</span>
                                <input
                                    type="text"
                                    value={sizeH}
                                    className={styles.formInput}
                                    onChange={(e) => handleSizeChange(e, 'h')}
                                    placeholder="H"
                                />
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <p>{t('upload.deadline')}</p>
                            <input
                                type="date"
                                className={styles.formInput}
                                value={deadline}
                                min={new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <p>{t('commission.about')}</p>
                    <textarea
                        id="about"
                        className={`${styles.formInput} ${styles.formInputAbout} ${errors.about ? styles.errorBorder : ''}`}
                        value={about}
                        onChange={(e) => {
                            setAbout(e.target.value);
                            if (errors.about) setErrors(prev => ({...prev, about: null}));
                        }}
                    />
                    {errors.about && <span className={styles.error}>{errors.about}</span>}
                </div>
                <div className={styles.actions}>
                    <div className={styles.priceInputWrapper}>
                        <input
                            type="text"
                            className={`${styles.priceInput} ${errors.price ? styles.errorBorderInput : ''}`}
                            value={price}
                            onChange={handlePriceChange}
                            placeholder={t('upload.pricePlaceholder')}
                        />
                        {errors.price && <span className={styles.errorPrice}>{errors.price}</span>}
                    </div>
                    <button className={styles.createBtn} onClick={handleCreate} disabled={submitting}>
                        {submitting ? t('upload.uploading') : t('upload.create')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddCommissionModal;