import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import HomePage from './components/HomePage/HomePage';
import NotFound from './components/NotFound/NotFound';
import RequireAuth from './components/RequireAuth/RequireAuth';

// Pages other than the home page are loaded on first visit, so the first screen downloads less
const Profile = lazy(() => import('./components/profilecomponents/Profile/Profile'));
const Register = lazy(() => import('./components/profilecomponents/Register/Register'));
const Shop = lazy(() => import('./components/Shop/Shop'));
const Commission = lazy(() => import('./components/Commission/Commission'));
const ArtistsPage = lazy(() => import('./components/Artists/ArtistsPage'));
const AuthorPage = lazy(() => import('./components/AuthorPage/AuthorPage'));
const CheckoutPage = lazy(() => import('./components/CheckoutPage/CheckoutPage'));
const PaymentSuccess = lazy(() => import('./components/CheckoutPage/PaymentSuccess'));
const PaymentFail = lazy(() => import('./components/CheckoutPage/PaymentFail'));
const VerifyEmail = lazy(() => import('./components/profilecomponents/Login/AccountLinks/VerifyEmail'));
const ResetPassword = lazy(() => import('./components/profilecomponents/Login/AccountLinks/ResetPassword'));

// Keeps the page height while a page chunk loads, so the footer does not jump up
const PageFallback = () => <div style={{ minHeight: '70vh' }} aria-busy="true" />;

export default function AppRouter() {
    return (
        <Suspense fallback={<PageFallback />}>
            <Routes>
                <Route path='/' element={<HomePage />} />
                <Route path='homepage' element={<HomePage />} />
                <Route path='profile' element={<Profile />} />
                <Route path='register' element={<Register />} />
                <Route path='shop' element={<Shop />} />
                <Route path='artists' element={<ArtistsPage />} />
                <Route path='commission' element={<Commission />} />
                <Route path='checkout' element={<RequireAuth><CheckoutPage /></RequireAuth>} />
                <Route path='success' element={<PaymentSuccess />} />
                <Route path='fail' element={<PaymentFail />} />
                <Route path='author/:id' element={<AuthorPage />} />
                <Route path='verify-email' element={<VerifyEmail />} />
                <Route path='reset-password' element={<ResetPassword />} />
                <Route path='*' element={<NotFound />} />
            </Routes>
        </Suspense>
    );
}
