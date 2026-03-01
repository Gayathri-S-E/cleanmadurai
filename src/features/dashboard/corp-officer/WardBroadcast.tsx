import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import type { Broadcast } from '../../../types';
import { Send, MessageSquare, Clock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './WardBroadcast.module.css';

const MAX_CHARS = 120;

function timeAgo(ts: any) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function WardBroadcast() {
    const { profile } = useAuth();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);

    const ward = profile?.ward ?? 'All';

    const fetchHistory = () => {
        const q = query(
            collection(db, 'broadcasts'),
            orderBy('sentAt', 'desc'),
            limit(20)
        );
        getDocs(q)
            .then(snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast))))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchHistory(); }, []);

    const send = async () => {
        if (!message.trim() || !profile) return;
        setSending(true);
        try {
            // Count users in this ward for recipientCount
            const usersSnap = await getDocs(
                query(collection(db, 'users'), where('ward', '==', ward))
            );
            await addDoc(collection(db, 'broadcasts'), {
                officerId: profile.uid,
                officerName: profile.displayName,
                ward,
                message: message.trim(),
                recipientCount: usersSnap.size,
                sentAt: serverTimestamp(),
            } as Omit<Broadcast, 'id'>);
            toast.success(`Broadcast sent to ${usersSnap.size} citizens in ${ward}!`);
            setMessage('');
            fetchHistory();
        } catch {
            toast.error('Failed to send broadcast');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h2 className={styles.title}>📢 Ward Broadcast</h2>
                <p className={styles.subtitle}>Send a message to all citizens in <strong>{ward}</strong></p>
            </div>

            <div className={styles.composeCard}>
                <label className={styles.label}>Your Message</label>
                <textarea
                    className={styles.textarea}
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
                    rows={4}
                    placeholder="e.g. Special waste collection drive tomorrow morning from 7 AM. Please keep bins outside."
                />
                <div className={styles.charCount}>
                    <span style={{ color: message.length > MAX_CHARS * 0.9 ? '#EF4444' : 'var(--text-muted)' }}>
                        {message.length}/{MAX_CHARS}
                    </span>
                    <button
                        className={styles.sendBtn}
                        onClick={send}
                        disabled={!message.trim() || sending}
                    >
                        <Send size={15} />
                        {sending ? 'Sending…' : 'Send to Ward'}
                    </button>
                </div>
            </div>

            <div className={styles.historySection}>
                <h3 className={styles.historyTitle}>Sent Broadcasts</h3>
                {loading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>
                ) : history.length === 0 ? (
                    <div className={styles.empty}>
                        <MessageSquare size={32} opacity={0.3} />
                        <p>No broadcasts sent yet</p>
                    </div>
                ) : (
                    <div className={styles.historyList}>
                        {history.map(b => (
                            <div key={b.id} className={styles.historyCard}>
                                <p className={styles.historyMsg}>{b.message}</p>
                                <div className={styles.historyMeta}>
                                    <span><Users size={12} /> {b.recipientCount} recipients · Ward {b.ward}</span>
                                    <span><Clock size={12} /> {timeAgo(b.sentAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
