import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { CleanEvent } from '../../types';
import { Calendar, MapPin, Users, Plus, CheckCircle, Clock, Leaf, Eye, X, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './EventsPage.module.css';

const EVENT_TYPE_COLORS: Record<string, string> = {
    cleanup: '#10B981',
    awareness: '#3B82F6',
    inspection: '#8B5CF6',
    plantation: '#F59E0B',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
    cleanup: '🧹 Cleanup',
    awareness: '📢 Awareness',
    inspection: '🔍 Inspection',
    plantation: '🌱 Plantation',
};

function formatDate(ts: any) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(ts: any) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function EventModal({ onClose, onSaved, eventToEdit }: { onClose: () => void; onSaved: () => void; eventToEdit?: CleanEvent }) {
    const { user, profile } = useAuth();
    const [title, setTitle] = useState(eventToEdit?.title || '');
    const [type, setType] = useState<CleanEvent['type']>(eventToEdit?.type || 'cleanup');

    // Format date/time string from firestore timestamp for input
    const initialDateObj = eventToEdit?.date ? (eventToEdit.date as any).toDate?.() || new Date(eventToEdit.date) : null;
    const initialDateStr = initialDateObj ? initialDateObj.toISOString().split('T')[0] : '';
    const initialTimeStr = initialDateObj ? initialDateObj.toTimeString().slice(0, 5) : '';

    const [date, setDate] = useState(initialDateStr);
    const [time, setTime] = useState(initialTimeStr);
    const [maxSlots, setMaxSlots] = useState(eventToEdit?.maxSlots || 30);
    const [address, setAddress] = useState(eventToEdit?.address || '');
    const [description, setDescription] = useState(eventToEdit?.description || '');
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (!title || !date || !time || !user || !profile) return;
        setSubmitting(true);
        try {
            const dateTime = new Date(`${date}T${time}`);
            if (eventToEdit) {
                await updateDoc(doc(db, 'events', eventToEdit.id), {
                    title,
                    type,
                    date: dateTime,
                    maxSlots,
                    address,
                    description,
                });
                toast.success('Event updated! 🎉');
            } else {
                await addDoc(collection(db, 'events'), {
                    title,
                    type,
                    date: dateTime,
                    maxSlots,
                    address,
                    description,
                    organizerId: user.uid,
                    organizerName: profile.displayName,
                    organizerRole: profile.roles?.[0] ?? 'citizen',
                    location: { lat: 9.9252, lng: 78.1198 }, // Madurai default
                    attendees: [],
                    photos: [],
                    kgCollected: 0,
                    status: 'upcoming',
                    createdAt: serverTimestamp(),
                } as Omit<CleanEvent, 'id'>);
                toast.success('Event created! 🎉');
            }
            onSaved();
        } catch {
            toast.error(`Failed to ${eventToEdit ? 'update' : 'create'} event`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{eventToEdit ? 'Edit Event' : 'Create Event'}</h3>
                    <button onClick={onClose} className={styles.closeBtn}><X size={18} /></button>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Event Name</label>
                    <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Ward 12 Cleanup Drive" />
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Type</label>
                        <select className={styles.input} value={type} onChange={e => setType(e.target.value as CleanEvent['type'])}>
                            <option value="cleanup">Cleanup</option>
                            <option value="awareness">Awareness</option>
                            <option value="inspection">Inspection</option>
                            <option value="plantation">Plantation</option>
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Max Slots</label>
                        <input className={styles.input} type="number" min={1} value={maxSlots} onChange={e => setMaxSlots(+e.target.value)} />
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Date</label>
                        <input className={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Time</label>
                        <input className={styles.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Location</label>
                    <input className={styles.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Near Meenakshi Temple North Gate" />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Description (optional)</label>
                    <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What will participants do?" />
                </div>

                <button className={styles.submitBtn} onClick={submit} disabled={!title || !date || !time || submitting}>
                    {submitting ? 'Saving…' : (eventToEdit ? 'Update Event' : 'Create Event')}
                </button>
            </div>
        </div>
    );
}

export default function EventsPage() {
    const { user, profile, hasRole } = useAuth();
    const [events, setEvents] = useState<CleanEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<CleanEvent | undefined>();
    const [tab, setTab] = useState<'upcoming' | 'my'>('upcoming');

    const canCreate = hasRole(['corp_officer', 'corp_admin', 'system_admin', 'super_admin', 'zonal_officer', 'ward_officer', 'college_admin']);

    const fetchEvents = () => {
        getDocs(collection(db, 'events'))
            .then(snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CleanEvent))))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchEvents(); }, []);

    const joinEvent = async (event: CleanEvent) => {
        if (!user) return;
        if (event.attendees.includes(user.uid)) { toast('You already joined this event!'); return; }
        if (event.attendees.length >= event.maxSlots) { toast.error('This event is full'); return; }
        await updateDoc(doc(db, 'events', event.id), { attendees: arrayUnion(user.uid) });
        toast.success('Joined! See you there 🙌');
        fetchEvents();
    };

    const deleteEvent = async (id: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            await deleteDoc(doc(db, 'events', id));
            toast.success('Event deleted');
            fetchEvents();
        } catch {
            toast.error('Failed to delete event');
        }
    };

    const filtered = tab === 'upcoming'
        ? events.filter(e => e.status === 'upcoming')
        : events.filter(e => user && e.attendees.includes(user.uid));

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>📅 Events & Drives</h1>
                <p className={styles.subtitle}>Community cleanup events · Madurai</p>
            </div>

            <div className={styles.topRow}>
                <div className={styles.tabRow}>
                    <button className={`${styles.tab} ${tab === 'upcoming' ? styles.tabActive : ''}`} onClick={() => setTab('upcoming')}>Upcoming</button>
                    <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} onClick={() => setTab('my')}>My Events</button>
                </div>
                {canCreate && (
                    <button className={styles.createBtn} onClick={() => { setEventToEdit(undefined); setShowModal(true); }}>
                        <Plus size={16} /> Create
                    </button>
                )}
            </div>

            {loading ? (
                <div className={styles.loading}>Loading events…</div>
            ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                    <span style={{ fontSize: 48 }}>📅</span>
                    <p>{tab === 'upcoming' ? 'No upcoming events.' : 'You haven\'t joined any events yet.'}</p>
                </div>
            ) : (
                <div className={styles.list}>
                    {filtered.map(ev => {
                        const isJoined = user && ev.attendees.includes(user.uid);
                        const isFull = ev.attendees.length >= ev.maxSlots;
                        const typeColor = EVENT_TYPE_COLORS[ev.type] ?? '#10B981';
                        return (
                            <div key={ev.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <span className={styles.typeBadge} style={{ background: typeColor + '22', color: typeColor }}>
                                        {EVENT_TYPE_LABELS[ev.type]}
                                    </span>
                                    <span className={styles.slots} style={{ color: isFull ? '#EF4444' : 'var(--text-muted)' }}>
                                        <Users size={13} /> {ev.attendees.length}/{ev.maxSlots}
                                    </span>
                                </div>

                                <div className={styles.cardTitle}>{ev.title}</div>

                                {ev.address && (
                                    <div className={styles.cardMeta}>
                                        <MapPin size={13} /> {ev.address}
                                    </div>
                                )}

                                <div className={styles.cardMeta}>
                                    <Calendar size={13} /> {formatDate(ev.date)} · {formatTime(ev.date)}
                                </div>

                                <div className={styles.cardMeta} style={{ fontStyle: 'italic' }}>
                                    Organized by {ev.organizerName}
                                </div>

                                {ev.description && (
                                    <p className={styles.cardDesc}>{ev.description}</p>
                                )}

                                <div className={styles.cardActions}>
                                    {canCreate && (
                                        <div className={styles.officerActions} style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => { setEventToEdit(ev); setShowModal(true); }}
                                                title="Edit Event"
                                                style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-color)' }}
                                            ><Edit2 size={16} /></button>
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => deleteEvent(ev.id)}
                                                title="Delete Event"
                                                style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: '#EF4444' }}
                                            ><Trash2 size={16} /></button>
                                        </div>
                                    )}

                                    {isJoined ? (
                                        <div className={styles.joinedBadge}>
                                            <CheckCircle size={15} /> Joined
                                        </div>
                                    ) : (
                                        <button
                                            className={styles.joinBtn}
                                            onClick={() => joinEvent(ev)}
                                            disabled={isFull}
                                        >
                                            {isFull ? 'Full' : 'Join Event'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <EventModal
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); fetchEvents(); }}
                    eventToEdit={eventToEdit}
                />
            )}
        </div>
    );
}
