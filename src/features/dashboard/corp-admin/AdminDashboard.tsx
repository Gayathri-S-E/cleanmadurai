import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    collection, getDocs, query, where, doc, updateDoc,
    serverTimestamp, getCountFromServer, orderBy, limit,
    addDoc, deleteDoc, getDoc, setDoc, arrayUnion
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import {
    BarChart3, Users, CheckCircle, ArrowUpFromLine, Award,
    ShieldCheck, Download, RefreshCw, Plus, Trash2,
    Building2, Star, MapPin, AlertTriangle, Clock,
    Flag, Edit3, X, PartyPopper, Settings, UserX, UserCheck,
    Save, FileText, Layers, ChevronUp, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import styles from './AdminDashboard.module.css';
import { LocationPicker } from '../../../components/ui/LocationPicker';

interface RoleRequest {
    uid: string;
    displayName: string;
    email: string;
    requestedRole: string;
    ward: string;
    organization?: string;
    status: string;
    requestedAt?: any;
}

interface WardStat {
    id: string;
    name: string;
    cleanlinessScore: number;
    openReports: number;
    resolvedReports: number;
    wasteExchanges: number;
    adoptedBlocks: number;
}

interface SpecialZone {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    festivalDays?: string[];
    lat?: number;
    lng?: number;
    radius?: number;
    color?: string;
}

interface UserRow {
    uid: string;
    displayName: string;
    email: string;
    roles: string[];
    ward?: string;
    points: number;
    totalReports: number;
    disabled?: boolean;
}

interface AdminReport {
    id: string;
    reporterId: string;
    reporterName?: string;
    issueType: string;
    description?: string;
    photoURL?: string;
    location: { lat: number; lng: number };
    address?: string;
    ward?: string;
    status: string;
    priority: string;
    isGlassSOS?: boolean;
    assignedTo?: string;
    assignedWorker?: string;
    createdAt: any;
    updatedAt: any;
    resolvedAt?: any;
}

interface BlockRow {
    id: string;
    name: string;
    ward: string;
    address?: string;
    status: string;
    cleanliness_score: number;
    adopterId?: string | null;
    ownerName?: string;
    adoptedAt?: any;
    openComplaints: number;
}

type Tab = 'overview' | 'kpi' | 'wards' | 'role_requests' | 'users' | 'zones' | 'reports' | 'blocks' | 'settings' | 'system';

// Tabs visible to corp_admin and above
const CORP_ADMIN_TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'kpi', label: 'KPI Analytics', icon: BarChart3 },
    { key: 'wards', label: 'Ward Rankings', icon: Building2 },
    { key: 'reports', label: 'All Reports', icon: FileText },
    { key: 'role_requests', label: 'Role Approvals', icon: ShieldCheck },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'zones', label: 'Special Zones', icon: Flag },
    { key: 'blocks', label: 'Adopt Blocks', icon: Layers },
];

// Extra tabs only visible to super_admin
const SUPER_ADMIN_TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'system', label: 'System Mgmt', icon: ShieldCheck },
];


function ScoreBar({ score }: { score: number }) {
    const color = score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
                flex: 1, height: '6px', borderRadius: '99px',
                background: 'var(--bg-subtle)', overflow: 'hidden',
            }}>
                <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: '99px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: '13px', color, minWidth: '32px' }}>
                {score}
            </span>
        </div>
    );
}

