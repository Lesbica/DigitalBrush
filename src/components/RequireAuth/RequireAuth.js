import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Pages that only make sense for a logged-in user. Guests are sent to the sign-in page,
// which brings them back here (?next=) after logging in.
export default function RequireAuth({ children }) {
    const { isLoggedIn, loading } = useAuth();
    const location = useLocation();

    if (loading) return null;
    if (!isLoggedIn) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/profile?next=${next}`} replace />;
    }
    return children;
}
