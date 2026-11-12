import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import styles from "./Register.module.css";
import {EyeIcon, EyeSlashIcon} from "./AuthIcons";
import axios from 'axios';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from 'react-i18next';

// Registration: the server creates the account and emails a confirmation link
// (the account becomes active after the link is opened).
function Register({toggleForm}) {
    const { t } = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const goBack = toggleForm || (() => navigate('/profile'));

    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        birthday: "",
        password: "",
        role: "customer",
    });
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const {data} = await axios.post(`/auth/register`, formData);
            if (data.verificationRequired) {
                setStep(2);
            } else {
                toast.success(t('register.done'));
                goBack();
            }
        } catch (err) {
            setError(err.response?.data?.message || t('register.failed'));
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        setLoading(true);
        try {
            const {data} = await axios.post(`/auth/resend-verification`, {email: formData.email});
            setInfo(data.message);
        } catch (err) {
            setInfo(err.response?.data?.message || t('auth.linkFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const {name, value} = e.target;
        setFormData((prev) => ({...prev, [name]: value}));
    };

    if (step === 2) {
        return (
            <div className={styles.authCard}>
                <h2 className={styles.mainTitle}>{t('register.confirmTitle')}</h2>
                <p className={styles.emailTitle} style={{textAlign: 'left', marginBottom: '20px'}}>
                    {t('register.confirmSent')} <strong>{formData.email}</strong>. {t('register.confirmOpen')}
                </p>
                {info && <p className={styles.emailTitle} style={{textAlign: 'left'}}>{info}</p>}
                <div className={styles.buttonsRow}>
                    <button type="button" className={styles.submitBtn} onClick={resend} disabled={loading}>
                        {loading ? t('auth.sending') : t('register.sendAgain')}
                    </button>
                    <button type="button" className={styles.backBtn} onClick={goBack} disabled={loading}>
                        {t('auth.logIn')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form className={styles.authCard} onSubmit={handleSubmit}>
            <h2 className={styles.mainTitle}>{t('register.title')}</h2>

            <div className={styles.field}>
                <label htmlFor="reg-username">{t('register.username')}</label>
                <input id="reg-username" name="username"
                       value={formData.username}
                       onChange={handleChange}
                       required
                       maxLength={50}
                       disabled={loading}
                />
            </div>
            <div className={styles.field}>
                <label htmlFor="reg-email">{t('auth.email')}</label>
                <input id="reg-email" type="email" name="email"
                       value={formData.email}
                       onChange={handleChange}
                       required
                       disabled={loading}
                />
            </div>
            <div className={styles.field}>
                <label htmlFor="reg-birthday">{t('register.birthday')}</label>
                <input id="reg-birthday" type="date" name="birthday"
                       value={formData.birthday}
                       onChange={handleChange}
                       required
                       disabled={loading}
                       onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
            </div>
            <div className={styles.field}>
                <label htmlFor="reg-password">{t('auth.password')}</label>
                <div className={styles.passwordWrapper}>
                    <input id="reg-password" name="password"
                           type={showPassword ? "text" : "password"}
                           value={formData.password}
                           onChange={handleChange}
                           required
                           disabled={loading}
                           minLength="6"
                           maxLength="72"
                    />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                        {showPassword ? <EyeIcon/> : <EyeSlashIcon/>}
                    </button>
                </div>
            </div>
            <fieldset className={styles.field} style={{border: 'none', padding: 0, margin: 0}}>
                <legend style={{marginBottom: 6}}>{t('register.iWantTo')}</legend>
                <label style={{display: 'flex', gap: 8, alignItems: 'center', fontSize: 14}}>
                    <input type="radio" name="role" value="customer" checked={formData.role === 'customer'}
                           onChange={handleChange} disabled={loading} style={{width: 'auto'}}/>
                    {t('register.roleCustomer')}
                </label>
                <label style={{display: 'flex', gap: 8, alignItems: 'center', fontSize: 14}}>
                    <input type="radio" name="role" value="artist" checked={formData.role === 'artist'}
                           onChange={handleChange} disabled={loading} style={{width: 'auto'}}/>
                    {t('register.roleArtist')}
                </label>
            </fieldset>

            {error && <p role="alert" style={{color: '#ff8a8a', margin: 0}}>{error}</p>}

            <div className={styles.buttonsRow}>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? t('auth.sending') : t('auth.createAccount')}
                </button>
                <button type="button" className={styles.backBtn} onClick={goBack} disabled={loading}>
                    {t('common.back')}
                </button>
            </div>
        </form>
    );
}

export default Register;
