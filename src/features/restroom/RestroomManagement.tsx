import React, { useState, useEffect } from 'react';
import {
    collection, getDocs, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Toilet } from '../../types';
import { Plus, Edit2, Trash2, X, MapPin, Star, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './RestroomManagement.module.css';
import { LocationPicker } from '../../components/ui/LocationPicker';

const STATUS_OPTIONS = ['open', 'closed', 'under_maintenance'] as const;
const FACILITY_OPTIONS = ['Men', 'Women', 'Unisex', 'Divyang Accessible', 'Pay & Use', 'Free'];

const EMPTY_FORM = {
    name: '',
    address: '',
    ward: '',
    lat: '',
    lng: '',
    status: 'open' as Toilet['status'],
    facilities: [] as string[],
};

export default function RestroomManagement() {
    const { profile } = useAuth();
    const [toilets, setToilets] = useState<Toilet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Toilet | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchToilets = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'toilets'));
            const data = snap.docs.map(d => {
                const raw = d.data() as Record<string, any>;
                return { id: d.id, ...raw } as Toilet;
            });
            data.sort((a, b) => a.name.localeCompare(b.name));
            setToilets(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchToilets(); }, []);

    const openAdd = () => {
        setEditing(null);
        setForm({ ...EMPTY_FORM, ward: profile?.ward ?? '' });
        setShowModal(true);
    };

    const openEdit = (t: Toilet) => {
        setEditing(t);
        setForm({
            name: t.name,
            address: t.address,
            ward: t.ward,
            lat: String(t.location?.lat ?? ''),
            lng: String(t.location?.lng ?? ''),
            status: t.status,
            facilities: t.facilities ?? [],
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.address.trim()) {
            toast.error('Name and address are required');
            return;
        }
        setSaving(true);
        try {
            const lat = parseFloat(form.lat) || 9.9252;
            const lng = parseFloat(form.lng) || 78.1198;
            const data: any = {
                name: form.name.trim(),
                address: form.address.trim(),
                ward: form.ward.trim(),
                location: { lat, lng },
                status: form.status,
                facilities: form.facilities,
                updatedAt: serverTimestamp(),
            };
            if (editing) {
                await updateDoc(doc(db, 'toilets', editing.id), data);
                setToilets(prev => prev.map(t => t.id === editing.id ? { ...t, ...data } : t));
                toast.success('Restroom updated!');
            } else {
                data.liveRating = 0;
                data.ratingCount = 0;
                data.createdBy = profile?.uid;
                data.createdAt = serverTimestamp();
                const ref = await addDoc(collection(db, 'toilets'), data);
                setToilets(prev => [...prev, { id: ref.id, ...data } as Toilet]);
                toast.success('✅ Restroom added!');
            }
            setShowModal(false);
        } catch (e: any) {
            toast.error('Failed: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (t: Toilet) => {
        if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
        setDeleting(t.id);
        try {
            await deleteDoc(doc(db, 'toilets', t.id));
            setToilets(prev => prev.filter(x => x.id !== t.id));
            toast.success('Restroom removed');
        } catch (e: any) {
            toast.error('Failed: ' + e.message);
        } finally {
            setDeleting(null);
        }
    };

    const toggleFacility = (f: string) => {
        setForm(prev => ({
            ...prev,
            facilities: prev.facilities.includes(f)
                ? prev.facilities.filter(x => x !== f)
                : [...prev.facilities, f],
        }));
    };

    const statusColor = (s: string) =>
        s === 'open' ? '#10B981' : s === 'closed' ? '#EF4444' : '#F59E0B';

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>🚽 Restroom Management</h2>
                    <p className={styles.subtitle}>Add, edit or remove public toilets in your ward</p>
                </div>
                <button className={styles.addBtn} onClick={openAdd}>
                    <Plus size={16} /> Add Restroom
                </button>
            </div>

            {loading ? (
                <div className={styles.loading}>Loading toilets…</div>
            ) : toilets.length === 0 ? (
                <div className={styles.empty}>
                    <span style={{ fontSize: 40 }}>🚽</span>
                    <p>No restrooms registered yet. Add the first one!</p>
                </div>
            ) : (
                <div className={styles.table}>
                    <div className={styles.tableHead}>
                        <span>Name / Address</span>
                        <span>Ward</span>
                        <span>Status</span>
                        <span>Rating</span>
                        <span>Actions</span>
                    </div>
                    {toilets.map(t => (
                        <div key={t.id} className={styles.tableRow}>
                            <div>
                                <div className={styles.toiletName}>{t.name}</div>
                                <div className={styles.toiletAddr}>
                                    <MapPin size={11} /> {t.address}
                                </div>
                                {t.facilities && t.facilities.length > 0 && (
                                    <div className={styles.facilityList}>
                                        {t.facilities.map(f => (
                                            <span key={f} className={styles.facilityTag}>{f}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className={styles.wardCell}>{t.ward || '—'}</div>
                            <div>
                                <span className={styles.statusBadge} style={{ background: statusColor(t.status) + '22', color: statusColor(t.status) }}>
                                    {t.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className={styles.ratingCell}>
                                <Star size={13} fill="#F59E0B" color="#F59E0B" />
                                {' '}{(t.liveRating ?? 0).toFixed(1)}
                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> ({t.ratingCount ?? 0})</span>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.editBtn} onClick={() => openEdit(t)}>
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    className={styles.deleteBtn}
                                    onClick={() => handleDelete(t)}
                                    disabled={deleting === t.id}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Modal */}
            {showModal && (
                <div className={styles.overlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                {editing ? 'Edit Restroom' : 'Add New Restroom'}
                            </h3>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Name *</label>
                                <input
                                    className={styles.input}
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Meenakshi Amman Temple Public Toilet"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Address *</label>
                                <input
                                    className={styles.input}
                                    value={form.address}
                                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                                    placeholder="Street, landmark, area"
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Ward</label>
                                    <input
                                        className={styles.input}
                                        value={form.ward}
                                        onChange={e => setForm(p => ({ ...p, ward: e.target.value }))}
                                        placeholder="e.g. 12"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Status</label>
                                    <select
                                        className={styles.input}
                                        value={form.status}
                                        onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                                    >
                                        {STATUS_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup} style={{ flex: '1 1 100%' }}>
                                    <label className={styles.label}>Precise Location *</label>
                                    <LocationPicker
                                        lat={parseFloat(form.lat) || 9.9252}
                                        lng={parseFloat(form.lng) || 78.1198}
                                        onChange={(lat, lng) => setForm(p => ({ ...p, lat: String(lat), lng: String(lng) }))}
                                        height="220px"
                                    />
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Drag the pin or click anywhere on the map to set coordinates ({parseFloat(form.lat || '9.9252').toFixed(4)}, {parseFloat(form.lng || '78.1198').toFixed(4)})
                                    </p>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Facilities</label>
                                <div className={styles.facilityGrid}>
                                    {FACILITY_OPTIONS.map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            className={`${styles.facilityPill} ${form.facilities.includes(f) ? styles.facilityPillActive : ''}`}
                                            onClick={() => toggleFacility(f)}
                                        >
                                            {form.facilities.includes(f) && <Check size={11} />}
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : editing ? '✓ Update Restroom' : '+ Add Restroom'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
