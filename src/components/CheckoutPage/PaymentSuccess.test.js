import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { CartProvider, useCart } from '../Cart/CartContext';
import PaymentSuccess from './PaymentSuccess';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('axios');

const ORDER = 'order_' + 'a'.repeat(32);

function CartCount() {
    const { cartItems } = useCart();
    return <p>cart: {cartItems.map(i => i.id).join(',') || 'empty'}</p>;
}

const renderPage = (search) => render(
    <MemoryRouter initialEntries={[`/success${search}`]}>
        <ToastProvider>
            <CartProvider>
                <PaymentSuccess />
                <CartCount />
            </CartProvider>
        </ToastProvider>
    </MemoryRouter>
);

beforeEach(() => {
    localStorage.setItem('digitalbrush.cart', JSON.stringify([
        { id: 1, title: 'A', price: 10, quantity: 1 },
        { id: 2, title: 'B', price: 20, quantity: 1 },
    ]));
});
afterEach(() => localStorage.clear());

test('the cart survives a reload', () => {
    renderPage('');
    expect(screen.getByText('cart: 1,2')).toBeInTheDocument();
});

test('approved order removes the bought paintings from the cart', async () => {
    axios.get.mockResolvedValue({ data: { orderId: ORDER, status: 'approved', type: 'cart', paintingIds: [1] } });
    renderPage(`?order=${ORDER}`);
    expect(await screen.findByRole('heading', { name: /payment successful/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('cart: 2')).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('digitalbrush.cart')).map(i => i.id)).toEqual([2]);
    expect(axios.get).toHaveBeenCalledWith(`/payments/orders/${ORDER}`);
});

test('the URL alone does not mark a payment as successful', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    renderPage(`?order=${ORDER}`);
    expect(await screen.findByRole('heading', { name: /status unknown/i })).toBeInTheDocument();
    expect(screen.getByText('cart: 1,2')).toBeInTheDocument();
});

test('declined order offers to try again and keeps the cart', async () => {
    axios.get.mockResolvedValue({ data: { orderId: ORDER, status: 'declined', type: 'cart', paintingIds: [1, 2] } });
    renderPage(`?order=${ORDER}`);
    expect(await screen.findByRole('heading', { name: /not completed/i })).toBeInTheDocument();
    expect(screen.getByText('cart: 1,2')).toBeInTheDocument();
});
