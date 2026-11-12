import React, {useState, useRef, useEffect} from "react";
import axios from "axios";
import styles from "./SettingsProfile.module.css";
import deleteCrossIcon from "../../../../../assets/icons/deleteCrossIcon.svg";
import plusIcon from "../../../../../assets/icons/plusIcon.svg";
import arrowIcon from "../../../../../assets/icons/arrowIcon.svg";
import uploadIconPlaceholder from "../../../../../assets/image-placeholder-icon.svg";
import {useAuth} from "../../../../../context/AuthContext";
import { useToast } from '../../../../../context/ToastContext';

const AVAILABLE_STYLES = [
    "Retro", "Psychedelia", "Minimalism", "Cyberpunk", "Realism", "Abstract", "Pop Art"
];

const AVAILABLE_LANGUAGES = [
    "English", "Українська", "Deutsch", "Español", "Français", "Polski"
];

function ProfileSettings({user}) {
    const toast = useToast();
    const {refresh} = useAuth();
    const fileInputRef = useRef(null);

    // Availability for commissions: open | busy | vacation (saved with the profile)
    const [status, setStatus] = useState('open');
    // artist = sells art and takes commissions; customer = buys and orders
    const [isArtist, setIsArtist] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(user.profileImage || "https://via.placeholder.com/220");
    const [selectedFile, setSelectedFile] = useState(null);

    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        instagram: "",
        behance: "",
        tiktok: "",
        description: ""
    });

    const [styleTags, setStyleTags] = useState([]);
    const [languageTags, setLanguageTags] = useState(['English']);

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.name || "",
                email: user.email || "",
                instagram: user.instagram || "", // Тепер береться з БД
                behance: user.behance || "",     // Тепер береться з БД
                tiktok: user.tiktok || "",       // Тепер береться з БД
                description: user.bio || ""
            });

            if (user.profileImage) {
                setAvatarPreview(user.profileImage);
            }
            setStatus(user.availability || 'open');
            setIsArtist(user.role === 'artist');

            // Завантаження стилів
            if (user.styles && Array.isArray(user.styles) && user.styles.length > 0) {
                setStyleTags(user.styles);
            } else {
                setStyleTags(['Retro']);
            }

            // Завантаження мов
            if (user.languages && Array.isArray(user.languages) && user.languages.length > 0) {
                setLanguageTags(user.languages);
            } else {
                setLanguageTags(['English']);
            }
        }
    }, [user]);

    // --- Handlers ---
    const handleInputChange = (e) => {
        const {name, value} = e.target;
        setFormData(prev => ({...prev, [name]: value}));
        if (errors[name]) {
            setErrors(prev => ({...prev, [name]: null}));
        }
    };

    const handleStatusChange = (newStatus) => {
        setStatus(newStatus);
    };

    const handleTagChange = (index, newValue, setTags, currentTags) => {
        const updatedTags = [...currentTags];
        updatedTags[index] = newValue;
        setTags(updatedTags);
    };

    const removeTag = (indexToRemove, setTags, currentTags) => {
        setTags(currentTags.filter((_, index) => index !== indexToRemove));
    };

    const addTag = (setTags, currentTags, availableOptions) => {
        setTags([...currentTags, availableOptions[0]]);
    };

    const handleAvatarClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            const previewUrl = URL.createObjectURL(file);
            setAvatarPreview(previewUrl);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setErrors({});

        const dataToSend = new FormData();

        // Додаємо основні поля
        dataToSend.append('username', formData.username);
        dataToSend.append('email', formData.email);
        dataToSend.append('description', formData.description);
        dataToSend.append('availability', status);
        dataToSend.append('role', isArtist ? 'artist' : 'customer');

        // Додаємо нові соцмережі
        dataToSend.append('instagram', formData.instagram);
        dataToSend.append('behance', formData.behance);
        dataToSend.append('tiktok', formData.tiktok);

        // Додаємо масиви тегів
        dataToSend.append('styleTags', JSON.stringify(styleTags));
        dataToSend.append('languageTags', JSON.stringify(languageTags)); // Розкоментовано

        if (selectedFile) {
            dataToSend.append('profileImage', selectedFile);
        }

        try {
            const response = await axios.post(
                `/profile/update-profile`,
                dataToSend,
                {
                    headers: {"Content-Type": "multipart/form-data"}
                }
            );

            if (response.data.success) {
                await refresh();
                toast.success("Profile updated successfully!");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            if (error.response && error.response.status === 409) {
                const msg = error.response.data.message.toLowerCase();
                if (msg.includes("username")) {
                    setErrors({username: error.response.data.message});
                } else if (msg.includes("email")) {
                    setErrors({email: error.response.data.message});
                } else {
                    toast.error(error.response.data.message);
                }
            } else {
                toast.error("Failed to update profile. Please try again.");
            }
        }
    };

    return (
        <form className={styles.settingsContainer} onSubmit={handleSave}>

            <div className={styles.formGrid}>
                {/* --- LEFT COLUMN --- */}
                <div className={styles.leftColumn}>

                    {/* ТЕПЕР ЧЕКБОКСИ ТУТ (Верх лівої колонки) */}
                    <div className={styles.statusSection}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                className={styles.checkboxInput}
                                checked={isArtist}
                                onChange={(e) => setIsArtist(e.target.checked)}
                            />
                            artist account
                        </label>
                        {isArtist && [['open', 'available'], ['busy', 'busy'], ['vacation', 'on vacation']].map(([value, label]) => (
                            <label key={value} className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    className={styles.checkboxInput}
                                    checked={status === value}
                                    onChange={() => handleStatusChange(value)}
                                />
                                {label}
                            </label>
                        ))}
                    </div>

                    <div className={styles.formGroup}>
                        <label>User's name</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            className={`${styles.inputField} ${errors.username ? styles.inputError : ''}`}
                        />
                        {errors.username && <span className={styles.errorMessage}>{errors.username}</span>}
                    </div>
                    <div className={styles.formGroup}>
                        <label>Email</label>
                        <input
                            type="text"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={`${styles.inputField} ${errors.email ? styles.inputError : ''}`}
                        />
                        {errors.email && <span className={styles.errorMessage}>{errors.email}</span>}
                    </div>

                    {/* Styles Tags */}
                    <div className={styles.formGroup}>
                        <label>Style</label>
                        <div className={styles.tagsContainer}>
                            {styleTags.map((tag, index) => (
                                <div key={index} className={styles.tagRow}>
                                    <div className={styles.selectWrapper}>
                                        <select
                                            value={tag}
                                            onChange={(e) => handleTagChange(index, e.target.value, setStyleTags, styleTags)}
                                            className={styles.selectField}
                                        >
                                            {AVAILABLE_STYLES.map(option => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                        <img src={arrowIcon} className={styles.arrowIcon} alt="arrow"/>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.removeTagBtn}
                                        onClick={() => removeTag(index, setStyleTags, styleTags)}
                                    >
                                        <img src={deleteCrossIcon} alt="Remove"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className={styles.addTagButton}
                            onClick={() => addTag(setStyleTags, styleTags, AVAILABLE_STYLES)}
                        >
                            <img src={plusIcon} alt="Add"/>
                        </button>
                    </div>

                    {/* Language Tags */}
                    <div className={styles.formGroup}>
                        <label>Language</label>
                        <div className={styles.tagsContainer}>
                            {languageTags.map((tag, index) => (
                                <div key={index} className={styles.tagRow}>
                                    <div className={styles.selectWrapper}>
                                        <select
                                            value={tag}
                                            onChange={(e) => handleTagChange(index, e.target.value, setLanguageTags, languageTags)}
                                            className={styles.selectField}
                                        >
                                            {AVAILABLE_LANGUAGES.map(option => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                        <img src={arrowIcon} className={styles.arrowIcon} alt="arrow"/>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.removeTagBtn}
                                        onClick={() => removeTag(index, setLanguageTags, languageTags)}
                                    >
                                        <img src={deleteCrossIcon} alt="Remove"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className={styles.addTagButton}
                            onClick={() => addTag(setLanguageTags, languageTags, AVAILABLE_LANGUAGES)}
                        >
                            <img src={plusIcon} alt="Add"/>
                        </button>
                    </div>
                </div>

                {/* --- RIGHT COLUMN --- */}
                <div className={styles.rightColumn}>

                    {/* АВАТАР ТУТ (Верх правої колонки) - буде на рівні з чекбоксами */}
                    <div className={styles.avatarWrapper}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{display: 'none'}}
                            accept="image/*"
                        />

                        <div className={styles.avatarContainer} onClick={handleAvatarClick}>
                            <img
                                src={avatarPreview}
                                alt="User Avatar"
                                className={styles.avatarImage}
                            />
                            <div className={styles.avatarOverlay}>
                                <img src={uploadIconPlaceholder} className={styles.uploadIcon} alt="Upload"/>
                            </div>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div className={styles.formGroup}>
                        <label>Instagram (link)</label>
                        <input type="text" name="instagram" value={formData.instagram} onChange={handleInputChange}
                               className={styles.inputField}/>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Behance (link)</label>
                        <input type="text" name="behance" value={formData.behance} onChange={handleInputChange}
                               className={styles.inputField}/>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Tik Tok (link)</label>
                        <input type="text" name="tiktok" value={formData.tiktok} onChange={handleInputChange}
                               className={styles.inputField}/>
                    </div>
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label>Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className={styles.textArea}
                    />
                </div>
            </div>

            <button type="submit" className={styles.saveButton}>Save</button>
        </form>
    );
}

export default ProfileSettings;