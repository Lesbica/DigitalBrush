import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider } from '../context/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import i18n from './index';
import { formatMoney, formatPrice } from './format';
import uk from './locales/uk.json';
import en from './locales/en.json';
import LanguageSwitcher from '../components/Nav/LanguageSwitcher/LanguageSwitcher';
import NotFound from '../components/NotFound/NotFound';

vi.mock('axios');

afterEach(async () => {
    await act(() => i18n.changeLanguage('en'));
});

const keysOf = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
    (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

test('both languages have the same keys', () => {
    expect(keysOf(uk).sort()).toEqual(keysOf(en).sort());
});

test('the switcher changes the language, the page and <html lang>', async () => {
    axios.get.mockResolvedValue({ data: { loggedIn: true, user: { id: 1, name: 'A', language: 'en' } } });
    axios.put.mockResolvedValue({ data: { success: true } });
    render(<MemoryRouter><AuthProvider><LanguageSwitcher /><NotFound /></AuthProvider></MemoryRouter>);
    await act(async () => {}); // session check finished: the user is logged in
    expect(screen.getByRole('heading')).toHaveTextContent('Page not found');
    fireEvent.click(screen.getByRole('button', { name: 'УКР' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Сторінку не знайдено');
    expect(document.documentElement.lang).toBe('uk');
    expect(screen.getByRole('button', { name: 'УКР' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('digitalbrush.lang')).toBe('uk');
    // a logged-in user's choice is saved for notifications and emails
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/profile/language', { language: 'uk' }));
});

test('prices are shown in hryvnias for both languages', async () => {
    expect(formatPrice(1250)).toMatch(/₴/);
    expect(formatPrice(1250)).not.toMatch(/\$/);
    expect(formatPrice(null)).toBe('—');
    await act(() => i18n.changeLanguage('uk'));
    expect(formatMoney(1250.5).replace(/\s/g, ' ')).toBe('1 250,50 ₴');
});

test('Ukrainian plurals', async () => {
    await act(() => i18n.changeLanguage('uk'));
    expect(i18n.t('author.reviewCount', { count: 1 })).toBe('1 відгук');
    expect(i18n.t('author.reviewCount', { count: 3 })).toBe('3 відгуки');
    expect(i18n.t('author.reviewCount', { count: 5 })).toBe('5 відгуків');
});