function AdminDashboard() {
    const { hasRole } = useAuth();
    const { tab } = useParams<{ tab: string }>();
    const navigate = useNavigate();
    let activeTab = (tab as Tab);
    if (!activeTab) {
        const pathSegments = window.location.pathname.split('/');
        activeTab = (pathSegments[pathSegments.length - 1] as Tab) || 'overview';
    }
    const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
    const [wardStats, setWardStats] = useState<WardStat[]>([]);
    const [specialZones, setSpecialZones] = useState<SpecialZone[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [totalReports, setTotalReports] = useState(0);
    const [resolvedReports, setResolvedReports] = useState(0);
    const [activeUsers, setActiveUsers] = useState(0);
    const [wasteExchanges, setWasteExchanges] = useState(0);
    const [cityScore, setCityScore] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);

    // Zone form state
    const [showZoneForm, setShowZoneForm] = useState(false);
    const [zoneName, setZoneName] = useState('');
    const [zoneType, setZoneType] = useState<string>('temple');
    const [zoneFestival, setZoneFestival] = useState('');
    const [zoneLat, setZoneLat] = useState('');
    const [zoneLng, setZoneLng] = useState('');
    const [zoneRadius, setZoneRadius] = useState('500');
    const [savingZone, setSavingZone] = useState(false);

    // Block form state
    const [showBlockForm, setShowBlockForm] = useState(false);
    const [blockFormName, setBlockFormName] = useState('');
    const [blockFormWard, setBlockFormWard] = useState('');
    const [blockFormLat, setBlockFormLat] = useState(0);
    const [blockFormLng, setBlockFormLng] = useState(0);

    // Settings state
    const [reportEmail, setReportEmail] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    // Assign role
    const [assignUid, setAssignUid] = useState('');
    const [assignRole, setAssignRole] = useState('corp_admin');
    const [assigningRole, setAssigningRole] = useState(false);

    const isSuperAdmin = hasRole('super_admin');
    const TAB_LABELS = isSuperAdmin
        ? [...CORP_ADMIN_TABS, ...SUPER_ADMIN_TABS]
        : CORP_ADMIN_TABS;

    // navigate helper used by Quick Navigation shortcuts
    const setActiveTab = (t: Tab) => navigate(`/admin/${t}`);

    // User search
    const [userSearch, setUserSearch] = useState('');

    // ── Ward CRUD state ────────────────────────────────────────────────────────
    const [showWardForm, setShowWardForm] = useState(false);
    const [editingWard, setEditingWard] = useState<WardStat | null>(null);
    const [wardFormName, setWardFormName] = useState('');
    const [wardFormNameTA, setWardFormNameTA] = useState('');
    const [wardFormCouncilor, setWardFormCouncilor] = useState('');
    const [wardFormScore, setWardFormScore] = useState('50');
    const [savingWard, setSavingWard] = useState(false);

    // ── Reports admin state ────────────────────────────────────────────────────
    const [adminReports, setAdminReports] = useState<AdminReport[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [reportStatusFilter, setReportStatusFilter] = useState('all');
    const [reportWardFilter, setReportWardFilter] = useState('');
    const [selectedAdminReport, setSelectedAdminReport] = useState<AdminReport | null>(null);
    const [reportNewStatus, setReportNewStatus] = useState('');
    const [reportNote, setReportNote] = useState('');
    const [savingReport, setSavingReport] = useState(false);

    // ── Zone edit state ────────────────────────────────────────────────────────
    const [editingZone, setEditingZone] = useState<SpecialZone | null>(null);
    const [editZoneName, setEditZoneName] = useState('');
    const [editZoneType, setEditZoneType] = useState('temple');
    const [editZoneLat, setEditZoneLat] = useState('');
    const [editZoneLng, setEditZoneLng] = useState('');
    const [editZoneRadius, setEditZoneRadius] = useState('500');
    const [editZoneFestival, setEditZoneFestival] = useState('');
    const [savingEditZone, setSavingEditZone] = useState(false);

    // ── Blocks state ───────────────────────────────────────────────────────────
    const [blocks, setBlocks] = useState<BlockRow[]>([]);
    const [loadingBlocks, setLoadingBlocks] = useState(false);
    const [editingBlock, setEditingBlock] = useState<BlockRow | null>(null);
    const [blockScore, setBlockScore] = useState('50');
    const [blockStatus, setBlockStatus] = useState('unmonitored');
    const [savingBlock, setSavingBlock] = useState(false);

    // ── User action state ──────────────────────────────────────────────────────
    const [togglingUser, setTogglingUser] = useState<string | null>(null);
    const [editingUserWard, setEditingUserWard] = useState<string | null>(null);
    const [userWardValue, setUserWardValue] = useState('');

    const fetchOverview = async () => {
        setLoading(true);
        try {
            const reqSnap = await getDocs(query(
                collection(db, 'roleRequests'),
                where('status', '==', 'pending')
            ));
            setRoleRequests(reqSnap.docs.map(d => ({ uid: d.id, ...d.data() } as RoleRequest)));

            const [totalSnap, resolvedSnap, usersSnap, wasteSnap] = await Promise.all([
                getCountFromServer(collection(db, 'reports')),
                getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'resolved'))),
                getCountFromServer(collection(db, 'users')),
                getCountFromServer(query(collection(db, 'waste_listings'), where('status', 'in', ['claimed', 'picked']))),
            ]);
            setTotalReports(totalSnap.data().count);
            setResolvedReports(resolvedSnap.data().count);
            setActiveUsers(usersSnap.data().count);
            setWasteExchanges(wasteSnap.data().count);

            // Ward stats
            try {
                const wardsSnap = await getDocs(
                    query(collection(db, 'wards'), orderBy('cleanlinessScore', 'desc'), limit(30))
                );
                if (!wardsSnap.empty) {
                    const wards = wardsSnap.docs.map(d => ({
                        id: d.id,
                        name: d.data().name ?? d.id,
                        cleanlinessScore: d.data().cleanlinessScore ?? 0,
                        openReports: d.data().openReports ?? 0,
                        resolvedReports: d.data().resolvedReports ?? 0,
                        wasteExchanges: d.data().wasteExchanges ?? 0,
                        adoptedBlocks: d.data().adoptedBlocks ?? 0,
                    } as WardStat));
                    setWardStats(wards);
                    const avg = Math.round(wards.reduce((s, w) => s + w.cleanlinessScore, 0) / wards.length);
                    setCityScore(avg);
                }
            } catch { /* wards not seeded yet */ }

            // Special zones
            try {
                const zonesSnap = await getDocs(collection(db, 'specialZones'));
                setSpecialZones(zonesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SpecialZone)));
            } catch { /* not set up yet */ }

            // General settings
            try {
                const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
                if (settingsSnap.exists()) {
                    setReportEmail(settingsSnap.data().reportNotificationEmail || '');
                }
            } catch { /* ignored */ }

        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50)));
            setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserRow)));
        } catch (e) { console.error(e); }
        finally { setLoadingUsers(false); }
    };

    const fetchAllReports = async () => {
        setLoadingReports(true);
        try {
            let snap;
            try {
                snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
            } catch {
                snap = await getDocs(collection(db, 'reports'));
            }
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminReport));
            data.sort((a, b) => {
                const tA = a.createdAt?.toMillis?.() || 0;
                const tB = b.createdAt?.toMillis?.() || 0;
                return tB - tA;
            });
            setAdminReports(data.slice(0, 100));
        } catch (e) { console.error(e); }
        finally { setLoadingReports(false); }
    };

    const fetchBlocks = async () => {
        setLoadingBlocks(true);
        try {
            let snap;
            try {
                snap = await getDocs(query(collection(db, 'blocks'), orderBy('cleanliness_score', 'asc'), limit(80)));
            } catch {
                snap = await getDocs(collection(db, 'blocks'));
            }
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlockRow));
            data.sort((a, b) => a.cleanliness_score - b.cleanliness_score);
            setBlocks(data);
        } catch (e) { console.error(e); }
        finally { setLoadingBlocks(false); }
    };

    const fetchWards = async () => {
        setLoadingWards(true);
        try {
            // Try ordered query first; if index missing, fall back to unordered
            let wardsSnap;
            try {
                wardsSnap = await getDocs(
                    query(collection(db, 'wards'), orderBy('cleanlinessScore', 'desc'), limit(50))
                );
            } catch {
                // Likely missing Firestore index — fetch without orderBy
                wardsSnap = await getDocs(collection(db, 'wards'));
            }
            const wards: WardStat[] = wardsSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name ?? d.id,
                cleanlinessScore: d.data().cleanlinessScore ?? 0,
                openReports: d.data().openReports ?? 0,
                resolvedReports: d.data().resolvedReports ?? 0,
                wasteExchanges: d.data().wasteExchanges ?? 0,
                adoptedBlocks: d.data().adoptedBlocks ?? 0,
            }));
            // sort in-memory by score descending
            wards.sort((a, b) => b.cleanlinessScore - a.cleanlinessScore);
            setWardStats(wards);
            if (wards.length > 0) {
                const avg = Math.round(wards.reduce((s, w) => s + w.cleanlinessScore, 0) / wards.length);
                setCityScore(avg);
            }
        } catch (e) { console.error('fetchWards error:', e); }
        finally { setLoadingWards(false); }
    };

    useEffect(() => {
        fetchOverview();
    }, []);

    useEffect(() => {
        if ((activeTab === 'users' || activeTab === 'system') && users.length === 0) fetchUsers();
        if (activeTab === 'reports' && adminReports.length === 0) fetchAllReports();
        if (activeTab === 'blocks' && blocks.length === 0) fetchBlocks();
        if (activeTab === 'wards') fetchWards(); // always refresh when visiting wards tab
    }, [activeTab]);

    // ─── Ward CRUD handlers ─────────────────────────────────────────────────────
    const handleCreateWard = async () => {
        if (!wardFormName.trim()) { toast.error('Ward name is required'); return; }
        setSavingWard(true);
        try {
            const data = {
                name: wardFormName.trim(),
                nameTA: wardFormNameTA.trim() || wardFormName.trim(),
                councilor: wardFormCouncilor.trim(),
                cleanlinessScore: parseInt(wardFormScore) || 50,
                openReports: 0, resolvedReports: 0,
                wasteExchanges: 0, adoptedBlocks: 0,
                createdAt: serverTimestamp(),
            };
            const ref = await addDoc(collection(db, 'wards'), data);
            const newWard: WardStat = { id: ref.id, name: data.name, cleanlinessScore: data.cleanlinessScore, openReports: 0, resolvedReports: 0, wasteExchanges: 0, adoptedBlocks: 0 };
            setWardStats(prev => [newWard, ...prev]);
            setWardFormName(''); setWardFormNameTA(''); setWardFormCouncilor(''); setWardFormScore('50');
            setShowWardForm(false);
            toast.success(`Ward "${data.name}" created!`);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSavingWard(false); }
    };

    const startEditWard = (w: WardStat) => {
        setEditingWard(w);
        setWardFormName(w.name);
        setWardFormScore(String(w.cleanlinessScore));
    };

    const handleUpdateWard = async () => {
        if (!editingWard || !wardFormName.trim()) return;
        setSavingWard(true);
        try {
            await updateDoc(doc(db, 'wards', editingWard.id), {
                name: wardFormName.trim(),
                cleanlinessScore: parseInt(wardFormScore) || editingWard.cleanlinessScore,
                updatedAt: serverTimestamp(),
            });
            setWardStats(prev => prev.map(w => w.id === editingWard.id
                ? { ...w, name: wardFormName.trim(), cleanlinessScore: parseInt(wardFormScore) || w.cleanlinessScore }
                : w
            ));
            toast.success(`Ward "${wardFormName}" updated!`);
            setEditingWard(null);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSavingWard(false); }
    };

    const handleDeleteWard = async (w: WardStat) => {
        if (!confirm(`Delete ward "${w.name}"? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'wards', w.id));
            setWardStats(prev => prev.filter(x => x.id !== w.id));
            toast.success(`Ward "${w.name}" deleted`);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    // ─── Report admin handlers ──────────────────────────────────────────────────
    const selectAdminReport = (r: AdminReport) => {
        setSelectedAdminReport(r);
        setReportNewStatus(r.status);
        setReportNote('');
    };

    const handleUpdateReportStatus = async () => {
        if (!selectedAdminReport) return;
        setSavingReport(true);
        try {
            const historyEntry = {
                status: reportNewStatus,
                changedBy: 'admin',
                changedByName: 'Admin Override',
                timestamp: new Date().toISOString(),
                note: reportNote || 'Admin status override',
            };
            await updateDoc(doc(db, 'reports', selectedAdminReport.id), {
                status: reportNewStatus,
                updatedAt: serverTimestamp(),
                resolvedAt: reportNewStatus === 'resolved' ? serverTimestamp() : null,
                statusHistory: arrayUnion(historyEntry),
            });
            setAdminReports(prev => prev.map(r => r.id === selectedAdminReport.id ? { ...r, status: reportNewStatus } : r));
            toast.success('Report status updated!');
            setSelectedAdminReport(null);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSavingReport(false); }
    };

    const handleDeleteReport = async (r: AdminReport) => {
        if (!confirm(`Delete report "${r.issueType.replace(/_/g, ' ')}"? This is permanent.`)) return;
        try {
            await deleteDoc(doc(db, 'reports', r.id));
            setAdminReports(prev => prev.filter(x => x.id !== r.id));
            toast.success('Report deleted');
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    // ─── Zone edit handlers ─────────────────────────────────────────────────────
    const startEditZone = (z: SpecialZone) => {
        setEditingZone(z);
        setEditZoneName(z.name);
        setEditZoneType(z.type);
        setEditZoneLat(String(z.lat ?? ''));
        setEditZoneLng(String(z.lng ?? ''));
        setEditZoneRadius(String(z.radius ?? 500));
        setEditZoneFestival((z.festivalDays ?? []).join(', '));
    };

    const handleUpdateZone = async () => {
        if (!editingZone || !editZoneName.trim()) { toast.error('Zone name is required'); return; }
        setSavingEditZone(true);
        try {
            const festivalDays = editZoneFestival.trim()
                ? editZoneFestival.split(',').map(s => s.trim()).filter(Boolean) : [];
            const lat = parseFloat(editZoneLat) || editingZone.lat || 9.9252;
            const lng = parseFloat(editZoneLng) || editingZone.lng || 78.1198;
            await updateDoc(doc(db, 'specialZones', editingZone.id), {
                name: editZoneName.trim(),
                type: editZoneType,
                festivalDays,
                lat, lng,
                center: { lat, lng },
                radius: parseInt(editZoneRadius) || 500,
                updatedAt: serverTimestamp(),
            });
            setSpecialZones(prev => prev.map(z => z.id === editingZone.id
                ? { ...z, name: editZoneName.trim(), type: editZoneType, festivalDays, lat, lng, radius: parseInt(editZoneRadius) || 500 }
                : z
            ));
            toast.success('Zone updated!');
            setEditingZone(null);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSavingEditZone(false); }
    };

    // ─── User action handlers ───────────────────────────────────────────────────
    const handleToggleUserDisabled = async (u: UserRow) => {
        setTogglingUser(u.uid);
        try {
            const newDisabled = !u.disabled;
            await updateDoc(doc(db, 'users', u.uid), { disabled: newDisabled, updatedAt: serverTimestamp() });
            setUsers(prev => prev.map(usr => usr.uid === u.uid ? { ...usr, disabled: newDisabled } : usr));
            toast.success(`${u.displayName} ${newDisabled ? 'disabled' : 'enabled'}`);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setTogglingUser(null); }
    };

    const handleSaveUserWard = async (u: UserRow) => {
        try {
            await updateDoc(doc(db, 'users', u.uid), { ward: userWardValue.trim(), updatedAt: serverTimestamp() });
            setUsers(prev => prev.map(usr => usr.uid === u.uid ? { ...usr, ward: userWardValue.trim() } : usr));
            toast.success(`Ward updated for ${u.displayName}`);
            setEditingUserWard(null);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    // ─── Block handlers ─────────────────────────────────────────────────────────
    const handleAddBlock = async () => {
        if (!blockFormName.trim() || !blockFormWard.trim()) { toast.error('Name and Ward are required'); return; }
        if (!blockFormLat || !blockFormLng) { toast.error('Please pick a location on the map'); return; }
        setSavingBlock(true);
        try {
            const data = {
                name: blockFormName.trim(),
                ward: blockFormWard.trim(),
                location: { lat: blockFormLat, lng: blockFormLng },
                cleanliness_score: 50,
                status: 'unmonitored',
                openComplaints: 0,
                adopterId: null,
                createdAt: serverTimestamp(),
            };
            const ref = await addDoc(collection(db, 'blocks'), data);
            setBlocks(prev => [{ id: ref.id, ...data } as BlockRow, ...prev]);
            setBlockFormName(''); setBlockFormWard(''); setBlockFormLat(0); setBlockFormLng(0);
            setShowBlockForm(false);
            toast.success(`Block "${data.name}" added`);
        } catch (e: any) { toast.error('Failed to add block: ' + e.message); }
        finally { setSavingBlock(false); }
    };

    const startEditBlock = (b: BlockRow) => {
        setEditingBlock(b);
        setBlockScore(String(b.cleanliness_score));
        setBlockStatus(b.status);
    };

    const handleUpdateBlock = async () => {
        if (!editingBlock) return;
        setSavingBlock(true);
        try {
            await updateDoc(doc(db, 'blocks', editingBlock.id), {
                cleanliness_score: parseInt(blockScore) || 0,
                status: blockStatus,
                updatedAt: serverTimestamp(),
            });
            setBlocks(prev => prev.map(b => b.id === editingBlock.id
                ? { ...b, cleanliness_score: parseInt(blockScore) || 0, status: blockStatus }
                : b
            ));
            toast.success('Block updated!');
            setEditingBlock(null);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSavingBlock(false); }
    };

    const handleReleaseAdoption = async (b: BlockRow) => {
        if (!confirm(`Release adoption of block "${b.name}"?`)) return;
        try {
            await updateDoc(doc(db, 'blocks', b.id), { adopterId: null, ownerName: null, adoptedAt: null, updatedAt: serverTimestamp() });
            setBlocks(prev => prev.map(x => x.id === b.id ? { ...x, adopterId: null, ownerName: undefined } : x));
            toast.success('Adoption released');
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    const handleDeleteBlock = async (b: BlockRow) => {
        if (!confirm(`Delete block "${b.name}"? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'blocks', b.id));
            setBlocks(prev => prev.filter(x => x.id !== b.id));
            toast.success('Block deleted');
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };



    const handleApprove = async (req: RoleRequest) => {
        try {
            await updateDoc(doc(db, 'roleRequests', req.uid), { status: 'approved', approvedAt: serverTimestamp() });
            // Use arrayUnion so we ADD the new role to any existing roles, not wipe them
            await updateDoc(doc(db, 'users', req.uid), {
                roles: arrayUnion(req.requestedRole),
                'pendingRoleRequest.status': 'approved',
                updatedAt: serverTimestamp(),
            });
            setRoleRequests(prev => prev.filter(r => r.uid !== req.uid));
            toast.success(`✓ Approved ${req.displayName} as ${req.requestedRole.replace(/_/g, ' ')}`);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    const handleReject = async (req: RoleRequest) => {
        try {
            await updateDoc(doc(db, 'roleRequests', req.uid), { status: 'rejected' });
            await updateDoc(doc(db, 'users', req.uid), { 'pendingRoleRequest.status': 'rejected', updatedAt: serverTimestamp() });
            setRoleRequests(prev => prev.filter(r => r.uid !== req.uid));
            toast.success('Role request rejected');
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    const handleAddZone = async () => {
        if (!zoneName.trim()) { toast.error('Zone name is required'); return; }
        if (!zoneLat || !zoneLng) { toast.error('Latitude and Longitude are required'); return; }
        setSavingZone(true);
        try {
            const festivalDays = zoneFestival.trim()
                ? zoneFestival.split(',').map(s => s.trim()).filter(Boolean)
                : [];
            const lat = parseFloat(zoneLat) || 9.9252;
            const lng = parseFloat(zoneLng) || 78.1198;
            const newZone = {
                name: zoneName.trim(),
                type: zoneType,
                isActive: true,
                festivalDays,
                lat,
                lng,
                center: { lat, lng },
                radius: parseInt(zoneRadius) || 500,
                color: '#F5A623',
            };
            const docRef = await addDoc(collection(db, 'specialZones'), {
                ...newZone,
                createdAt: serverTimestamp(),
            });
            setSpecialZones(prev => [...prev, {
                id: docRef.id, ...newZone
            }]);
            setZoneName(''); setZoneFestival(''); setZoneType('temple');
            setZoneLat(''); setZoneLng(''); setZoneRadius('500');
            setShowZoneForm(false);
            toast.success('Special zone created!');
        } catch (e: any) { toast.error('Failed: ' + e.message); }
        finally { setSavingZone(false); }
    };

    const handleToggleZone = async (zone: SpecialZone) => {
        try {
            await updateDoc(doc(db, 'specialZones', zone.id), { isActive: !zone.isActive });
            setSpecialZones(prev => prev.map(z => z.id === zone.id ? { ...z, isActive: !z.isActive } : z));
            toast.success(`Zone ${zone.isActive ? 'deactivated' : 'activated'}`);
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    const handleDeleteZone = async (zone: SpecialZone) => {
        if (!confirm(`Delete zone "${zone.name}"?`)) return;
        try {
            await deleteDoc(doc(db, 'specialZones', zone.id));
            setSpecialZones(prev => prev.filter(z => z.id !== zone.id));
            toast.success('Zone deleted');
        } catch (e: any) { toast.error('Failed: ' + e.message); }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await setDoc(doc(db, 'settings', 'general'), {
                reportNotificationEmail: reportEmail.trim()
            }, { merge: true });
            toast.success('Settings saved successfully');
        } catch (e: any) {
            toast.error('Failed to save settings: ' + e.message);
        } finally {
            setSavingSettings(false);
        }
    };

    const exportCSV = () => {
        if (wardStats.length === 0) { toast.error('No ward data to export yet'); return; }
        const rows = wardStats.map(w =>
            `${w.name},${w.cleanlinessScore},${w.openReports},${w.resolvedReports},${w.wasteExchanges},${w.adoptedBlocks}`
        ).join('\n');
        const csv = `Ward,Score,Open Reports,Resolved,Waste Exchanges,Adopted Blocks\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `ward_stats_${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported ward data!');
    };

    const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;
    const filteredUsers = users.filter(u =>
        !userSearch || u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <ShieldCheck size={22} style={{ display: 'inline', marginRight: '8px', color: 'var(--color-primary-500)' }} />
                        {hasRole('super_admin') ? 'Super Admin Dashboard' : 'Corporation Admin Dashboard'}
                    </h1>
                    <p className={styles.subtitle}>
                        City-wide overview · Madurai Corporation · {format(new Date(), 'dd MMM yyyy')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline btn-sm" onClick={fetchOverview} disabled={loading}>
                        <RefreshCw size={14} className={loading ? styles.spin : ''} /> Refresh
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={exportCSV}>
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Tabs bar removed — navigation is now via the sidebar links */}


            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    {/* KPI Cards */}
                    <div className={styles.statsGrid}>
                        {[
                            {
                                icon: <ArrowUpFromLine size={20} />,
                                val: totalReports,
                                label: 'Total Reports',
                                color: 'var(--color-info)',
                                bg: 'var(--color-info-bg)',
                            },
                            {
                                icon: <CheckCircle size={20} />,
                                val: resolvedReports,
                                label: 'Resolved',
                                color: 'var(--color-success)',
                                bg: 'var(--color-success-bg)',
                            },
                            {
                                icon: <BarChart3 size={20} />,
                                val: `${resolutionRate}%`,
                                label: 'Resolution Rate',
                                color: resolutionRate >= 70 ? 'var(--color-success)' : 'var(--color-warning)',
                                bg: resolutionRate >= 70 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                            },
                            {
                                icon: <Users size={20} />,
                                val: activeUsers,
                                label: 'Registered Users',
                                color: 'var(--color-primary-500)',
                                bg: 'var(--color-primary-50)',
                            },
                            {
                                icon: <Award size={20} />,
                                val: wasteExchanges,
                                label: 'Waste Exchanges',
                                color: 'var(--color-accent-400)',
                                bg: 'var(--color-accent-100)',
                            },
                            {
                                icon: <ShieldCheck size={20} />,
                                val: roleRequests.length,
                                label: 'Pending Approvals',
                                color: 'var(--color-warning)',
                                bg: 'var(--color-warning-bg)',
                            },
                            {
                                icon: <Star size={20} />,
                                val: cityScore !== null ? `${cityScore}/100` : '—',
                                label: 'City Score',
                                color: cityScore !== null && cityScore >= 70 ? 'var(--color-success)' : 'var(--color-warning)',
                                bg: 'var(--color-primary-50)',
                            },
                            {
                                icon: <Flag size={20} />,
                                val: specialZones.filter(z => z.isActive).length,
                                label: 'Active Zones',
                                color: 'var(--color-danger)',
                                bg: 'rgba(239,68,68,0.08)',
                            },
                        ].map((s, i) => (
                            <div key={i} className={styles.statCard}>
                                <div className={styles.statIcon} style={{ color: s.color, background: s.bg }}>{s.icon}</div>
                                <div className={styles.statVal}>{s.val}</div>
                                <div className={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Quick shortcuts */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-2xl)',
                        padding: 'var(--space-5)',
                    }}>
                        <h2 className={styles.sectionTitle}>Quick Navigation</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                            {TAB_LABELS.slice(1).map(t => {
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.key}
                                        className="btn btn-outline"
                                        style={{ justifyContent: 'flex-start', gap: '8px' }}
                                        onClick={() => setActiveTab(t.key)}
                                    >
                                        <Icon size={16} />
                                        {t.label}
                                        {t.key === 'role_requests' && roleRequests.length > 0 && (
                                            <span className="badge badge-warning" style={{ marginLeft: 'auto', minWidth: '20px' }}>
                                                {roleRequests.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Analytics Tab */}
            {activeTab === 'kpi' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <h2 className={styles.sectionTitle}>📊 KPI Analytics Dashboard</h2>

                    {/* Primary KPI Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
                        {[
                            { label: 'Resolution Rate', value: `${resolutionRate}%`, sub: `${resolvedReports} of ${totalReports} reports`, color: resolutionRate >= 70 ? 'var(--color-success)' : 'var(--color-warning)', emoji: '✅' },
                            { label: 'Citizen Reach', value: activeUsers.toLocaleString(), sub: 'Registered users', color: 'var(--color-primary-500)', emoji: '👥' },
                            { label: 'Waste Exchanges', value: wasteExchanges.toLocaleString(), sub: 'Claimed/picked', color: 'var(--color-accent-400)', emoji: '♻️' },
                            { label: 'City Score', value: cityScore !== null ? `${cityScore}/100` : '—', sub: 'Avg cleanliness score', color: cityScore !== null && cityScore >= 70 ? 'var(--color-success)' : 'var(--color-warning)', emoji: '🏆' },
                            { label: 'Pending Approvals', value: roleRequests.length.toString(), sub: 'Role requests', color: roleRequests.length > 0 ? 'var(--color-warning)' : 'var(--color-success)', emoji: '🔔' },
                            { label: 'Active Zones', value: specialZones.filter(z => z.isActive).length.toString(), sub: 'Temple/market zones', color: 'var(--color-danger)', emoji: '📍' },
                        ].map((kpi, i) => (
                            <div key={i} style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-xl)',
                                padding: 'var(--space-4)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                            }}>
                                <div style={{ fontSize: '28px' }}>{kpi.emoji}</div>
                                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-black)', fontSize: 'var(--text-2xl)', color: kpi.color }}>
                                    {kpi.value}
                                </div>
                                <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px', color: 'var(--text-primary)' }}>{kpi.label}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{kpi.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Resolution Rate Progress Bar */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                        <h3 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-3)' }}>Resolution Rate</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '14px', borderRadius: '99px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${resolutionRate}%`,
                                    borderRadius: '99px',
                                    transition: 'width 1s ease',
                                    background: resolutionRate >= 80
                                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                        : resolutionRate >= 60
                                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                            : 'linear-gradient(90deg, #ef4444, #dc2626)',
                                }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-xl)', minWidth: '52px', color: 'var(--text-primary)' }}>
                                {resolutionRate}%
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            <span>Target: 70%</span>
                            <span>{resolvedReports} resolved / {totalReports} total</span>
                        </div>
                    </div>

                    {/* Top Wards Table */}
                    {wardStats.length > 0 && (
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                            <h3 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-4)' }}>Top 5 Wards by Cleanliness Score</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {wardStats.slice(0, 5).map((ward, i) => (
                                    <div key={ward.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: '16px', minWidth: '28px', color: 'var(--text-muted)' }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                        </span>
                                        <span style={{ flex: 1, fontWeight: 'var(--fw-semibold)', fontSize: '14px' }}>{ward.name}</span>
                                        <div style={{ width: '120px' }}><ScoreBar score={ward.cleanlinessScore} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Ward Rankings Tab — FULL CRUD */}
            {activeTab === 'wards' && (
                <div className={styles.section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <h2 className={styles.sectionTitle}>
                            Ward Management
                            {loadingWards && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>Loading…</span>}
                            {!loadingWards && wardStats.length > 0 && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>({wardStats.length} wards)</span>}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={fetchWards} disabled={loadingWards}>
                                <RefreshCw size={14} className={loadingWards ? styles.spin : ''} /> Refresh
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={exportCSV}><Download size={14} /> Export</button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowWardForm(v => !v); setEditingWard(null); }}>
                                <Plus size={14} /> {showWardForm ? 'Cancel' : 'Add Ward'}
                            </button>
                        </div>
                    </div>

                    {/* CREATE / EDIT FORM */}
                    {(showWardForm || editingWard) && (
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                            <h3 style={{ fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--space-4)' }}>
                                {editingWard ? `✏️ Edit: ${editingWard.name}` : '➕ New Ward'}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Ward Name (EN)</label>
                                    <input className="input" value={wardFormName} onChange={e => setWardFormName(e.target.value)} placeholder="e.g. KK Nagar" />
                                </div>
                                {!editingWard && (
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Ward Name (Tamil)</label>
                                        <input className="input" value={wardFormNameTA} onChange={e => setWardFormNameTA(e.target.value)} placeholder="e.g. கே.கே நகர்" />
                                    </div>
                                )}
                                {!editingWard && (
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Councilor Name</label>
                                        <input className="input" value={wardFormCouncilor} onChange={e => setWardFormCouncilor(e.target.value)} placeholder="e.g. A. Murugan" />
                                    </div>
                                )}
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Initial Score (0-100)</label>
                                    <input className="input" type="number" min={0} max={100} value={wardFormScore} onChange={e => setWardFormScore(e.target.value)} />
                                </div>
                                <button
                                    className="btn btn-primary btn-sm"
                                    disabled={savingWard}
                                    onClick={editingWard ? handleUpdateWard : handleCreateWard}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    <Save size={14} /> {savingWard ? 'Saving…' : editingWard ? 'Save Changes' : 'Create Ward'}
                                </button>
                                {editingWard && (
                                    <button className="btn btn-outline btn-sm" onClick={() => setEditingWard(null)}><X size={14} /> Cancel</button>
                                )}
                            </div>
                        </div>
                    )}

                    {wardStats.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <div className="empty-state-icon">🏘️</div>
                            <div className="empty-state-title">No wards yet</div>
                            <p>Click <strong>+ Add Ward</strong> to create the first ward.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Ward</th>
                                        <th>Score</th>
                                        <th>Open</th>
                                        <th>Resolved</th>
                                        <th>Exchanges</th>
                                        <th>Adopted</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wardStats.map((w, i) => (
                                        <tr key={w.id} style={{ background: editingWard?.id === w.id ? 'var(--color-primary-50)' : undefined }}>
                                            <td>
                                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', color: i === 0 ? '#F5A623' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'var(--text-muted)' }}>
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-semibold)' }}>{w.name}</td>
                                            <td style={{ minWidth: '140px' }}><ScoreBar score={w.cleanlinessScore} /></td>
                                            <td><span className="badge badge-danger">{w.openReports}</span></td>
                                            <td><span className="badge badge-success">{w.resolvedReports}</span></td>
                                            <td><span className="badge">{w.wasteExchanges}</span></td>
                                            <td><span className="badge">{w.adoptedBlocks}</span></td>
                                            <td>
                                                <span className={`badge ${w.cleanlinessScore >= 80 ? 'badge-success' : w.cleanlinessScore >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                                                    {w.cleanlinessScore >= 80 ? 'Excellent' : w.cleanlinessScore >= 60 ? 'Good' : 'Needs Attention'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-outline btn-sm" title="Edit" onClick={() => startEditWard(w)} style={{ padding: '4px 8px' }}>
                                                        <Edit3 size={13} />
                                                    </button>
                                                    <button className="btn btn-sm" title="Delete" onClick={() => handleDeleteWard(w)} style={{ padding: '4px 8px', background: 'var(--color-danger)', color: '#fff', border: 'none' }}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── ALL REPORTS TAB ──────────────────────────────────────────────── */}
            {activeTab === 'reports' && (
                <div className={styles.section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <h2 className={styles.sectionTitle}>All Reports <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>({adminReports.length})</span></h2>
                        <button className="btn btn-outline btn-sm" onClick={fetchAllReports} disabled={loadingReports}>
                            <RefreshCw size={14} className={loadingReports ? styles.spin : ''} /> Refresh
                        </button>
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <select className="select" style={{ maxWidth: '160px' }} value={reportStatusFilter} onChange={e => setReportStatusFilter(e.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <input className="input" style={{ maxWidth: '200px' }} placeholder="Filter by ward…" value={reportWardFilter} onChange={e => setReportWardFilter(e.target.value)} />
                    </div>

                    {/* Report Detail Modal/Drawer */}
                    {selectedAdminReport && (
                        <div style={{ background: 'var(--color-primary-50)', border: '2px solid var(--color-primary-200)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-4)' }}>
                                <div>
                                    <div style={{ fontWeight: 'var(--fw-bold)', fontSize: '15px' }}>{selectedAdminReport.issueType.replace(/_/g, ' ')}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {selectedAdminReport.id} · Ward: {selectedAdminReport.ward ?? '—'}</div>
                                    {selectedAdminReport.description && <p style={{ fontSize: '13px', marginTop: '8px' }}>{selectedAdminReport.description}</p>}
                                </div>
                                <button className="btn btn-outline btn-sm" onClick={() => setSelectedAdminReport(null)}><X size={14} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Override Status</label>
                                    <select className="select" value={reportNewStatus} onChange={e => setReportNewStatus(e.target.value)}>
                                        <option value="pending">Pending</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved ✓</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Admin Note</label>
                                    <input className="input" placeholder="e.g. Duplicate — closing" value={reportNote} onChange={e => setReportNote(e.target.value)} />
                                </div>
                                <button className="btn btn-primary btn-sm" disabled={savingReport} onClick={handleUpdateReportStatus}>
                                    <Save size={14} /> {savingReport ? 'Saving…' : 'Update Status'}
                                </button>
                            </div>
                        </div>
                    )}

                    {loadingReports ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports…</div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Ward</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Submitted</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adminReports
                                        .filter(r => (reportStatusFilter === 'all' || r.status === reportStatusFilter) && (!reportWardFilter || (r.ward ?? '').toLowerCase().includes(reportWardFilter.toLowerCase())))
                                        .map(r => (
                                            <tr key={r.id}>
                                                <td style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px' }}>{r.issueType.replace(/_/g, ' ')}</td>
                                                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{r.ward ?? '—'}</td>
                                                <td>
                                                    <span className={`badge ${r.priority === 'high' ? 'badge-danger' : r.priority === 'medium' ? 'badge-warning' : ''}`}>
                                                        {r.priority ?? 'normal'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${r.status === 'resolved' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : r.status === 'rejected' ? 'badge-danger' : ''}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {r.createdAt?.toDate ? format(r.createdAt.toDate(), 'dd MMM yy') : '—'}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => selectAdminReport(r)} title="Edit Status">
                                                            <Edit3 size={13} />
                                                        </button>
                                                        {isSuperAdmin && (
                                                            <button className="btn btn-sm" style={{ padding: '4px 8px', background: 'var(--color-danger)', color: '#fff', border: 'none' }} onClick={() => handleDeleteReport(r)} title="Delete Report">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                            {adminReports.filter(r => (reportStatusFilter === 'all' || r.status === reportStatusFilter) && (!reportWardFilter || (r.ward ?? '').toLowerCase().includes(reportWardFilter.toLowerCase()))).length === 0 && (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <div className="empty-state-icon">📋</div>
                                    <div className="empty-state-title">No reports match filters</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}



            {/* Role Requests Tab */}
            {activeTab === 'role_requests' && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        Pending Role Approvals
                        {roleRequests.length > 0 && (
                            <span className="badge badge-warning" style={{ marginLeft: '8px' }}>{roleRequests.length}</span>
                        )}
                    </h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                        Approve or reject role requests from businesses, college admins, and officers.
                        Approvals update the user's Firestore document immediately.
                    </p>
                    {roleRequests.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <div className="empty-state-icon">✅</div>
                            <div className="empty-state-title">No pending approvals</div>
                            <p>All role requests have been reviewed.</p>
                        </div>
                    ) : (
                        <div className={styles.approvalList}>
                            {roleRequests.map(req => (
                                <div key={req.uid} className={styles.approvalCard}>
                                    <div className={styles.approvalAvatar}>
                                        {req.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className={styles.approvalInfo}>
                                        <div className={styles.approvalName}>{req.displayName}</div>
                                        <div className={styles.approvalMeta}>{req.email}</div>
                                        <div className={styles.approvalMeta}>
                                            <MapPin size={11} style={{ display: 'inline' }} /> Ward: {req.ward}
                                            {req.organization && <> · 🏢 {req.organization}</>}
                                        </div>
                                        <span className="badge badge-warning" style={{ marginTop: '4px' }}>
                                            {req.requestedRole.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className={styles.approvalActions}>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req)}>
                                            ✓ Approve
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(req)}>
                                            ✗ Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className={styles.section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <div>
                            <h2 className={styles.sectionTitle}>User Management</h2>
                            {isSuperAdmin && (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Super Admin: use the role dropdown in each row to change a user's role directly.
                                </p>
                            )}
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={fetchUsers} disabled={loadingUsers}>
                            <RefreshCw size={14} className={loadingUsers ? styles.spin : ''} /> Refresh
                        </button>
                    </div>
                    <input
                        type="text"
                        className="input"
                        placeholder="Search by name or email..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        style={{ marginBottom: 'var(--space-4)' }}
                    />
                    {loadingUsers ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Roles</th>
                                        <th>Ward</th>
                                        <th>Points</th>
                                        <th>Reports</th>
                                        <th>Status</th>
                                        {isSuperAdmin && <th>Change Role</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                                                No users found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map(u => (
                                            <tr key={u.uid}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '30px', height: '30px', borderRadius: '50%',
                                                            background: 'var(--color-primary-100)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)',
                                                            color: 'var(--color-primary-600)', fontSize: '13px',
                                                        }}>
                                                            {u.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                                                        </div>
                                                        <div>
                                                            <span style={{ fontWeight: 'var(--fw-semibold)' }}>{u.displayName}</span>
                                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', cursor: 'pointer' }}
                                                                title="Click to copy UID"
                                                                onClick={() => { navigator.clipboard.writeText(u.uid); toast.success('UID copied!'); }}>
                                                                {u.uid.slice(0, 12)}…
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{u.email}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {(u.roles ?? []).map((r: string) => (
                                                            <span key={r} className="badge" style={{
                                                                fontSize: '11px',
                                                                background: r === 'super_admin' ? 'var(--color-danger)' : r.includes('admin') ? 'var(--color-primary-500)' : undefined,
                                                                color: (r === 'super_admin' || r.includes('admin')) ? '#fff' : undefined,
                                                            }}>
                                                                {r.replace(/_/g, ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: '13px' }}>
                                                    {editingUserWard === u.uid ? (
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <input className="input" style={{ maxWidth: '100px', padding: '4px 8px', fontSize: '12px' }} value={userWardValue} onChange={e => setUserWardValue(e.target.value)} />
                                                            <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleSaveUserWard(u)}><Save size={12} /></button>
                                                            <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => setEditingUserWard(null)}><X size={12} /></button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => { setEditingUserWard(u.uid); setUserWardValue(u.ward ?? ''); }}>
                                                            {u.ward ?? '—'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent-400)' }}>
                                                        {u.points ?? 0}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '13px' }}>{u.totalReports ?? 0}</td>
                                                <td>
                                                    <button
                                                        className={`btn btn-sm ${u.disabled ? 'btn-outline' : ''}`}
                                                        style={{ padding: '4px 10px', fontSize: '11px', background: u.disabled ? undefined : 'var(--color-warning)', color: u.disabled ? undefined : '#fff', border: u.disabled ? undefined : 'none' }}
                                                        disabled={togglingUser === u.uid}
                                                        onClick={() => handleToggleUserDisabled(u)}
                                                        title={u.disabled ? 'Enable this user' : 'Disable this user'}
                                                    >
                                                        {u.disabled ? <><UserCheck size={12} /> Enable</> : <><UserX size={12} /> Disable</>}
                                                    </button>
                                                </td>
                                                {isSuperAdmin && (
                                                    <td>
                                                        <select
                                                            className="select"
                                                            style={{ fontSize: '12px', padding: '4px 8px', minWidth: '150px' }}
                                                            defaultValue=""
                                                            onChange={async (e) => {
                                                                const newRole = e.target.value;
                                                                if (!newRole) return;
                                                                if (!confirm(`Change ${u.displayName}'s role to "${newRole}"?`)) {
                                                                    e.target.value = '';
                                                                    return;
                                                                }
                                                                try {
                                                                    await updateDoc(doc(db, 'users', u.uid), {
                                                                        roles: [newRole],
                                                                        updatedAt: serverTimestamp(),
                                                                    });
                                                                    setUsers(prev => prev.map(usr =>
                                                                        usr.uid === u.uid ? { ...usr, roles: [newRole] } : usr
                                                                    ));
                                                                    toast.success(`✓ ${u.displayName} → ${newRole.replace(/_/g, ' ')}`);
                                                                } catch (err: any) {
                                                                    toast.error('Failed: ' + err.message);
                                                                }
                                                                e.target.value = '';
                                                            }}
                                                        >
                                                            <option value="">Change role…</option>
                                                            <option value="super_admin">⚠️ super_admin</option>
                                                            <option value="corp_admin">corp_admin</option>
                                                            <option value="system_admin">system_admin</option>
                                                            <option value="corp_officer">corp_officer</option>
                                                            <option value="zonal_officer">zonal_officer</option>
                                                            <option value="ward_officer">ward_officer</option>
                                                            <option value="sanitation_worker">sanitation_worker</option>
                                                            <option value="citizen">citizen (demote)</option>
                                                        </select>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            )}

            {/* Special Zones Tab */}
            {activeTab === 'zones' && (
                <div className={styles.section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <div>
                            <h2 className={styles.sectionTitle}>Special Zones & Festival Mode</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Define zones like temples or markets. Add festival dates to auto-boost report priority.
                            </p>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowZoneForm(v => !v)}>
                            <Plus size={14} /> Add Zone
                        </button>
                    </div>

                    {/* Add Zone Form */}
                    {/* Edit Zone Form */}
                    {editingZone && (
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontWeight: 'var(--fw-semibold)' }}>✏️ Edit Zone: {editingZone.name}</h3>
                                <button className="btn btn-outline btn-sm" onClick={() => setEditingZone(null)}><X size={14} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Zone Name</label>
                                    <input className="input" value={editZoneName} onChange={e => setEditZoneName(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Type</label>
                                    <select className="select" value={editZoneType} onChange={e => setEditZoneType(e.target.value)}>
                                        <option value="temple">🛕 Temple</option>
                                        <option value="market">🛒 Market</option>
                                        <option value="school">🏫 School</option>
                                        <option value="hospital">🏥 Hospital</option>
                                        <option value="park">🌳 Park</option>
                                        <option value="railway">🚉 Railway</option>
                                        <option value="custom">📍 Custom</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Radius (m)</label>
                                    <input className="input" type="number" value={editZoneRadius} onChange={e => setEditZoneRadius(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Festival Dates (comma-separated)</label>
                                    <input className="input" placeholder="2025-04-14, 2025-10-02" value={editZoneFestival} onChange={e => setEditZoneFestival(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '12px' }}>
                                    <label className="form-label required">Zone Location</label>
                                    <LocationPicker
                                        lat={parseFloat(editZoneLat) || 0}
                                        lng={parseFloat(editZoneLng) || 0}
                                        onChange={(lat, lng) => {
                                            setEditZoneLat(String(lat));
                                            setEditZoneLng(String(lng));
                                        }}
                                        height="300px"
                                    />
                                </div>
                            </div>
                            <button className="btn btn-primary btn-sm" disabled={savingEditZone} onClick={handleUpdateZone}>
                                <Save size={14} /> {savingEditZone ? 'Saving…' : 'Save Zone'}
                            </button>
                        </div>
                    )}
                    {showZoneForm && (
                        <div style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xl)',
                            padding: 'var(--space-5)',
                            marginBottom: 'var(--space-4)',
                        }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--space-4)', fontSize: '15px' }}>
                                New Special Zone
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Zone Name</label>
                                    <input className="input" placeholder="e.g. Meenakshi Temple Area" value={zoneName} onChange={e => setZoneName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Zone Type</label>
                                    <select className="select" value={zoneType} onChange={e => setZoneType(e.target.value)}>
                                        <option value="temple">Temple</option>
                                        <option value="market">Market</option>
                                        <option value="bus_stand">Bus Stand</option>
                                        <option value="hospital">Hospital</option>
                                        <option value="park">Park</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Festival Dates (comma-separated, YYYY-MM-DD)</label>
                                    <input
                                        className="input"
                                        placeholder="e.g. 2025-04-14, 2025-12-25"
                                        value={zoneFestival}
                                        onChange={e => setZoneFestival(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label required">Zone Location (Pin on map)</label>
                                    <LocationPicker
                                        lat={parseFloat(zoneLat) || 0}
                                        lng={parseFloat(zoneLng) || 0}
                                        onChange={(lat, lng) => {
                                            setZoneLat(String(lat));
                                            setZoneLng(String(lng));
                                        }}
                                        height="300px"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Radius (meters)</label>
                                    <input className="input" type="number" placeholder="500" value={zoneRadius} onChange={e => setZoneRadius(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-4)' }}>
                                <button className="btn btn-primary" onClick={handleAddZone} disabled={savingZone}>
                                    {savingZone ? 'Saving...' : '+ Create Zone'}
                                </button>
                                <button className="btn btn-ghost" onClick={() => setShowZoneForm(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {specialZones.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <div className="empty-state-icon">🗺️</div>
                            <div className="empty-state-title">No special zones defined</div>
                            <p>Add your first zone using the button above.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {specialZones.map(zone => (
                                <div key={zone.id} style={{
                                    background: 'var(--bg-card)',
                                    border: `1px solid ${zone.isActive ? 'var(--color-primary-200)' : 'var(--border-subtle)'}`,
                                    borderRadius: 'var(--radius-xl)',
                                    padding: 'var(--space-4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-4)',
                                    opacity: zone.isActive ? 1 : 0.6,
                                }}>
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: 'var(--radius-lg)',
                                        background: zone.isActive ? 'var(--color-primary-50)' : 'var(--bg-subtle)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                                    }}>
                                        {zone.type === 'temple' ? '🛕' : zone.type === 'market' ? '🏪' : zone.type === 'bus_stand' ? '🚌' : zone.type === 'park' ? '🌳' : '📍'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
                                            {zone.name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            Type: {zone.type.replace(/_/g, ' ')}
                                            {zone.lat && zone.lng && ` · Maps: ${zone.lat}, ${zone.lng} (${zone.radius}m)`}
                                            {zone.festivalDays && zone.festivalDays.length > 0 && (
                                                <> · Festival days: {zone.festivalDays.join(', ')}</>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className={`badge ${zone.isActive ? 'badge-success' : ''}`}>
                                            {zone.isActive ? '● Active' : '○ Inactive'}
                                        </span>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => startEditZone(zone)}
                                            style={{ fontSize: '12px' }}
                                            title="Edit zone"
                                        >
                                            <Edit3 size={13} />
                                        </button>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => handleToggleZone(zone)}
                                            style={{ fontSize: '12px' }}
                                        >
                                            {zone.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-icon btn-sm"
                                            onClick={() => handleDeleteZone(zone)}
                                            style={{ color: 'var(--color-danger)' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── BLOCKS TAB — Adopt Blocks CRUD ─────────────────────────────── */}
            {activeTab === 'blocks' && (
                <div className={styles.section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <div>
                            <h2 className={styles.sectionTitle}>Adopt Blocks Management</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                View and manage all public blocks. Edit cleanliness scores, change status, or release adoptions.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline btn-sm" onClick={fetchBlocks} disabled={loadingBlocks}>
                                <RefreshCw size={14} className={loadingBlocks ? styles.spin : ''} /> Refresh
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowBlockForm(v => !v); setEditingBlock(null); }}>
                                <Plus size={14} /> {showBlockForm ? 'Cancel' : 'Add Block'}
                            </button>
                        </div>
                    </div>

                    {/* Add Block Form */}
                    {showBlockForm && (
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--space-4)', fontSize: '15px' }}>
                                New Block
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Block Name</label>
                                    <input className="input" placeholder="e.g. KK Nagar Main Park" value={blockFormName} onChange={e => setBlockFormName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Ward</label>
                                    <input className="input" placeholder="e.g. Ward 42" value={blockFormWard} onChange={e => setBlockFormWard(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label required">Location (Pin on map)</label>
                                    <LocationPicker
                                        lat={blockFormLat}
                                        lng={blockFormLng}
                                        onChange={(lat, lng) => {
                                            setBlockFormLat(lat);
                                            setBlockFormLng(lng);
                                        }}
                                        height="250px"
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-4)' }}>
                                <button className="btn btn-primary" onClick={handleAddBlock} disabled={savingBlock}>
                                    {savingBlock ? 'Saving...' : '+ Add Block'}
                                </button>
                                <button className="btn btn-ghost" onClick={() => setShowBlockForm(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* Inline edit form for block */}
                    {editingBlock && (
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontWeight: 'var(--fw-semibold)' }}>✏️ Edit Block: {editingBlock.name}</h3>
                                <button className="btn btn-outline btn-sm" onClick={() => setEditingBlock(null)}><X size={14} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Cleanliness Score (0-100)</label>
                                    <input className="input" type="number" min={0} max={100} value={blockScore} onChange={e => setBlockScore(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Status</label>
                                    <select className="select" value={blockStatus} onChange={e => setBlockStatus(e.target.value)}>
                                        <option value="unmonitored">Unmonitored</option>
                                        <option value="adopted">Adopted</option>
                                        <option value="monitored">Monitored</option>
                                        <option value="poor">Poor</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <button className="btn btn-primary btn-sm" disabled={savingBlock} onClick={handleUpdateBlock}>
                                    <Save size={14} /> {savingBlock ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {loadingBlocks ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading blocks…</div>
                    ) : blocks.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <div className="empty-state-icon">🧱</div>
                            <div className="empty-state-title">No blocks found</div>
                            <p>Blocks appear here once citizens adopt them via the Adopt-a-Block feature.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Block Name</th>
                                        <th>Ward</th>
                                        <th>Score</th>
                                        <th>Status</th>
                                        <th>Adopter</th>
                                        <th>Complaints</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {blocks.map(b => (
                                        <tr key={b.id} style={{ background: editingBlock?.id === b.id ? 'var(--color-primary-50)' : undefined }}>
                                            <td style={{ fontWeight: 'var(--fw-semibold)', fontSize: '13px' }}>{b.name}</td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{b.ward}</td>
                                            <td style={{ minWidth: '120px' }}><ScoreBar score={b.cleanliness_score} /></td>
                                            <td>
                                                <span className={`badge ${b.status === 'adopted' ? 'badge-success' : b.status === 'critical' ? 'badge-danger' : b.status === 'poor' ? 'badge-warning' : ''}`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '12px' }}>
                                                {b.ownerName ? (
                                                    <span style={{ color: 'var(--color-success)', fontWeight: 'var(--fw-semibold)' }}>✓ {b.ownerName}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${b.openComplaints > 0 ? 'badge-danger' : ''}`}>{b.openComplaints ?? 0}</span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} title="Edit" onClick={() => startEditBlock(b)}>
                                                        <Edit3 size={13} />
                                                    </button>
                                                    {b.adopterId && (
                                                        <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px', color: 'var(--color-warning)' }} title="Release Adoption" onClick={() => handleReleaseAdoption(b)}>
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                    {isSuperAdmin && (
                                                        <button className="btn btn-sm" style={{ padding: '4px 8px', background: 'var(--color-danger)', color: '#fff', border: 'none' }} title="Delete Block" onClick={() => handleDeleteBlock(b)}>
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Settings Tab — super_admin only */}
            {activeTab === 'settings' && isSuperAdmin && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle} style={{ marginBottom: 'var(--space-4)' }}>System Settings</h2>

                    <div style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)',
                        padding: 'var(--space-6)',
                        maxWidth: '600px'
                    }}>
                        <h3 className={styles.cardTitle} style={{ marginBottom: 'var(--space-2)' }}>Report Notifications</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-5)' }}>
                            Configure the central email address that will receive notifications whenever a user submits a new issue report.
                        </p>

                        <div className="form-group">
                            <label className="form-label">Notification Email Address</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="e.g. admin@maduraicorp.gov.in"
                                value={reportEmail}
                                onChange={(e) => setReportEmail(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
                            <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                                {savingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── System Management Tab (super_admin only) ─── */}
            {activeTab === 'system' && isSuperAdmin && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle} style={{ marginBottom: '4px' }}>System Management</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
                        Super Admin only. Directly assign or revoke privileged roles on any user account.
                    </p>

                    {/* Assign role panel */}
                    <div style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)',
                        padding: 'var(--space-6)',
                        maxWidth: '600px',
                        marginBottom: 'var(--space-5)',
                    }}>
                        <h3 className={styles.cardTitle} style={{ marginBottom: '4px' }}>Assign / Revoke Role</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                            Enter any user's UID and select the role to assign. Existing roles will be replaced.
                        </p>
                        <div className="form-group">
                            <label className="form-label">User UID</label>
                            {users.length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading users...</div>
                            ) : (
                                <select
                                    className="select"
                                    value={assignUid}
                                    onChange={e => setAssignUid(e.target.value)}
                                >
                                    <option value="">Select a user...</option>
                                    {users.map(u => (
                                        <option key={u.uid} value={u.uid}>
                                            {u.displayName || u.email || 'Unknown User'} ({u.uid})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role to Assign</label>
                            <select className="select" value={assignRole} onChange={e => setAssignRole(e.target.value)}>
                                <option value="super_admin">super_admin — Super Admin ⚠️</option>
                                <option value="corp_admin">corp_admin — Corporation Admin</option>
                                <option value="system_admin">system_admin — System Admin</option>
                                <option value="corp_officer">corp_officer — Corporation Officer</option>
                                <option value="zonal_officer">zonal_officer — Zonal Officer</option>
                                <option value="ward_officer">ward_officer — Ward Officer</option>
                                <option value="sanitation_worker">sanitation_worker — Sanitation Worker</option>
                                <option value="citizen">citizen — Citizen (demote)</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-4)' }}>
                            <button
                                className="btn btn-primary"
                                disabled={assigningRole || !assignUid.trim()}
                                onClick={async () => {
                                    if (!assignUid.trim()) return;
                                    setAssigningRole(true);
                                    try {
                                        const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
                                        await updateDoc(firestoreDoc(db, 'users', assignUid.trim()), {
                                            roles: [assignRole],
                                            updatedAt: (await import('firebase/firestore')).serverTimestamp(),
                                        });
                                        toast.success(`✓ Role "${assignRole}" assigned to user ${assignUid.trim()}`);
                                        setAssignUid('');
                                        // Also update roleRequests if exists
                                        try {
                                            const { updateDoc: ud2, doc: d2 } = await import('firebase/firestore');
                                            await ud2(d2(db, 'roleRequests', assignUid.trim()), {
                                                status: 'approved',
                                                approvedAt: (await import('firebase/firestore')).serverTimestamp(),
                                            });
                                        } catch { /* ok if no role request */ }
                                    } catch (e: any) {
                                        toast.error('Failed: ' + e.message);
                                    } finally {
                                        setAssigningRole(false);
                                    }
                                }}
                            >
                                {assigningRole ? 'Assigning...' : 'Assign Role'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setAssignUid('')}>Clear</button>
                        </div>
                    </div>

                    {/* Info panel */}
                    <div style={{
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 'var(--radius-xl)',
                        padding: 'var(--space-5)',
                        maxWidth: '600px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--color-danger)', marginBottom: '6px' }}>
                                    Super Admin Powers
                                </div>
                                <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, paddingLeft: '16px' }}>
                                    <li>You can assign any role including <strong>corp_admin</strong> and <strong>system_admin</strong></li>
                                    <li>Use the <strong>Users tab</strong> to find a user's UID before assigning</li>
                                    <li>Role changes take effect immediately on the user's next page load</li>
                                    <li>Use <strong>Settings tab</strong> to configure system-wide notification email</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
