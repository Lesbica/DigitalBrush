// Small stroke icons used by the navigation and pages (24×24, inherit currentColor)
const base = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
};

const make = (paths) => function Icon({ size = 22, ...rest }) {
    return <svg {...base} width={size} height={size} {...rest}>{paths}</svg>;
};

export const HomeIcon = make(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>);
export const ShopIcon = make(<><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>);
export const PlusIcon = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const BrushIcon = make(<><path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8 9.2 12z" /><path d="M9 12.2c-2.3 0-4 1.7-4 4 0 1.8-.9 2.9-2.5 3.6 1.2.8 2.8 1.2 4.4 1.2 3.3 0 5.1-2.2 5.1-4.6" /></>);
export const UserIcon = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>);
export const BagIcon = make(<><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>);
export const UsersIcon = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 15.3c1.7.6 2.9 2.1 3.5 4.7" /></>);
export const UploadIcon = make(<><path d="M12 16V4" /><path d="m6.5 9.5 5.5-5.5 5.5 5.5" /><path d="M4 20h16" /></>);
export const SparkIcon = make(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></>);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const HeartIcon = make(<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.8 1.3-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />);
export const ImageIcon = make(<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>);
export const WalletIcon = make(<><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="3.5" y="8" width="17" height="11" rx="2.5" /><circle cx="16.5" cy="13.5" r="1.2" /></>);
export const SettingsIcon = make(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.2-.8.2-1.2z" /></>);
export const LogoutIcon = make(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></>);
export const FilterIcon =make(<><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>);
export const CloseIcon = make(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);
export const ArrowRightIcon = make(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
