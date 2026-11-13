import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import useDialog from './useDialog';
import ArtCard from '../ArtCard/ArtCard';
import AdvancedFilters from '../AdvancedFilters/AdvancedFilters';
import { SHOP_FILTERS } from '../../constants/filters';

const openModal = vi.fn();
vi.mock('../../context/ModalContext', () => ({ useModal: () => ({ openModal }) }));

function Demo() {
    const [open, setOpen] = useState(false);
    function Dialog() {
        const ref = useRef(null);
        useDialog(ref, () => setOpen(false));
        return (
            <div ref={ref} role="dialog" aria-modal="true" aria-label="Demo">
                <button>first</button>
                <button>last</button>
            </div>
        );
    }
    return (
        <>
            <button onClick={() => setOpen(true)}>open</button>
            {open && <Dialog />}
        </>
    );
}

describe('useDialog', () => {
    test('moves focus in, keeps Tab inside, closes on Escape and returns focus', () => {
        render(<Demo />);
        const opener = screen.getByText('open');
        opener.focus();
        fireEvent.click(opener);
        expect(screen.getByText('first')).toHaveFocus();

        screen.getByText('last').focus();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
        expect(screen.getByText('first')).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
        expect(screen.getByText('last')).toHaveFocus();

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
    });
});

describe('art card', () => {
    test('is a named button that opens with Enter and Space', () => {
        openModal.mockClear();
        render(<ArtCard art={{ id: 7, title: 'Sunset', artistName: 'Anna', price: 120, likes: 3, imageUrl: '/x.png' }} />);
        const card = screen.getByRole('button', { name: /sunset/i });
        expect(card).toHaveAttribute('tabindex', '0');
        fireEvent.keyDown(card, { key: 'Enter' });
        fireEvent.keyDown(card, { key: ' ' });
        expect(openModal).toHaveBeenCalledTimes(2);
        expect(openModal.mock.calls[0][0]).toMatchObject({ id: 7 });
    });
});

describe('additional filters', () => {
    test('options are buttons with pressed state; style list opens from a button', () => {
        const onSelect = vi.fn();
        render(<AdvancedFilters filterConfig={SHOP_FILTERS} selected={{ 'SORT BY': 'CHEAP' }} onSelect={onSelect} />);
        const toggle = screen.getByRole('button', { name: /additional filters/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');

        expect(screen.getByRole('button', { name: 'CHEAP' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'POPULAR' }));
        expect(onSelect).toHaveBeenCalledWith('SORT BY', 'POPULAR');

        const anyStyle = screen.getByRole('button', { name: /any style/i });
        expect(anyStyle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(anyStyle);
        expect(anyStyle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Cyberpunk' }));
        expect(onSelect).toHaveBeenCalledWith('STYLE', 'Cyberpunk');
    });
});
