import React, {useEffect, useState} from 'react';
import styles from './AddCommissionModal.module.css';
import closeIcon from '../../../assets/closeCross.svg';
import addImageIcon from '../../../assets/image-placeholder-icon.svg';
import axios from "axios";
import { CATEGORIES } from '../../../constants/categories';
import { useToast } from '../../../context/ToastContext';

const categories = CATEGORIES;
const mockStyles = ["Retro", "Cyberpunk", "Fantasy", "Minimalism", "3D Render"];
const mockFormats = ["PNG", "JPG", "Figma", "PSD", "AI"];

const AddCommissionModal = ({ onClose, targetCreatorId = null }) => {
    const toast = useToast();
    const [name, setName] = useState('');
    const [category, setCategory] = useState(categories[0]);
    const [style, setStyle] = useState(mockStyles[0]);
    const [fileFormat, setFileFormat] = useState(mockFormats[0]);
    const [sizeW, setSizeW] = useState('');
    const [sizeH, setSizeH] = useState('');
    const [about, setAbout] = useState('');
    const [price, setPrice] = useState('');
    const [deadline, setDeadline] = useState(''); // optional, YYYY-MM-DD
    const [images, setImages] = useState([]);
    const MAX_IMAGES = 5;
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = 'auto';
            images.forEach(img => URL.revokeObjectURL(img.preview));
        };
    }, []);

    useEffect(() => {
        return () => {
            images.forEach(img => URL.revokeObjectURL(img.preview));
        };
    }, [images]);

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
            toast.error(`You can only upload a maximum of ${MAX_IMAGES} images in total.`);
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
        if (!name.trim()) newErrors.name = "Name is required";
        if (!category) newErrors.category = "Category is required";
        if (!style) newErrors.style = "Style is required";
        if (!fileFormat) newErrors.fileFormat = "Format is required";
        if (!sizeW.trim() || !sizeH.trim()) newErrors.size = "Size is required";
        if (!about.trim()) newErrors.about = "About is required";
        if (!price.trim()) newErrors.price = "Price is required";
        if (images.length === 0) {
            newErrors.images = "At least one image is required";
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
                toast.success(targetCreatorId ? "Direct commission request sent!" : "Public commission created!");
                onClose();
                window.location.reload();
            }
        } catch (error) {
            console.error("Error creating commission:", error);
            // Виводимо конкретну помилку з бекенду (наприклад, про самозамовлення)
            if (error.response && error.response.data && error.response.data.message) {
                toast.error("Error: " + error.response.data.message);
            } else {
                toast.error("Server error. Check console for details.");
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
                                <p>Name</p>
                                <button className={styles.closeBtn} onClick={onClose}>
                                    <img src={closeIcon} alt="Close" />
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
                            <p>Category</p>
                            <select id="category" className={styles.formSelect} value={category} onChange={(e) => setCategory(e.target.value)}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <p>Style</p>
                            <select id="style" className={styles.formSelect} value={style} onChange={(e) => setStyle(e.target.value)}>
                                {mockStyles.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <p>File format</p>
                            <select id="fileFormat" className={styles.formSelect} value={fileFormat} onChange={(e) => setFileFormat(e.target.value)}>
                                {mockFormats.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <p>Size</p>
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
                            <p>Deadline (optional)</p>
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
                    <p>About</p>
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
                            placeholder="Price"
                        />
                        {errors.price && <span className={styles.errorPrice}>{errors.price}</span>}
                    </div>
                    <button className={styles.createBtn} onClick={handleCreate} disabled={submitting}>
                        {submitting ? 'Uploading...' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddCommissionModal;