import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';

const CartContext = createContext(null);
const STORAGE_KEY = 'digitalbrush.cart';

// Only what the basket and checkout display; prices are re-checked by the server on payment.
const CART_FIELDS = ['id', 'title', 'price', 'imageUrl', 'artistName', 'artistId', 'description'];
const toCartItem = (item) => {
    const out = { quantity: 1 };
    for (const key of CART_FIELDS) if (item[key] !== undefined) out[key] = item[key];
    return out;
};

function loadCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter(i => i && i.id != null) : [];
    } catch {
        return [];
    }
}

export const CartProvider = ({ children }) => {
    const toast = useToast();
    const [cartItems, setCartItems] = useState(loadCart);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
        } catch {
            // storage disabled or full: the cart still works for this visit
        }
    }, [cartItems]);

    const isInCart = useCallback((id) => cartItems.some(i => String(i.id) === String(id)), [cartItems]);

    // Returns false when the item was already in the basket
    const addToCart = useCallback((item) => {
        if (isInCart(item.id)) {
            toast.info('This item is already in your basket.');
            return false;
        }
        setCartItems(prev => [...prev, toCartItem(item)]);
        toast.success('Item added to basket!');
        return true;
    }, [isInCart, toast]);

    const removeFromCart = useCallback((id) => {
        setCartItems(prev => prev.filter(item => String(item.id) !== String(id)));
    }, []);

    // After a successful payment: drop the paintings that were bought
    const removeManyFromCart = useCallback((ids) => {
        const bought = new Set(ids.map(String));
        setCartItems(prev => prev.filter(item => !bought.has(String(item.id))));
    }, []);

    const value = useMemo(
        () => ({ cartItems, addToCart, removeFromCart, removeManyFromCart, isInCart }),
        [cartItems, addToCart, removeFromCart, removeManyFromCart, isInCart]
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
