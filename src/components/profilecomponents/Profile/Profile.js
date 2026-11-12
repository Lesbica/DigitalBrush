import React, { useState, useEffect } from 'react';
import axios from "axios";
import Login from "../Login/Login";
import Register from "../Register/Register";
import ForgotPassword from "../Login/ForgotPassword/ForgotPassword";
import styles from './Profile.module.css';
import DigitalBrushProfile from "./UserProfile/DigitalBrushProfile";

function Profile({ setIsLoggedIn }) {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('login');
    const [isLogin, setIsLogin] = useState(true);

    // Стан для форми редагування
    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        email: '',
        password: ''
    });
    const [imagePreview, setImagePreview] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Перевірка сесії при завантаженні
    useEffect(() => {
        axios.get(`/auth/check-session`)
            .then(response => {
                if (response.data.loggedIn) {
                    const userData = response.data.user;
                    setUser(userData);
                    setFormData({
                        name: userData.name || '',
                        bio: userData.bio || '',
                        email: userData.email || '',
                        password: ''
                    });
                    if (userData.profileImage) {
                        setImagePreview(userData.profileImage);
                    }
                } else {
                    setUser(null);
                }
            })
            .catch(error => console.error('Error checking session:', error));
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`/auth/login`, {
                email: formData.email,
                password: formData.password,
            });

            if (response.data.success) {
                const userData = response.data.user;
                setUser(userData);
                setFormData({
                    name: userData.name || '',
                    bio: userData.bio || '',
                    email: userData.email || '',
                    password: ''
                });
                if (setIsLoggedIn) setIsLoggedIn(true);
                if (userData.profileImage) {
                    setImagePreview(userData.profileImage);
                }
                setView('profile');
            }
        } catch (error) {
            console.error('Login failed:', error);
            const data = error.response?.data;
            if (data?.code === 'EMAIL_NOT_VERIFIED') {
                if (window.confirm(`${data.message}\n\nSend the confirmation link again?`)) {
                    try {
                        const res = await axios.post(`/auth/resend-verification`, { email: formData.email });
                        alert(res.data.message);
                    } catch {
                        alert('Could not send the link. Try again later.');
                    }
                }
                return;
            }
            alert(data?.message || 'Помилка авторизації');
        }
    };

    const handleRegister = async (e, registerData) => {
        e.preventDefault();
        try {
            // Бекенд очікує: username, email, password, birthday
            // registerData приходить з компонента Register
            const response = await axios.post(
                `/auth/register`,
                {
                    username: registerData.name, // Мапимо name на username
                    email: registerData.email,
                    password: registerData.password,
                    birthday: null // Можна додати поле дати народження у форму Register
                },
                {}
            );

            if (response.data.success) {
                alert("Реєстрація успішна! Будь ласка, увійдіть.");
                setIsLogin(true);
                setView('login');
            }
        } catch (error) {
            console.error("Registration failed:", error);
            alert("Помилка при реєстрації");
        }
    };

    const handleLogout = async () => {
        try {
            await axios.post(`/auth/logout`, {});
            setUser(null);
            setView('login');
            if (setIsLoggedIn) setIsLoggedIn(false);
            setFormData({ name: '', bio: '', email: '', password: '' });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const showLogin = () => setView('login');
    const showRegister = () => setView('register');
    const showForgotPassword = () => setView('forgotPassword');

    return (
        <div className={styles.profilePage}>
            {user ? (
                <DigitalBrushProfile
                    user={user}
                    onLogout={handleLogout}
                />
            ) : (
                <div className={styles.authFormsContainer}>
                    {view === 'login' && (
                        <Login
                            handleLogin={handleLogin}
                            handleInputChange={handleInputChange}
                            toggleForm={showRegister}
                            onForgotPassword={showForgotPassword}
                        />
                    )}
                    {view === 'register' && (
                        <Register
                            handleRegister={handleRegister}
                            toggleForm={showLogin}
                        />
                    )}
                    {view === 'forgotPassword' && (
                        <ForgotPassword
                            onBack={showLogin}
                            toggleForm={showRegister}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default Profile;