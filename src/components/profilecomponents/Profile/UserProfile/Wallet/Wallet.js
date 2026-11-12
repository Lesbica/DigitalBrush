import React, { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from './Wallet.module.css';
import CategoryFilters from '../../../../CategoryFilters/CategoryFilters';
import Pagination from '../../../../hooks/Pagination/Pagination';
import { usePagination } from '../../../../hooks/Pagination/usePagination';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoney } from '../../../../../i18n/format';

const MONTHS = [
    { code: 'JAN', label: 'JANUARY' },
    { code: 'FEB', label: 'FEBRUARY' },
    { code: 'MAR', label: 'MARCH' },
    { code: 'APR', label: 'APRIL' },
    { code: 'MAY', label: 'MAY' },
    { code: 'JUN', label: 'JUNE' },
    { code: 'JUL', label: 'JULY' },
    { code: 'AUG', label: 'AUGUST' },
    { code: 'SEP', label: 'SEPTEMBER' },
    { code: 'OCT', label: 'OCTOBER' },
    { code: 'NOV', label: 'NOVEMBER' },
    { code: 'DEC', label: 'DECEMBER' },
];


// Artist wallet: balance, income by month, history and withdrawal requests (data from /api/wallet)
const Wallet = () => {
    const { t: tr } = useTranslation();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [activeYear, setActiveYear] = useState(String(new Date().getFullYear()));
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [form, setForm] = useState({ amount: '', iban: '' });
    // Automatic payouts to a linked card (when the server has them on)
    const [payout, setPayout] = useState({ enabled: false, card: null });
    const [method, setMethod] = useState('iban');
    const [linking, setLinking] = useState(false);
    const [formMessage, setFormMessage] = useState(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(() => {
        axios.get('/wallet')
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.message || tr('wallet.loadFailed')));
        axios.get('/payouts/card')
            .then(res => {
                const next = { enabled: Boolean(res.data?.enabled), card: res.data?.card || null };
                setPayout(next);
                setMethod(next.enabled && next.card ? 'card' : 'iban');
            })
            .catch(() => setPayout({ enabled: false, card: null }));
    }, [tr]);

    // WayForPay collects the card on its own page: post the signed form there
    const linkCard = async () => {
        setLinking(true);
        try {
            const { data: d } = await axios.post('/payouts/card/verify');
            const formEl = document.createElement('form');
            formEl.method = 'POST';
            formEl.action = d.action;
            Object.entries(d.fields).forEach(([name, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = value;
                formEl.appendChild(input);
            });
            document.body.appendChild(formEl);
            formEl.submit();
        } catch (err) {
            setLinking(false);
            setFormMessage({ ok: false, text: err.response?.data?.message || tr('wallet.card.linkFailed') });
        }
    };

    const removeCard = async () => {
        if (!window.confirm(tr('wallet.card.confirmRemove'))) return;
        try {
            await axios.delete('/payouts/card');
            load();
        } catch {
            setFormMessage({ ok: false, text: tr('wallet.card.removeFailed') });
        }
    };
    useEffect(() => { load(); }, [load]);

    const transactions = useMemo(() => (data?.transactions || []).map(t => {
        const d = new Date(t.createdAt);
        return { ...t, year: String(d.getFullYear()), month: MONTHS[d.getMonth()].code };
    }), [data]);

    const years = useMemo(() => {
        const set = new Set(transactions.map(t => t.year));
        set.add(String(new Date().getFullYear()));
        return [...set].sort().reverse();
    }, [transactions]);

    // Earnings (sales and commissions) of the selected year
    const income = useMemo(
        () => transactions.filter(t => t.year === activeYear && t.amount > 0 && t.status !== 'rejected'),
        [transactions, activeYear]
    );
    const incomesByMonth = MONTHS.map(m => ({
        ...m,
        income: income.filter(t => t.month === m.code).reduce((s, t) => s + t.amount, 0),
    }));
    const maxIncome = incomesByMonth.reduce((mx, m) => Math.max(mx, m.income), 0) || 1;

    const categoryStats = useMemo(() => {
        const scope = selectedMonth ? income.filter(t => t.month === selectedMonth) : income;
        const total = scope.reduce((s, t) => s + t.amount, 0);
        const byType = {};
        scope.forEach(t => { byType[t.type] = (byType[t.type] || 0) + t.amount; });
        return Object.entries(byType)
            .map(([type, amount]) => ({ name: type, amount, percent: total ? Math.round((amount / total) * 100) : 0 }))
            .sort((a, b) => b.amount - a.amount);
    }, [income, selectedMonth]);

    const filteredTransactions = useMemo(() => transactions.filter(t =>
        t.year === activeYear && (!selectedMonth || t.month === selectedMonth)), [transactions, activeYear, selectedMonth]);

    const { currentPage, setCurrentPage, totalPages, displayedData } = usePagination(filteredTransactions, 5);

    const submitWithdrawal = async (e) => {
        e.preventDefault();
        setSending(true);
        setFormMessage(null);
        try {
            const { data: r } = await axios.post('/wallet/withdrawals', method === 'card'
                ? { amount: Number(form.amount), method: 'card' }
                : { amount: Number(form.amount), iban: form.iban });
            const status = r.withdrawal?.status;
            if (method !== 'card') setFormMessage({ ok: true, text: tr('wallet.requested') });
            else if (status === 'paid') setFormMessage({ ok: true, text: tr('wallet.card.paid') });
            else if (status === 'rejected') setFormMessage({ ok: false, text: tr('wallet.card.rejected') });
            else setFormMessage({ ok: true, text: tr('wallet.card.processing') });
            setForm({ amount: '', iban: '' });
            load();
        } catch (err) {
            setFormMessage({ ok: false, text: err.response?.data?.message || tr('wallet.requestFailed') });
        } finally {
            setSending(false);
        }
    };

    if (error) return <div className={styles.walletContainer}><p className={styles.noData}>{error}</p></div>;
    if (!data) return <div className={styles.walletContainer}><p className={styles.noData}>{tr('common.loading')}</p></div>;

    return (
        <div className={styles.walletContainer}>
            {/* Баланс і виведення коштів */}
            <div className={styles.balanceRow}>
                <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>{tr('wallet.available')}</span>
                    <span className={styles.balanceValue}>{formatMoney(data.balance.available)}</span>
                </div>
                <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>{tr('wallet.escrow')}</span>
                    <span className={styles.balanceValueMuted}>{formatMoney(data.balance.escrow)}</span>
                    <span className={styles.balanceHint}>{tr('wallet.escrowHint')}</span>
                </div>
                <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>{tr('wallet.withdrawing')}</span>
                    <span className={styles.balanceValueMuted}>{formatMoney(data.balance.withdrawing)}</span>
                </div>
                <form className={styles.withdrawForm} onSubmit={submitWithdrawal}>
                    <span className={styles.balanceLabel}>{tr('wallet.withdrawTitle')}</span>
                    {payout.enabled && (
                        <div className={styles.cardRow}>
                            {payout.card ? (
                                <>
                                    <span>{tr('wallet.card.linked', { mask: payout.card.mask })}</span>
                                    <button type="button" className={styles.linkBtn} onClick={linkCard} disabled={linking}>{tr('wallet.card.change')}</button>
                                    <button type="button" className={styles.linkBtn} onClick={removeCard}>{tr('common.remove')}</button>
                                </>
                            ) : (
                                <button type="button" className={styles.linkBtn} onClick={linkCard} disabled={linking}>
                                    {linking ? tr('auth.sending') : tr('wallet.card.link')}
                                </button>
                            )}
                        </div>
                    )}
                    {payout.enabled && payout.card && (
                        <div className={styles.methodRow} role="radiogroup" aria-label={tr('wallet.card.method')}>
                            {['card', 'iban'].map(m => (
                                <label key={m} className={styles.methodOption}>
                                    <input type="radio" name="withdraw-method" value={m} checked={method === m} onChange={() => setMethod(m)} />
                                    {tr(`wallet.card.to_${m}`)}
                                </label>
                            ))}
                        </div>
                    )}
                    <input
                        className={styles.withdrawInput}
                        type="number"
                        min={data.minWithdrawal}
                        step="0.01"
                        max={data.balance.available}
                        placeholder={tr('wallet.amountPlaceholder', { min: data.minWithdrawal })}
                        value={form.amount}
                        onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                        required
                        aria-label={tr('wallet.amountLabel')}
                    />
                    {method === 'iban' && (
                        <input
                            className={styles.withdrawInput}
                            placeholder="IBAN (UA…)"
                            value={form.iban}
                            onChange={(e) => setForm(f => ({ ...f, iban: e.target.value }))}
                            required
                            aria-label="IBAN"
                        />
                    )}
                    <button className={styles.withdrawBtn} type="submit" disabled={sending || data.balance.available < data.minWithdrawal}>
                        {sending ? tr('auth.sending') : tr('wallet.request')}
                    </button>
                    {formMessage && (
                        <span role="status" className={formMessage.ok ? styles.formOk : styles.formError}>{formMessage.text}</span>
                    )}
                    {data.feePercent > 0 && <span className={styles.balanceHint}>{tr('wallet.fee', { percent: data.feePercent })}</span>}
                </form>
            </div>

            <header className={styles.header}>
                <div className={styles.headerActions}>
                    <div className={styles.yearFilterWrapper}>
                        <CategoryFilters
                            categories={years}
                            activeCategory={activeYear}
                            onCategoryClick={(year) => {
                                setActiveYear(year);
                                setSelectedMonth(null);
                                setCurrentPage(0);
                            }}
                        />
                    </div>
                </div>
            </header>

            {/* Верхня зона: ліворуч 12 місяців, праворуч картка категорій */}
            <div className={styles.topGrid}>
                <div className={styles.monthsPanel}>
                    {incomesByMonth.map((m) => {
                        const percent = Math.round((m.income / maxIncome) * 100);
                        const active = selectedMonth === m.code;
                        return (
                            <button
                                key={m.label}
                                className={`${styles.monthRow} ${active ? styles.monthActive : ''}`}
                                onClick={() => {
                                    setSelectedMonth(active ? null : m.code);
                                    setCurrentPage(0);
                                }}
                                title={tr('wallet.monthIncome', { amount: formatMoney(m.income) })}
                            >
                                <div className={styles.barTrack}>
                                    <div className={styles.barFill} style={{ width: `${percent}%` }} />
                                </div>
                                <span className={styles.monthLabel}>{tr(`wallet.months.${m.code}`)}</span>
                            </button>
                        );
                    })}
                </div>

                <aside className={styles.categoryCard}>
                    <div className={styles.categoryCardInner}>
                        <div className={styles.categoryHeader}>{tr('wallet.category')}</div>
                        <div className={styles.categoryListCompact}>
                            {categoryStats.length === 0 && <div className={styles.categoryLine}><span className={styles.categoryName}>{tr('wallet.noIncome')}</span></div>}
                            {categoryStats.map((cat) => (
                                <div key={cat.name} className={styles.categoryLine}>
                                    <span className={styles.categoryName}>{tr(`wallet.types.${cat.name}`, { defaultValue: cat.name })}</span>
                                    <span className={styles.categoryPercent}>{cat.percent}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Історія операцій */}
            <div className={styles.transactionsSection}>
                <div className={styles.tableWrapper}>
                    <table className={styles.transactionTableDark}>
                        <thead>
                        <tr>
                            <th>{tr('wallet.amount')}</th>
                            <th>{tr('wallet.date')}</th>
                            <th>{tr('wallet.from')}</th>
                            <th>{tr('wallet.details')}</th>
                            <th>{tr('wallet.type')}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {displayedData.length > 0 ? (
                            displayedData.map((t) => (
                                <tr key={t.id} className={styles.rowDark}>
                                    <td className={`${styles.profitCell} ${t.amount > 0 ? styles.income : styles.expense}`}>
                                        {t.amount > 0 ? '+' : ''}{formatMoney(t.amount)}
                                    </td>
                                    <td>{formatDate(t.createdAt)}</td>
                                    <td>{t.payer || '—'}</td>
                                    <td>{t.description}</td>
                                    <td>
                                        {tr(`wallet.types.${t.type}`, { defaultValue: t.type })}
                                        {t.status !== 'completed' && <span className={styles.status}> · {tr(`wallet.txStatus.${t.status === 'pending' && t.type === 'commission' ? 'escrow' : t.status}`, { defaultValue: t.status })}</span>}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className={styles.noData}>{tr('wallet.noTransactions')}</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {filteredTransactions.length > 0 && (
                    <div className={styles.paginationWrapperDark}>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Wallet;
