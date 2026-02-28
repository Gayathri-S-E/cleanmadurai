import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckCircle, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Notification {
    id: string;
    title: string;
    body: string;
    type: 'status_update' | 'system';
    read: boolean;
    createdAt: any;
    link?: string;
}

export default function NotificationsList() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `users/${user.uid}/notifications`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
        }, (err) => {
            console.error('NotificationsList onSnapshot error:', err);
        });
        return () => unsubscribe();
    }, [user]);

    const markAllRead = async () => {
        if (!user || notifications.length === 0) return;
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;

        const batch = writeBatch(db);
        unread.forEach(n => {
            batch.update(doc(db, `users/${user.uid}/notifications`, n.id), { read: true });
        });
        await batch.commit();
    };

    return (
        <div style={{ padding: 'var(--space-4)', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Notifications</h1>
                <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
            </div>
            {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                    <Bell size={48} style={{ margin: '0 auto', opacity: 0.5, marginBottom: 'var(--space-4)' }} />
                    <p>No notifications yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {notifications.map(n => (
                        <div key={n.id} style={{
                            padding: 'var(--space-4)',
                            background: n.read ? 'var(--bg-card)' : 'var(--bg-surface)',
                            border: n.read ? '1px solid var(--border-subtle)' : '1px solid var(--color-primary-300)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            gap: 'var(--space-3)'
                        }}>
                            <div style={{ color: n.read ? 'var(--text-muted)' : 'var(--color-primary-500)', marginTop: '2px' }}>
                                {n.type === 'status_update' ? <Info size={20} /> : <CheckCircle size={20} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>{n.title}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{n.body}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : 'Just now'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
