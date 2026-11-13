import { useTranslation } from 'react-i18next';

// First stop for keyboard users: jumps over the navigation to the page content
export default function SkipLink() {
    const { t } = useTranslation();
    return <a className="skip-link" href="#main-content">{t('common.skipToContent')}</a>;
}
