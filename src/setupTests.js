import '@testing-library/jest-dom/vitest';
import i18n from './i18n';

// Tests assert English texts
i18n.changeLanguage('en');

// jsdom has no scrolling
window.scrollTo = () => {};
