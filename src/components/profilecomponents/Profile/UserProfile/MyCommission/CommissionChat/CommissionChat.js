import React, {useEffect, useState, useRef, useCallback} from 'react';
import axios from 'axios';
import styles from './CommissionChat.module.css';
import placeholderImg from '../../../../../../assets/image-placeholder-icon.svg';
import ImageViewer from "../../../../../ArtCard/ImageViewer/ImageViewer";
import CommissionModalDetails from "../../../../../Commission/CommissionModals/CommissionModalDetails";
import ReviewBox from './ReviewBox';
import { useSocket, useCommissionRoom } from '../../../../../../context/SocketContext';
import { useToast } from '../../../../../../context/ToastContext';
// Іконки
const CheckIcon = () => (<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>);
const CrossIcon = () => (<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>);

// Server chat message -> view model (the partner avatar is picked at render time)
const mapServerMsg = (m) => {
    const isImage = m.type === 'image';
    return {
        id: m.id,
        text: m.type === 'text' ? m.content : '',
        image: isImage ? (m.image || m.content || null) : null,
        senderId: m.senderId,
        timestamp: m.timestamp,
    };
};

const CommissionChat = ({ commissionId, user, onBack }) => {
    const toast = useToast();
    const [commission, setCommission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Sketch');
    // Подача на ревью
    const [pendingStageImage, setPendingStageImage] = useState(null);
    const [pendingStageMessageId, setPendingStageMessageId] = useState(null);
    const [stageDecision, setStageDecision] = useState(null); // 'approve' | 'reject' | null
    const [submittingStage, setSubmittingStage] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const fileInputRef = useRef(null); // для «Submit for review» (ліва колонка)
    const fileInputChatRef = useRef(null); // для картинки прямо в чат (скрепка)

    const [mainImage, setMainImage] = useState(null);
    // Прев'ю нижче головного більше не відображаємо, залишаємо тільки головне зображення
    const [previewImages, setPreviewImages] = useState([]);

    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

    // Модальне вікно деталей комісії (має бути оголошене до будь-яких ранніх return)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Дані співрозмовника (ім'я + аватар)
    const [partnerName, setPartnerName] = useState('');
    const [partnerAvatar, setPartnerAvatar] = useState(null);

    const [messages, setMessages] = useState([]);
    const socket = useSocket();
    useCommissionRoom(socket, commissionId);
    const [inputText, setInputText] = useState('');
    // автопрокрутка чата
    const messagesEndRef = useRef(null);
    const scrollToBottom = useCallback((smooth = true) => {
        try {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
            }
        } catch (e) { /* element already unmounted */ }
    }, []);

    useEffect(() => {
        axios.get(`/commissions/${commissionId}`)
            .then(res => {
                if (res.data.success) {
                    const commData = res.data.commission;
                    setCommission(commData);
                    setStatus(commData.status || 'Sketch');

                    // --- ІНІЦІАЛІЗАЦІЯ ЗОБРАЖЕНЬ ---
                    if (commData.images && commData.images.length > 0) {
                        setMainImage(commData.images[0]);
                        // Логіку нижніх прев'ю прибираємо
                        setPreviewImages([]);
                    } else {
                        setMainImage(placeholderImg);
                        setPreviewImages([]);
                    }
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [commissionId]);

    // Load chat history and the last stage submission for this commission
    useEffect(() => {
        if (!commissionId) return undefined;
        let cancelled = false;

        const loadMessages = async () => {
            try {
                const res = await axios.get(`/commissions/chat/${commissionId}/messages`);
                if (cancelled || !res.data?.messages) return;
                const all = res.data.messages;
                setMessages(all.filter(m => m.type === 'text' || m.type === 'image').map(mapServerMsg));

                const lastStage = [...all]
                    .filter(m => m.type === 'stage')
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .pop();

                if (lastStage) {
                    setPendingStageImage(lastStage.image || lastStage.content || null);
                    setPendingStageMessageId(lastStage.id);
                    const lastReview = [...all]
                        .filter(m => (m.type === 'stage-approve' || m.type === 'stage-reject') && String(m.content) === String(lastStage.id))
                        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                        .pop();
                    setStageDecision(lastReview ? (lastReview.type === 'stage-approve' ? 'approve' : 'reject') : null);
                } else {
                    setPendingStageImage(null);
                    setPendingStageMessageId(null);
                    setStageDecision(null);
                }
            } catch (err) {
                console.error('Failed to load chat messages:', err);
            }
        };

        loadMessages();
        return () => { cancelled = true; };
    }, [commissionId]);

    // Live updates over the shared socket (the room is joined by useCommissionRoom)
    useEffect(() => {
        if (!socket || !commissionId) return undefined;
        const isThisCommission = (payload) => payload && String(payload.commissionId) === String(commissionId);

        const onNewMessage = (msg) => {
            if (!isThisCommission(msg)) return;
            const mapped = mapServerMsg(msg);
            setMessages(prev => (prev.some(m => String(m.id) === String(mapped.id)) ? prev : [...prev, mapped]));
        };
        const onPaymentUpdate = (payload) => {
            if (!isThisCommission(payload)) return;
            setCommission(prev => (prev ? { ...prev, is_paid: 1 } : prev));
        };
        const onStageSubmitted = (payload) => {
            if (!isThisCommission(payload)) return;
            const m = payload.message || {};
            setPendingStageImage(m.image || m.content || null);
            setPendingStageMessageId(m.id);
            setStageDecision(null);
            setCommission(prev => (prev ? { ...prev, reviewState: 'pending', stageSubmittedAt: new Date().toISOString() } : prev));
        };
        const onStageReview = (payload) => {
            if (!isThisCommission(payload)) return;
            setStageDecision(payload.decision);
            if (payload.nextStatus) setStatus(payload.nextStatus);
            setCommission(prev => (prev ? { ...prev, reviewState: payload.decision === 'reject' ? 'changes_requested' : 'none', autoApproveAt: null } : prev));
        };
        const onStatusUpdated = (payload) => {
            if (!isThisCommission(payload) || !payload.status) return;
            setStatus(payload.status);
            setCommission(prev => (prev ? { ...prev, Status: payload.status, status: payload.status } : prev));
        };

        socket.on('newMessage', onNewMessage);
        socket.on('paymentUpdate', onPaymentUpdate);
        socket.on('stageSubmitted', onStageSubmitted);
        socket.on('stageReview', onStageReview);
        socket.on('statusUpdated', onStatusUpdated);
        return () => {
            socket.off('newMessage', onNewMessage);
            socket.off('paymentUpdate', onPaymentUpdate);
            socket.off('stageSubmitted', onStageSubmitted);
            socket.off('stageReview', onStageReview);
            socket.off('statusUpdated', onStatusUpdated);
        };
    }, [socket, commissionId]);

    // автопрокрутка при изменении сообщений
    useEffect(() => {
        if (messages && messages.length) {
            // плавно только при добавлении небольшого количества
            scrollToBottom(true);
        }
    }, [messages, scrollToBottom]);

    // Коли відомий commission і user — завантажуємо профіль співрозмовника
    useEffect(() => {
        if (!commission || !user?.id) return;

        const currentUserId = Number(user.id);
        const creatorId = Number(commission.Creator_ID);
        const customerId = Number(commission.Customer_ID);

        // Обираємо ID співрозмовника: якщо я замовник — співрозмовник виконавець, і навпаки
        const partnerId = currentUserId === customerId ? creatorId : customerId;
        if (!partnerId) return;

        axios.get(`/artists/artist/${partnerId}`)
            .then((res) => {
                const artist = res.data;
                // Сервер нормалізує поля як name та avatar (imageBase64)
                setPartnerName(artist?.name || artist?.Name || 'User');
                setPartnerAvatar(artist?.avatar || artist?.imageBase64 || null);
            })
            .catch((err) => {
                console.error('Failed to load chat partner profile:', err);
            });
    }, [commission, user]);

    // Нижні прев'ю вимкнені — логіка swap більше не потрібна

    const openImageViewer = useCallback(() => {
        // Відкриваємо тільки головне зображення
        if (mainImage && mainImage !== placeholderImg) {
            setViewerInitialIndex(0);
            setIsViewerOpen(true);
        }
    }, [mainImage]);

    const closeImageViewer = useCallback(() => {
        setIsViewerOpen(false);
    }, []);

    if (loading) return <div className={styles.chatContainer}>Loading...</div>;
    if (!commission) return <div className={styles.chatContainer}>Commission not found</div>;

    // --- ПЕРЕВІРКА РОЛЕЙ ---
    // Приводимо до числа, щоб уникнути помилок типу "2" !== 2
    const currentUserId = Number(user.id);
    const creatorId = Number(commission.Creator_ID);
    const customerId = Number(commission.Customer_ID);

    const isCustomer = currentUserId === customerId;
    const isCreator = currentUserId === creatorId;

    console.log(`User: ${currentUserId}, Creator: ${creatorId}, IsCreator: ${isCreator}`);

    // --- ФУНКЦІОНАЛ ---
    const handleAddSketchClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Отправка на ревью (ліва колонка)
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Optional: limit file size (e.g., 5MB)
            const MAX_SIZE = 5 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error('File is too large. Max 5MB');
                return;
            }

            // read file as data URL and send to server as STAGE submission
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                try {
                    setSubmittingStage(true);
                    const payload = { image: dataUrl };
                    const res = await axios.post(`/commissions/chat/${commissionId}/submit-stage`, payload);
                    if (res.data && res.data.success) {
                        const m = res.data.message || {};
                        setPendingStageImage(m.image || dataUrl);
                        setPendingStageMessageId(m.id);
                        setStageDecision(null);
                    } else {
                        console.error('Stage submit failed', res.data);
                        toast.error('Failed to submit for review');
                    }
                } catch (err) {
                    console.error('Error submitting stage:', err);
                    toast.error('Error submitting for review');
                } finally {
                    setSubmittingStage(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Загрузка картинки в сам чат (скрепка)
    const handleChatFileClick = () => {
        if (fileInputChatRef.current) fileInputChatRef.current.click();
    };

    const handleChatFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            toast.error('File is too large. Max 5MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const dataUrl = reader.result;
            try {
                const res = await axios.post(`/commissions/chat/${commissionId}/messages`, { type: 'image', content: dataUrl });
                if (res.data && res.data.success) {
                    const m = res.data.message;
                    const mapped = {
                        id: m.id,
                        text: '',
                        image: m.image || dataUrl,
                        senderId: m.senderId,
                        avatar: user.profileImage || placeholderImg,
                        timestamp: m.timestamp
                    };
                    setMessages(prev => prev.some(x => String(x.id) === String(mapped.id)) ? prev : [...prev, mapped]);
                    scrollToBottom();
                } else {
                    toast.error('Failed to upload image');
                }
            } catch (err) {
                console.error('Chat image upload error:', err);
                toast.error('Error uploading image');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    // We only need to send the content; the backend finds the receiver
    const payload = {
        type: 'text',
        content: text
    };

    try {
            const res = await axios.post(`/commissions/chat/${commissionId}/messages`, payload);
        if (res.data && res.data.success) {
            const m = res.data.message;
            const mapped = {
                id: m.id,
                text: m.type === 'text' ? m.content : '',
                image: m.type === 'image' ? (m.image || m.content) : null,
                senderId: m.senderId,
                avatar: user.profileImage || placeholderImg,
                timestamp: m.timestamp
            };
            // Dedupe by id to avoid double-add when socket "echo" arrives first
            setMessages(prev =>
                prev.some(x => String(x.id) === String(mapped.id)) ? prev : [...prev, mapped]
            );
            setInputText('');
        }
    } catch (err) {
        console.error('Error sending message:', err);
    }
};

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleApproveStage = async () => {
        if (!pendingStageMessageId) return;
        try {
            setReviewLoading(true);
            const res = await axios.post(`/commissions/chat/${commissionId}/review`, { decision: 'approve', messageId: pendingStageMessageId });
            if (res.data && res.data.success) {
                setStageDecision('approve');
                if (res.data.nextStatus) setStatus(res.data.nextStatus);
                setCommission(prev => prev ? { ...prev, reviewState: 'none', autoApproveAt: null } : prev);
            }
        } catch (e) {
            console.error('approve error', e);
        } finally {
            setReviewLoading(false);
        }
    };

    const handleRejectStage = async () => {
        if (!pendingStageMessageId) return;
        try {
            setReviewLoading(true);
            const res = await axios.post(`/commissions/chat/${commissionId}/review`, { decision: 'reject', messageId: pendingStageMessageId });
            if (res.data && res.data.success) {
                setStageDecision('reject');
                setCommission(prev => prev ? { ...prev, reviewState: 'changes_requested', autoApproveAt: null } : prev);
            }
        } catch (e) {
            console.error('reject error', e);
        } finally {
            setReviewLoading(false);
        }
    };

    // src/.../CommissionChat.js

    const updateStatus = async (newStatus) => {
        try {
            // Замініть URL на ваш реальний шлях до API
            await axios.patch(`/commissions/${commissionId}/status`, { status: newStatus });

            // Оновлюємо локальний стейт
            setCommission(prev => ({ ...prev, Status: newStatus }));
            setStatus(newStatus); // Якщо у вас є окремий стейт для статусу
        } catch (error) {
            console.error("Failed to update status", error);
            toast.error("Error updating status");
        }
    };

    const chatPartnerName = partnerName || (isCustomer ? "Creator" : "Customer");

    // Відкриття модального вікна з деталями комісії по кліку на назві

    const statusLower = String(status || '').toLowerCase();
    // Stages: Sketch → Lineart → Color → Final → Completed (open/cancelled/declined → 0)
    const STAGE_ORDER = ['sketch', 'lineart', 'color', 'final', 'completed'];
    const statusProgress = STAGE_ORDER.indexOf(statusLower) + 1;
    const isWorkStage = ['sketch', 'lineart', 'color', 'final'].includes(statusLower);
    const statusNote = (() => {
        if (statusLower === 'declined') return 'The artist declined this commission.';
        if (statusLower === 'cancelled') return 'This commission was cancelled.';
        if (commission?.reviewState === 'changes_requested') return 'Changes requested — waiting for a new version.';
        if (commission?.reviewState === 'pending' && commission?.autoApproveAt) {
            return `Waiting for review · auto-approval on ${new Date(commission.autoApproveAt).toLocaleDateString()}`;
        }
        return null;
    })();

    const handlePayClick = async () => {
        try {
            // Создаем сессию оплаты через ваш backend
            const res = await axios.post('/payments/create-session', {
                commissionId: commissionId,   // сума рахується на бекенді з ціни комішену
                type: 'commission'            // Указываем тип, чтобы backend понял, что это не корзина
            });

            if (res.data && res.data.checkoutUrl) {
                window.location.href = res.data.checkoutUrl;
            } else {
                toast.error('Error creating payment session');
            }
        } catch (err) {
            console.error('Payment error:', err);
            toast.error('Failed to initiate payment');
        }
    };

    const handleDownloadClick = () => {
        const baseUrl = axios.defaults.baseURL || '';
        window.open(`${baseUrl}/commissions/download/${commissionId}`, '_blank');
    };

    return (
        <div className={styles.chatContainer}>

            {/* ЛІВА КОЛОНКА */}
            <div className={styles.detailsColumn}>

                {/* 1. Блок з фото та описом */}
                <div className={styles.headerInfo}>
                    <div className={styles.imageWrapper}>
                        <img
                            src={mainImage}
                            alt="Commission"
                            className={styles.thumbImage}
                            onClick={openImageViewer} // Відкрити Viewer при кліку
                        />
                    </div>

                    <div className={styles.textInfo}>
                        {/* Назва комісії (клікабельна для відкриття деталей) */}
                        <h4
                            className={styles.categoryTitle}
                            onClick={() => setIsDetailsOpen(true)}
                            style={{ cursor: 'pointer' }}
                        >
                            {commission?.Title || commission?.title || 'COMMISSION'}
                        </h4>

                        {/* Опис */}
                        <p className={styles.descriptionText}>
                            {commission?.description || "Create a cozy living room with a view of the forest..."}
                        </p>

                        {/* Ціна */}
                        <div className={styles.priceTag}>
                            {commission?.price != null ? `${commission.price}$` : '—'}
                        </div>
                    </div>
                </div>

                {/* 2. Статус бар (динамічні кружки) */}
                <div className={styles.statusContainer}>
                    <div className={styles.statusHeader}>
                        <div className={styles.statusTitleBlock}>
                            <div className={statusProgress > 0 ? styles.bigDot : styles.bigDotHollow}></div>
                            <span className={styles.statusName}>{status}</span>
                        </div>

                        {/* Пусті/заповнені круги праворуч */}
                        <div className={styles.dotsRow}>
                            {[2, 3, 4, 5].map(step => (
                                <div key={step} className={`${styles.hollowDot} ${statusProgress >= step ? styles.hollowDotFilled : ''}`}></div>
                            ))}
                        </div>
                    </div>
                    {(statusNote || commission?.deadline) && (
                        <div style={{ fontSize: 13, opacity: 0.85, margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {statusNote && <span>{statusNote}</span>}
                            {commission?.deadline && (
                                <span style={{ color: commission.overdue ? '#ff8a8a' : undefined }}>
                                    Deadline: {new Date(`${commission.deadline}T00:00:00`).toLocaleDateString()}{commission.overdue ? ' (overdue)' : ''}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 3. Основне поле (Рамка) */}
                    <div className={styles.stageBox}>
                        <div className={styles.imageArea}>

                            {/* --- ЛОГИКА ОТОБРАЖЕНИЯ КАРТИНКИ --- */}
                            {/* 1. Если есть активная подача на ревью (pendingStageImage) - показываем её (приоритет) */}
                            {pendingStageImage ? (
                                <img src={pendingStageImage} alt="Stage" className={styles.currentStageImage} />
                            ) : (
                                /* 2. Иначе, если статус Completed - показываем финальный результат (resultImage) */
                                statusLower === 'completed' ? (
                                    <img
                                        /* Берем resultImage из данных комишена, или mainImage как запасной вариант */
                                        src={commission.resultImage || mainImage}
                                        alt="Final Result"
                                        className={styles.currentStageImage}
                                    />
                                ) : (
                                    /* 3. Иначе (статус Open/Sketch/Edits, но нет активной подачи) - показываем референс */
                                    <img src={mainImage} alt="Reference" className={styles.currentStageImage} style={{opacity: 0.8}} />
                                )
                            )}

                            {/* --- ЛОГИКА ПОВЕРХ КАРТИНКИ (КНОПКИ) --- */}

                            {statusLower === 'completed' ? (
                                <div className={styles.actionsOverlay} style={{ flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', padding: '20px', borderRadius: '12px' }}>

                                    {commission.is_paid ? (
                                        /* 1. Якщо ОПЛАЧЕНО */
                                        <>
                                            {/* Повідомлення про успіх (бачать усі) */}
                                            <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                                                Payment Successful! ✅
                                            </div>

                                            {/* Кнопка скачування (ТІЛЬКИ ДЛЯ ЗАМОВНИКА) */}
                                            {isCustomer && (
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={handleDownloadClick}
                                                    style={{ width: 'auto', padding: '10px 20px', fontSize: '14px', borderRadius: '8px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Download Files 📥
                                                </button>
                                            )}

                                            {/* Відгук про художника (лише замовник, один раз) */}
                                            {isCustomer && (
                                                <ReviewBox
                                                    commission={commission}
                                                    onSaved={(review) => setCommission(prev => ({ ...prev, review, canReview: false }))}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        /* 2. Якщо ЩЕ НЕ оплачено */
                                        isCustomer ? (
                                            <button
                                                className={styles.actionBtn}
                                                onClick={handlePayClick}
                                                style={{ width: 'auto', padding: '10px 20px', fontSize: '14px', borderRadius: '8px', background: '#007BFF', color: '#fff', border: 'none', cursor: 'pointer' }}
                                            >
                                                Pay {commission.price}$ 💳
                                            </button>
                                        ) : (
                                            /* Повідомлення для художника */
                                            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: 4 }}>
                                                Waiting for payment... ⏳
                                            </div>
                                        )
                                    )}
                                </div>
                            ) : (
                                /* ВАРИАНТ Б: ПРОЦЕСС РАБОТЫ (Approve / Reject) */
                                <>
                                    {isCustomer && pendingStageImage && stageDecision === null && (
                                        <div className={styles.actionsOverlay}>
                                            <button className={`${styles.actionBtn} ${styles.crossBtn}`} onClick={handleRejectStage} disabled={reviewLoading}>
                                                <CrossIcon />
                                            </button>
                                            <button className={`${styles.actionBtn} ${styles.checkBtn}`} onClick={handleApproveStage} disabled={reviewLoading}>
                                                <CheckIcon />
                                            </button>
                                        </div>
                                    )}

                                    {/* Иконки уже принятого решения (галочка/крестик в углу) */}
                                    {pendingStageImage && stageDecision && (
                                        <div style={{position:'absolute', right: 8, bottom: 8, display:'flex', gap:8}}>
                                            {stageDecision === 'approve' && <div className={styles.checkBtn} style={{width:32, height:32, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center'}}><CheckIcon /></div>}
                                            {stageDecision === 'reject' && <div className={styles.crossBtn} style={{width:32, height:32, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center'}}><CrossIcon /></div>}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* КНОПКА ЗАГРУЗКИ СКЕТЧЕЙ (Только для автора и если не завершено) */}
                        {isCreator && isWorkStage && (
                            <>
                                <input type="file" ref={fileInputRef} style={{display: 'none'}} accept="image/*" onChange={handleFileChange} />
                                <div className={styles.addSketchBar} onClick={() => { if (!submittingStage) handleAddSketchClick(); }}>
                                    {submittingStage ? 'Uploading...' : `Submit ${status}`}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ПРАВА КОЛОНКА (ЧАТ) */}
            <div className={styles.chatColumn}>
                <div className={styles.chatHeader}>
                    <div className={styles.headerUserName}>
                        {chatPartnerName}
                    </div>
                    <button className={styles.backButton} onClick={onBack}>✕</button>
                </div>

                <div className={styles.messagesList}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`${styles.messageRow} ${msg.senderId === user.id ? styles.own : ''}`}>
                            {msg.senderId !== user.id && (
                                <img
                                    src={partnerAvatar || msg.avatar || placeholderImg}
                                    alt=""
                                    className={styles.userAvatar}
                                />
                            )}
                            {/* Render bubble only if there's text or image */}
                            {(msg.text || msg.image) && (
                                <div className={styles.bubble}>
                                    {msg.text && <div>{msg.text}</div>}
                                    {msg.image && <img src={msg.image} alt="" className={styles.chatImageAttachment} />}
                                </div>
                            )}
                        </div>

                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className={styles.inputArea}>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            placeholder="Write message"
                            className={styles.chatInput}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                        />
                        {/* Іконка завантаження файлу в чат */}
                        <div className={styles.inputIcon} onClick={handleChatFileClick}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="white"/>
                            </svg>
                        </div>
                        <input type="file" ref={fileInputChatRef} style={{display:'none'}} accept="image/*" onChange={handleChatFileChange} />
                        <button className={styles.sendButton} onClick={handleSendMessage}>Send</button>
                    </div>
                </div>
            </div>
            {isViewerOpen && (
                <ImageViewer
                    images={[mainImage].filter(img => img && img !== placeholderImg)}
                    initialImageIndex={viewerInitialIndex}
                    onClose={closeImageViewer}
                />
            )}
            {isDetailsOpen && (
                <CommissionModalDetails
                    commission={{ id: commission?.Commission_ID || commission?.id, imageUrl: mainImage }}
                    disableTake
                    onClose={() => setIsDetailsOpen(false)}
                />
            )}
        </div>
    );
};

export default CommissionChat;