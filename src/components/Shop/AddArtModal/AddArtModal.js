import React, { useState, useEffect, useRef } from 'react';
import styles from './AddArtModal.module.css';
import axios from "axios";
import closeIcon from '../../../assets/closeCross.svg';
import addImageIcon from '../../../assets/image-placeholder-icon.svg';

const getOptions = (config, title) => {
  const section = config.find(f => f.title === title);
  return section?.options[0]?.subOptions || [];
};

const lerp = (current, target, factor) =>
  current * (1 - factor) + target * factor;

const AddArtModal = ({
  onClose,
  categories,
  filterConfig,
  existingPaintingId = null
}) => {
  const styleOptions = getOptions(filterConfig, "STYLE");
  const formatOptions = ["PNG", "JPG", "JPEG", "WEBP", "SVG"];

  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [style, setStyle] = useState('');
  const [fileFormat, setFileFormat] = useState('');
  const [sizeW, setSizeW] = useState('');
  const [sizeH, setSizeH] = useState('');
  const [about, setAbout] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const MAX_IMAGES = 10;

  const leftColumnRef = useRef(null);
  const rightFormRef = useRef(null);
  const leftScroll = useRef({ current: 0, target: 0 });
  const rightScroll = useRef({ current: 0, target: 0 });
  const animationFrameId = useRef(null);
  const lerpFactor = 0.1;

  // --- Disable scroll + start animation ---
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    startScrollAnimation();

    return () => {
      document.body.style.overflow = 'auto';
      animationFrameId.current &&
        cancelAnimationFrame(animationFrameId.current);

      images.forEach(img => img.file && URL.revokeObjectURL(img.preview));
    };
  }, []);

  // --- Smooth scroll animation ---
  const smoothScrollLoop = () => {
    let needsUpdate = false;

    [[leftColumnRef, leftScroll], [rightFormRef, rightScroll]].forEach(
      ([ref, scroll]) => {
        if (!ref.current) return;
        const { current, target } = scroll.current;

        if (Math.abs(target - current) > 0.1) {
          scroll.current.current = lerp(current, target, lerpFactor);
          ref.current.scrollTop = scroll.current.current;
          needsUpdate = true;
        } else if (current !== target) {
          scroll.current.current = target;
          needsUpdate = true;
        }
      }
    );

    if (needsUpdate)
      animationFrameId.current = requestAnimationFrame(smoothScrollLoop);
    else animationFrameId.current = null;
  };

  const startScrollAnimation = () => {
    if (!animationFrameId.current)
      animationFrameId.current = requestAnimationFrame(smoothScrollLoop);
  };

  const handleWheelScroll = e => {
    let didAnimate = false;

    [[leftColumnRef, leftScroll], [rightFormRef, rightScroll]].forEach(
      ([ref, scroll]) => {
        if (!ref.current) return;

        const { scrollHeight, clientHeight } = ref.current;
        if (scrollHeight <= clientHeight) return;

        const maxScroll = scrollHeight - clientHeight;
        const newTarget = Math.max(
          0,
          Math.min(scroll.current.target + e.deltaY, maxScroll)
        );

        if (newTarget !== scroll.current.target) {
          scroll.current.target = newTarget;
          didAnimate = true;
        }
      }
    );

    if (didAnimate) {
      e.preventDefault();
      startScrollAnimation();
    }
  };

  // --- Load existing painting for edit ---
  useEffect(() => {
    if (!existingPaintingId) return;

    const fetchPainting = async () => {
      try {
        const res = await axios.get(
          `/paintings/${existingPaintingId}`
        );

        if (res.data.success) {
          const p = res.data.painting;

          setName(p.title || '');
          setAbout(p.description || '');
          setPrice(p.price || '');
          setStyle(p.style || '');
          setCategory(p.category || categories[0]);

          if (p.width && p.height) {
            setSizeW(String(p.width));
            setSizeH(String(p.height));
          }

          const previews = [];

          if (p.mainImage)
            previews.push({ preview: p.mainImage, isExisting: true });

          if (Array.isArray(p.gallery))
            p.gallery.forEach(img =>
              previews.push({ preview: img, isExisting: true })
            );

          setImages(previews.slice(0, MAX_IMAGES));
        }
      } catch (err) {
        console.error("Error fetching painting:", err);
      }
    };

    fetchPainting();
  }, [existingPaintingId]);

  // --- Add images ---
  const handleFileAdd = e => {
    if (!e.target.files.length) return;

    const allowed = Array.from(e.target.files).slice(
      0,
      MAX_IMAGES - images.length
    );

    const newFiles = allowed.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setImages(prev => [...newFiles, ...prev]);

    e.target.value = null;
  };

  // --- Delete image ---
  const handleImageDelete = (e, index) => {
    e.stopPropagation();

    setImages(prev => {
      const toRemove = prev[index];
      if (toRemove?.file) URL.revokeObjectURL(toRemove.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // --- Validate ---
  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name required";
    if (!category) e.category = "Category required";
    if (!style) e.style = "Style required";
    if (!fileFormat) e.fileFormat = "Format required";
    if (!sizeW || !sizeH) e.size = "Size required";
    if (!about.trim()) e.about = "Description required";
    if (!price.trim()) e.price = "Price required";
    if (!images.length) e.images = "At least one image required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // --- Submit ---
  const handleAddArt = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      if (existingPaintingId) {
        alert('Оновлення картини наразі не підтримується API. Будь ласка, створіть нову картину.');
        setSubmitting(false);
        return;
      }
      const formData = new FormData();

      formData.append("title", name);
      formData.append("description", about);
      formData.append("category", category);
      formData.append("style", style);
      formData.append("format", fileFormat);
      formData.append("price", price);

      // width/height individually + size string
      formData.append("width", sizeW);
      formData.append("height", sizeH);
      formData.append("size", `${sizeW}x${sizeH}`);

      // images
      images.forEach((img, index) => {
        if (!img.isExisting) {
          formData.append(index === 0 ? "image" : "images", img.file);
        }
      });

      const endpoint = `/paintings/upload`;

      const res = await axios.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        onClose();
        window.location.reload();
      } else {
        alert(res.data.message || "Failed to save");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving artwork");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = e => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} onWheel={handleWheelScroll}>

        <button className={styles.closeBtnFixed} onClick={onClose}>
          <img src={closeIcon} alt="Close" />
        </button>

        {/* LEFT COLUMN */}
        <div className={styles.leftColumn} ref={leftColumnRef}>
          <div className={`${styles.imageUploadArea} ${errors.images ? styles.errorBorder : ''}`}>
            <img src={addImageIcon} alt="Upload" className={styles.uploadIcon} />
            <input
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={handleFileAdd}
              multiple
            />
          </div>

          {errors.images && <span className={styles.error}>{errors.images}</span>}

          <div className={styles.imageStack}>
            {images.map((img, i) => (
              <div key={i} className={styles.stackImagePreview}>
                <img src={img.preview} className={styles.imagePreview} alt="" />
                <div className={styles.deleteOverlay} onClick={(e) => handleImageDelete(e, i)}>
                  <img src={closeIcon} className={styles.deleteIcon} alt="delete" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightColumn}>
          <div className={styles.scrollableForm} ref={rightFormRef}>

            {/* NAME */}
            <div className={styles.formGroup}>
              <p>Name</p>
              <textarea
                className={`${styles.formInput} ${errors.name ? styles.errorBorderInput : ''}`}
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={150}
                rows={2}
                placeholder="Name..."
              />
              <span className={styles.charCounter}>{name.length} / 150</span>
              {errors.name && <span className={styles.error}>{errors.name}</span>}
            </div>

            {/* CATEGORY */}
            <div className={styles.formGroup}>
              <p>Category</p>
              <select
                className={styles.formSelect}
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* STYLE */}
            <div className={styles.formGroup}>
              <p>Style</p>
              <select
                className={styles.formSelect}
                value={style}
                onChange={e => setStyle(e.target.value)}
              >
                <option value="">Select...</option>
                {styleOptions.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {errors.style && <span className={styles.error}>{errors.style}</span>}
            </div>

            {/* FORMAT */}
            <div className={styles.formGroup}>
              <p>Format</p>
              <select
                className={styles.formSelect}
                value={fileFormat}
                onChange={e => setFileFormat(e.target.value)}
              >
                <option value="">Select...</option>
                {formatOptions.map(f => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              {errors.fileFormat && <span className={styles.error}>{errors.fileFormat}</span>}
            </div>

            {/* SIZE */}
            <div className={styles.formGroup}>
              <p>Size</p>
              <div className={`${styles.sizeInputGroup} ${errors.size ? styles.errorBorderInput : ''}`}>
                <input
                  type="text"
                  placeholder="W"
                  value={sizeW}
                  onChange={e => setSizeW(e.target.value.replace(/\D/g, ''))}
                />
                <span>X</span>
                <input
                  type="text"
                  placeholder="H"
                  value={sizeH}
                  onChange={e => setSizeH(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              {errors.size && <span className={styles.error}>{errors.size}</span>}
            </div>

            {/* ABOUT */}
            <div className={styles.formGroup}>
              <p>About</p>
              <textarea
                className={`${styles.formInput} ${errors.about ? styles.errorBorderInput : ''}`}
                value={about}
                onChange={e => setAbout(e.target.value)}
                rows={3}
              />
              {errors.about && <span className={styles.error}>{errors.about}</span>}
            </div>

            {/* PRICE + SUBMIT */}
            <div className={styles.actions}>
              <div className={styles.priceInputWrapper}>
                <input
                  type="text"
                  placeholder="Price"
                  value={price}
                  onChange={e => setPrice(e.target.value.replace(/\D/g, ''))}
                  className={`${styles.priceInput} ${errors.price ? styles.errorBorderInput : ''}`}
                />
                {errors.price && <span className={styles.errorPrice}>{errors.price}</span>}
              </div>

              <button
                className={styles.createBtn}
                disabled={submitting}
                onClick={handleAddArt}
              >
                {submitting ? "Saving..." : existingPaintingId ? "Update" : "Add"}
              </button>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AddArtModal;
