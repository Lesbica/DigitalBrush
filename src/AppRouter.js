import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Profile from "./components/profilecomponents/Profile/Profile";
import HomePage from "./components/HomePage/HomePage";
import Shop from "./components/Shop/Shop";
import Register from "./components/profilecomponents/Register/Register";
import Commission from "./components/Commission/Commission";
import ArtistsPage from "./components/Artists/ArtistsPage";
import CheckoutPage from './components/CheckoutPage/CheckoutPage';
import AuthorPage from "./components/AuthorPage/AuthorPage";
import PaymentSuccess from "./components/CheckoutPage/PaymentSuccess";
import PaymentFail from "./components/CheckoutPage/PaymentFail";
import VerifyEmail from "./components/profilecomponents/Login/AccountLinks/VerifyEmail";
import ResetPassword from "./components/profilecomponents/Login/AccountLinks/ResetPassword";

export default function AppRouter({ onViewArtDetails, setIsLoggedIn }) {
    return (
        <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='homepage' element={<HomePage />} />
            <Route path='profile' element={<Profile setIsLoggedIn={setIsLoggedIn} />} />
            <Route path='register' element={<Register />} />
            <Route path='shop' element={<Shop />} />
            <Route path='artists' element={<ArtistsPage />} />
            <Route path='commission' element={<Commission />} />
            <Route
                path='checkout'
                element={<CheckoutPage onViewArtDetails={onViewArtDetails} />}
            />
            <Route path='success' element={<PaymentSuccess />} />
            <Route path='fail' element={<PaymentFail />} />
            <Route path='author/:id' element={<AuthorPage />} />
            <Route path='verify-email' element={<VerifyEmail />} />
            <Route path='reset-password' element={<ResetPassword />} />
        </Routes>
    )
}