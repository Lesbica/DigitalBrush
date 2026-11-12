import React, { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from './Wallet.module.css';
import CategoryFilters from '../../../../CategoryFilters/CategoryFilters';
import Pagination from '../../../../hooks/Pagination/Pagination';
import { usePagination } from '../../../../hooks/Pagination/usePagination';

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

const TYPE_LABEL = { sale: 'Paintings', commission: 'Commissions', withdrawal: 'Withdrawal', adjustment: 'Adjustment' };
const money = (v) => Number(v).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Artist wallet: balance, income by month, history and withdrawal requests (data from /api/wallet)
const Wallet = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [activeYear, setActiveYear] = useState(String(new Date().getFullYear()));
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [form, setForm] = useState({ amount: '', iban: '' });
    const [formMessage, setFormMessage] = useState(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(() => {
        axios.get('/wallet')
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.message || 'Could not load the wallet'));
    }, []);
    useEffect(() => { load(); }, [load]);

    const transactions = useMemo(() => (data?.transactions || []).map(t => {
        const d = new Date(t.createdAt);
        return { ...t, year: String(d.getFullYear()), month: MONTHS[d.getMonth()].code, date: d.toLocaleDateString() };
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
            .map(([type, amount]) => ({ name: TYPE_LABEL[type] || type, amount, percent: total ? Math.round((amount / total) * 100) : 0 }))
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
            await axios.post('/wallet/withdrawals', { amount: Number(form.amount), iban: form.iban });
            setFormMessage({ ok: true, text: 'Withdrawal requested. The money is usually sent within 3 business days.' });
            setForm({ amount: '', iban: '' });
            load();
        } catch (err) {
            setFormMessage({ ok: false, text: err.response?.data?.message || 'Could not create the request' });
        } finally {
            setSending(false);
        }
    };

    if (error) return <div className={styles.walletContainer}><p className={styles.noData}>{error}</p></div>;
    if (!data) return <div className={styles.walletContainer}><p className={styles.noData}>Loading…</p></div>;

    return (
        <div className={styles.walletContainer}>
            {/* Баланс і виведення коштів */}
            <div className={styles.balanceRow}>
                <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>AVAILABLE</span>
                    <span className={styles.balanceValue}>{money(data.balance.available)} ₴</span>
                </div>
                <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>IN ESCROW</span>
                    <span className={styles.balanceValueMuted}>{money(data.balance.escrow)} ₴</span>
                    <span className={styles.balanceHint}>paid commissions, released when completed</span>
                </div>
                <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>WITHDRAWING</span>
                    <span className={styles.balanceValueMuted}>{money(data.balance.withdrawing)} ₴</span>
                </div>
                <form className={styles.withdrawForm} onSubmit={submitWithdrawal}>
                    <span className={styles.balanceLabel}>WITHDRAW TO BANK ACCOUNT</span>
                    <input
                        className={styles.withdrawInput}
                        type="number"
                        min={data.minWithdrawal}
                        step="0.01"
                        max={data.balance.available}
                        placeholder={`Amount, min ${data.minWithdrawal} ₴`}
                        value={form.amount}
                        onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                        required
                        aria-label="Amount in UAH"
                    />
                    <input
                        className={styles.withdrawInput}
                        placeholder="IBAN (UA…)"
                        value={form.iban}
                        onChange={(e) => setForm(f => ({ ...f, iban: e.target.value }))}
                        required
                        aria-label="IBAN"
                    />
                    <button className={styles.withdrawBtn} type="submit" disabled={sending || data.balance.available < data.minWithdrawal}>
                        {sending ? 'Sending…' : 'Request withdrawal'}
                    </button>
                    {formMessage && (
                        <span role="status" className={formMessage.ok ? styles.formOk : styles.formError}>{formMessage.text}</span>
                    )}
                    {data.feePercent > 0 && <span className={styles.balanceHint}>Platform fee: {data.feePercent}% of each sale</span>}
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
                                title={`Income: ${money(m.income)} ₴`}
                            >
                                <div className={styles.barTrack}>
                                    <div className={styles.barFill} style={{ width: `${percent}%` }} />
                                </div>
                                <span className={styles.monthLabel}>{m.label}</span>
                            </button>
                        );
                    })}
                </div>

                <aside className={styles.categoryCard}>
                    <div className={styles.categoryCardInner}>
                        <div className={styles.categoryHeader}>CATEGORY</div>
                        <div className={styles.categoryListCompact}>
                            {categoryStats.length === 0 && <div className={styles.categoryLine}><span className={styles.categoryName}>No income yet</span></div>}
                            {categoryStats.map((cat) => (
                                <div key={cat.name} className={styles.categoryLine}>
                                    <span className={styles.categoryName}>{cat.name}</span>
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
                            <th>AMOUNT</th>
                            <th>DATE</th>
                            <th>FROM</th>
                            <th>DETAILS</th>
                            <th>TYPE</th>
                        </tr>
                        </thead>
                        <tbody>
                        {displayedData.length > 0 ? (
                            displayedData.map((t) => (
                                <tr key={t.id} className={styles.rowDark}>
                                    <td className={`${styles.profitCell} ${t.amount > 0 ? styles.income : styles.expense}`}>
                                        {t.amount > 0 ? '+' : ''}{money(t.amount)}
                                    </td>
                                    <td>{t.date}</td>
                                    <td>{t.payer || '—'}</td>
                                    <td>{t.description}</td>
                                    <td>
                                        {TYPE_LABEL[t.type] || t.type}
                                        {t.status !== 'completed' && <span className={styles.status}> · {t.status === 'pending' && t.type === 'commission' ? 'in escrow' : t.status}</span>}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className={styles.noData}>No transactions for this period</td>
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
