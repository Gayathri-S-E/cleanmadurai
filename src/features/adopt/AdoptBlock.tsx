import { useState, useEffect, useRef } from 'react';
import {
    collection, getDocs, doc, updateDoc, serverTimestamp,
    query, orderBy, addDoc, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Circle, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Block } from '../../types';
import { MapPin, Camera, X, Grid3X3, List, Search, PlusCircle, Map as MapIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './AdoptBlock.module.css';

const MADURAI_CENTER: [number, number] = [9.9252, 78.1198];

function AdoptBlock() {
    const { user, profile, updateUserProfile } = useAuth();
    const [blocks, setBlocks] = useState<Partial<Block>[]>([]);
    const [loadingBlocks, setLoadingBlocks] = useState(true);
    const [loading, setLoading] = useState(false);
    const [adopted, setAdopted] = useState<string[]>(profile?.adoptedBlocks ?? []);
    const [searchQuery, setSearchQuery] = useState('');
    const [creatingWard, setCreatingWard] = useState(false);

    // Pinpoint states
    const [isPinpointing, setIsPinpointing] = useState(false);
    const [newMarker, setNewMarker] = useState<{ lat: number, lng: number } | null>(null);
    const [newBlockName, setNewBlockName] = useState('');
    const [newBlockWard, setNewBlockWard] = useState(profile?.ward ?? '');

    // Clean proof upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [proofBlockId, setProofBlockId] = useState<string | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string>('');
    const [uploadingProof, setUploadingProof] = useState(false);
    const [viewMode, setViewMode] = useState<'adopt' | 'twin' | 'map'>('adopt');

    // Add Block from List view state
    const [isAddingBlock, setIsAddingBlock] = useState(false);
    const [addBlockName, setAddBlockName] = useState('');
    const [addBlockWard, setAddBlockWard] = useState(profile?.ward ?? '');
    const [addBlockAddress, setAddBlockAddress] = useState('');

    // Fetch blocks from Firestore
    useEffect(() => {
        const fetchBlocks = async () => {
            setLoadingBlocks(true);
            try {
                const snap = await getDocs(query(collection(db, 'blocks'), orderBy('score', 'asc')));
                setBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Partial<Block>)));
            } catch (e) {
                console.error('Failed to load blocks:', e);
            } finally {
                setLoadingBlocks(false);
            }
        };
        fetchBlocks();
    }, []);

    // Keep adopted list in sync with profile
    useEffect(() => {
        setAdopted(profile?.adoptedBlocks ?? []);
    }, [profile?.adoptedBlocks]);

    // ── Search / filter ──
    const lowerQ = searchQuery.toLowerCase().trim();
    const matchesSearch = (b: Partial<Block>) =>
        !lowerQ ||
        b.name?.toLowerCase().includes(lowerQ) ||
        b.ward?.toLowerCase().includes(lowerQ) ||
        b.address?.toLowerCase().includes(lowerQ);

    // All wards present in the blocks list
    const knownWards = [...new Set(blocks.map(b => b.ward).filter(Boolean))] as string[];

    // Whether the searched text looks like a ward that doesn't exist
    const isNewWard =
        lowerQ.length >= 2 &&
        !knownWards.some(w => w.toLowerCase() === lowerQ) &&
        blocks.filter(matchesSearch).length === 0;

    const handleAdopt = async (block: Partial<Block>) => {
        if (!user || !profile) return;
        if (adopted.includes(block.id!)) {
            toast('You already adopted this block!', { icon: '🏠' });
            return;
        }
        if (adopted.length >= 3) {
            toast.error('You can only adopt a maximum of 3 blocks.', { icon: '🚫' });
            return;
        }

        setLoading(true);
        try {
            await updateDoc(doc(db, 'blocks', block.id!), {
                adopterId: user.uid,
                adopterName: profile.displayName,
                ownerId: user.uid,
                ownerName: profile.displayName,
                adoptedAt: serverTimestamp(),
            });
            await updateUserProfile({
                adoptedBlocks: [...(profile.adoptedBlocks ?? []), block.id!],
                points: (profile.points ?? 0) + 50,
            });
            setAdopted(prev => [...prev, block.id!]);
            toast.success(`Adopted "${block.name}"! +50 points 🌿`);
        } catch (e: any) { toast.error('Failed to adopt'); }
        finally { setLoading(false); }
    };

    // ── Create Ward ──
    const handleCreateWard = async () => {
        if (!user || !searchQuery.trim()) return;
        const wardName = searchQuery.trim();

        // Check if already exists
        const wardRef = doc(db, 'wards', wardName);
        const snap = await getDoc(wardRef);
        if (snap.exists()) {
            toast('Ward already exists!', { icon: 'ℹ️' });
            return;
        }

        setCreatingWard(true);
        try {
            await addDoc(collection(db, 'wards'), {
                name: wardName,
                nameTA: wardName,
                openReports: 0,
                resolvedReports: 0,
                cleanlinessScore: 50,
                wasteExchanges: 0,
                adoptedBlocks: 0,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            });
            toast.success(`Ward "${wardName}" created! 🏙️ Blocks can now be added to it.`);
            setSearchQuery('');
        } catch (e: any) {
            toast.error('Failed to create ward: ' + e.message);
        } finally {
            setCreatingWard(false);
        }
    };

    // ── Create Block from List ──
    const handleCreateBlockList = async () => {
        if (!user || !profile || !addBlockName.trim() || !addBlockWard.trim()) return;
        setLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'blocks'), {
                name: addBlockName.trim(),
                ward: addBlockWard.trim(),
                address: addBlockAddress.trim() || undefined,
                center: { lat: MADURAI_CENTER[0], lng: MADURAI_CENTER[1], Geohash: '' }, // Default center if not on map
                score: 50,
                openReports: 0,
                createdAt: serverTimestamp(),
            });

            setBlocks(prev => [...prev, {
                id: docRef.id,
                name: addBlockName.trim(),
                ward: addBlockWard.trim(),
                address: addBlockAddress.trim() || undefined,
                score: 50,
                openReports: 0
            }]);

            toast.success(`Created Block "${addBlockName}"! 🏙️`);
            setIsAddingBlock(false);
            setAddBlockName('');
            setAddBlockAddress('');
        } catch (e: any) { toast.error('Failed to create block'); }
        finally { setLoading(false); }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !proofBlockId) return;
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
    };

    const handleUploadProof = async () => {
        if (!user || !proofFile || !proofBlockId) return;
        setUploadingProof(true);
        try {
            const block = blocks.find(b => b.id === proofBlockId);
            if (!block) throw new Error('Block not found');

            const photoRef = ref(storage, `cleanProofs/${user.uid}/${Date.now()}_cleanproof_${proofFile.name}`);
            await uploadBytes(photoRef, proofFile);
            const photoURL = await getDownloadURL(photoRef);

            const currentScore = block.score ?? 0;
            const newScore = Math.min(100, currentScore + 10);

            await addDoc(collection(db, 'cleanProofs'), {
                blockId: proofBlockId,
                uploaderId: user.uid,
                uploaderName: profile?.displayName || user.displayName,
                photoURL,
                scoreIncrement: newScore - currentScore,
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, 'blocks', proofBlockId), {
                score: newScore,
                lastCleanProofAt: serverTimestamp(),
            });

            await updateUserProfile({ points: (profile?.points ?? 0) + 20 });
            setBlocks(prev => prev.map(b => b.id === proofBlockId ? { ...b, score: newScore } : b));
            toast.success('Clean proof submitted! +20 points 🎉');

            setProofBlockId(null);
            setProofFile(null);
            setProofPreview('');
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to upload proof');
        } finally {
            setUploadingProof(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const availableBlocks = blocks.filter(b => !adopted.includes(b.id!) && matchesSearch(b));
    const myBlocks = blocks.filter(b => adopted.includes(b.id!));

    const getBlockStateColor = (b: Partial<Block>) => {
        const score = b.score ?? 0;
        const openComplaints = b.openComplaints ?? 0;
        const proofTime = b.lastCleanProofAt?.toDate?.() ?? (b.lastCleanProofAt ? new Date(b.lastCleanProofAt as string) : null);
        const recentProof = proofTime && (Date.now() - proofTime.getTime() < 7 * 86400000);
        if (recentProof && openComplaints <= 2 && score >= 60) return 'var(--color-success)';
        if (openComplaints > 5 || score < 40) return 'var(--color-danger)';
        return 'var(--color-warning)';
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Adopt a Block</h1>
                    <p className={styles.subtitle}>Take ownership of a street, keep it clean, earn rewards!</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.adoptedBadge}>
                        <MapPin size={16} />
                        <span>{adopted.length} Blocks Adopted</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
                        <button
                            className={`btn btn-sm ${viewMode === 'adopt' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('adopt')}
                        >
                            <List size={14} /> Adopt
                        </button>
                        <button
                            className={`btn btn-sm ${viewMode === 'twin' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('twin')}
                        >
                            <Grid3X3 size={14} /> Digital Twin
                        </button>
                        <button
                            className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('map')}
                        >
                            <MapIcon size={14} /> Map
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Search Bar ── */}
            <div className={styles.searchWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by block name, ward or area…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className={styles.searchClear} onClick={() => setSearchQuery('')}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* ── Create Ward Banner ── */}
            {isNewWard && (
                <div className={styles.createWardBanner}>
                    <div className={styles.createWardText}>
                        <PlusCircle size={18} style={{ color: 'var(--color-primary-500)', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)' }}>
                                No blocks found for "<strong>{searchQuery}</strong>"
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                                This ward may not exist yet. You can create it so blocks can be added.
                            </div>
                        </div>
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleCreateWard}
                        disabled={creatingWard}
                    >
                        {creatingWard ? 'Creating…' : `Create Ward`}
                    </button>
                </div>
            )}

            <div className={styles.infoCard}>
                <div className={styles.infoRow}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>🏠</div>
                        <div className={styles.infoText}>
                            <div className={styles.infoTitle}>Adopt</div>
                            <div className={styles.infoDesc}>Take responsibility for a block</div>
                        </div>
                    </div>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>📸</div>
                        <div className={styles.infoText}>
                            <div className={styles.infoTitle}>Report</div>
                            <div className={styles.infoDesc}>Report issues in your block</div>
                        </div>
                    </div>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>🏆</div>
                        <div className={styles.infoText}>
                            <div className={styles.infoTitle}>Earn</div>
                            <div className={styles.infoDesc}>Get points and recognition</div>
                        </div>
                    </div>
                </div>
            </div>

            {loadingBlocks ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading blocks...
                </div>
            ) : viewMode === 'twin' ? (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Digital Twin – Block Status</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Green = clean (score ≥60), Yellow = needs attention, Red = critical. Click a block for details.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {[['var(--color-success)', 'Green – Clean'], ['var(--color-warning)', 'Yellow – Needs attention'], ['var(--color-danger)', 'Red – Critical']].map(([color, label]) => (
                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} /> {label}
                            </span>
                        ))}
                    </div>
                    <div className={styles.blockGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                        {blocks.filter(matchesSearch).map((b) => (
                            <div key={b.id} className={styles.blockCard} style={{ borderLeft: `4px solid ${getBlockStateColor(b)}` }}>
                                <div className={styles.blockHeader}>
                                    <div className={styles.blockName}>{b.name}</div>
                                    <span className="badge">{b.ward}</span>
                                </div>
                                <div className={styles.blockMeta}><MapPin size={12} /> {b.address ?? '—'}</div>
                                <div className={styles.scoreRow}>
                                    <div className={styles.scoreLabel}>Score</div>
                                    <div className={styles.scoreBar}>
                                        <div className={styles.scoreBarFill} style={{ width: `${b.score ?? 0}%`, background: getBlockStateColor(b) }} />
                                    </div>
                                    <span className={styles.scoreNum}>{b.score ?? '—'}</span>
                                </div>
                                {(b.ownerName ?? (b as any).adopterName) ? (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                        👤 Adopted by {b.ownerName ?? (b as any).adopterName}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>— Available to adopt</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : viewMode === 'map' ? (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Blocks Map</h2>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            Click a block to see details and adopt it. &nbsp;
                            <span style={{ color: '#16A34A' }}>●</span> Clean &nbsp;
                            <span style={{ color: '#F59E0B' }}>●</span> Needs attention &nbsp;
                            <span style={{ color: '#DC2626' }}>●</span> Critical
                        </p>
                        <button
                            className={`btn btn-sm ${isPinpointing ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => {
                                setIsPinpointing(!isPinpointing);
                                setNewMarker(null);
                            }}
                        >
                            <MapPin size={14} /> {isPinpointing ? 'Cancel Pinpoint' : 'Pinpoint New Block'}
                        </button>
                    </div>

                    {isPinpointing && (
                        <div style={{ background: 'var(--color-primary-50)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--color-primary-200)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-primary-700)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={18} /> Tap the map to set the new block's location
                            </div>
                            {newMarker && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input type="text" className="input input-sm" placeholder="Block Name (e.g., 5th Cross St)" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} style={{ flex: 1, minWidth: '150px' }} />
                                    <input type="text" className="input input-sm" placeholder="Ward Name" value={newBlockWard} onChange={e => setNewBlockWard(e.target.value)} style={{ width: '120px' }} />
                                    <button className="btn btn-primary btn-sm" disabled={!newBlockName || loading} onClick={async () => {
                                        if (!user || !profile || adopted.length >= 3) return;
                                        setLoading(true);
                                        try {
                                            const docRef = await addDoc(collection(db, 'blocks'), {
                                                name: newBlockName,
                                                ward: newBlockWard,
                                                center: { lat: newMarker.lat, lng: newMarker.lng, Geohash: '' },
                                                score: 50,
                                                openReports: 0,
                                                adopterId: user.uid,
                                                adopterName: profile.displayName,
                                                ownerId: user.uid,
                                                ownerName: profile.displayName,
                                                createdAt: serverTimestamp(),
                                                adoptedAt: serverTimestamp(),
                                            });
                                            await updateUserProfile({
                                                adoptedBlocks: [...(profile.adoptedBlocks ?? []), docRef.id],
                                                points: (profile.points ?? 0) + 50,
                                            });
                                            setAdopted(prev => [...prev, docRef.id]);
                                            toast.success(`Created & Adopted "${newBlockName}"! +50 points 🌿`);
                                            setIsPinpointing(false);
                                            setNewMarker(null);
                                            setNewBlockName('');
                                            // trigger fetch slightly later
                                            setTimeout(() => window.location.reload(), 1500);
                                        } catch (e: any) { toast.error('Failed to create block'); }
                                        finally { setLoading(false); }
                                    }}>Save & Adopt (+50 pts)</button>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ height: '480px', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative', cursor: isPinpointing ? 'crosshair' : 'grab' }}>
                        <MapContainer center={MADURAI_CENTER} zoom={13} style={{ width: '100%', height: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            {/* Component to capture clicks */}
                            <MapEvents onClick={(e: any) => isPinpointing && setNewMarker(e.latlng)} />

                            {newMarker && (
                                <Circle center={[newMarker.lat, newMarker.lng]} radius={120} pathOptions={{ color: '#8B5CF6', fillColor: '#8B5CF6', fillOpacity: 0.6 }} />
                            )}

                            {blocks.filter(matchesSearch).map((b) => {
                                const center = (b as any).center as { lat: number; lng: number } | undefined;
                                if (!center?.lat || !center?.lng) return null;
                                const score = b.score ?? 50;
                                const isAdoptedByOther = !!(b.ownerId ?? (b as any).adopterId) && !adopted.includes(b.id!);
                                const isMine = adopted.includes(b.id!);
                                const color = isMine ? '#16A34A'
                                    : isAdoptedByOther ? '#6B7280'
                                        : score >= 60 ? '#22C55E'
                                            : score >= 40 ? '#F59E0B'
                                                : '#DC2626';
                                return (
                                    <Circle
                                        key={b.id}
                                        center={[center.lat, center.lng]}
                                        radius={120}
                                        pathOptions={{ color, fillColor: color, fillOpacity: 0.40, weight: 2 }}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: '160px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{b.name}</div>
                                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                                                    📍 {b.ward} · Score: {score}/100
                                                </div>
                                                {isMine ? (
                                                    <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>✅ Your Block</span>
                                                ) : isAdoptedByOther ? (
                                                    <span style={{ fontSize: '12px', color: '#6B7280' }}>👤 Adopted by {b.ownerName ?? 'someone'}</span>
                                                ) : (
                                                    <button
                                                        style={{
                                                            width: '100%', marginTop: '4px', padding: '6px 12px',
                                                            background: '#16a34a', color: '#fff',
                                                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                            fontSize: '13px', fontWeight: 600,
                                                        }}
                                                        onClick={() => handleAdopt(b)}
                                                        disabled={loading || adopted.length >= 3}
                                                    >
                                                        Adopt (+50 pts)
                                                    </button>
                                                )}
                                            </div>
                                        </Popup>
                                    </Circle>
                                );
                            })}
                        </MapContainer>
                    </div>
                    {blocks.filter((b) => !!(b as any).center?.lat).length === 0 && (
                        <div className="empty-state" style={{ marginTop: '16px' }}>
                            <div className="empty-state-icon">🗺️</div>
                            <div className="empty-state-title">No blocks on map yet</div>
                            <p>Blocks will appear here once corporation officers add them. Use the Adopt tab to see the list.</p>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Already adopted blocks */}
                    {myBlocks.length > 0 && (
                        <div className={styles.adoptedSection}>
                            <h2 className={styles.sectionTitle}>Your Blocks</h2>
                            <div className={styles.adoptedList}>
                                {myBlocks.map(b => (
                                    <div key={b.id} className={`${styles.blockCard} ${styles.adoptedCard}`}>
                                        <div className={styles.blockHeader}>
                                            <div className={styles.blockName}>{b.name}</div>
                                            <span className="badge badge-success">Adopted ✓</span>
                                        </div>
                                        <div className={styles.blockMeta}><MapPin size={12} /> {b.address}</div>
                                        <div className={styles.scoreRow}>
                                            <div className={styles.scoreLabel}>Block Score</div>
                                            <div className={styles.scoreBar}>
                                                <div className={styles.scoreBarFill} style={{ width: `${b.score}%`, background: (b.score ?? 0) >= 75 ? 'var(--color-success)' : (b.score ?? 0) >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                                            </div>
                                            <span className={styles.scoreNum}>{b.score ?? '—'}</span>
                                        </div>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            style={{ marginTop: '12px', width: '100%', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                                            onClick={() => { setProofBlockId(b.id!); fileInputRef.current?.click(); }}
                                            disabled={loading}
                                        >
                                            <Camera size={14} style={{ marginRight: '6px' }} /> Upload Clean Proof
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available blocks */}
                    {availableBlocks.length === 0 && !isNewWard ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🌆</div>
                            <div className="empty-state-title">
                                {lowerQ ? `No blocks found for "${searchQuery}"` : 'All blocks adopted!'}
                            </div>
                            <p>{lowerQ ? 'Try a different search term.' : 'Every block in Madurai is being looked after. Great work!'}</p>
                        </div>
                    ) : availableBlocks.length > 0 ? (
                        <>
                            <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    Available Blocks {lowerQ ? `matching "${searchQuery}"` : '(Worst First)'}
                                    <span style={{ marginLeft: '8px', fontWeight: 'normal', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                        {availableBlocks.length} block{availableBlocks.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setIsAddingBlock(true)}
                                >
                                    <PlusCircle size={16} style={{ marginRight: '6px' }} /> Add New Block
                                </button>
                            </div>
                            <div className={styles.blockGrid}>
                                {availableBlocks.map(b => (
                                    <div key={b.id} className={styles.blockCard}>
                                        <div className={styles.blockHeader}>
                                            <div className={styles.blockName}>{b.name}</div>
                                            <span className="badge">{b.ward}</span>
                                        </div>
                                        <div className={styles.blockMeta}><MapPin size={12} /> {b.address}</div>
                                        <div className={styles.scoreRow}>
                                            <div className={styles.scoreLabel}>Score</div>
                                            <div className={styles.scoreBar}>
                                                <div className={styles.scoreBarFill} style={{ width: `${b.score}%`, background: (b.score ?? 0) >= 75 ? 'var(--color-success)' : (b.score ?? 0) >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                                            </div>
                                            <span className={styles.scoreNum}>{b.score ?? '—'}</span>
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            style={{ marginTop: '8px', width: '100%' }}
                                            onClick={() => handleAdopt(b)}
                                            disabled={loading || adopted.length >= 3}
                                            title={
                                                adopted.length >= 3 ? 'Maximum 3 block adoptions reached' : ''
                                            }
                                        >
                                            <MapPin size={14} /> Adopt This Block (+50 pts)
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : null}
                </>
            )}

            {/* Hidden file input */}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                capture="environment"
            />

            {/* Upload Proof Modal */}
            {proofPreview && (
                <div className="modal-overlay" onClick={() => { setProofPreview(''); setProofFile(null); setProofBlockId(null); }}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Submit Clean Proof</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setProofPreview(''); setProofFile(null); setProofBlockId(null); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <img
                                src={proofPreview}
                                alt="Clean Proof Preview"
                                style={{ width: '100%', borderRadius: 'var(--radius-xl)', aspectRatio: '4/3', objectFit: 'cover' }}
                            />
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                By submitting this photo, you confirm that this block is clean. You'll earn +20 points!
                            </p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost" onClick={() => { setProofPreview(''); setProofFile(null); setProofBlockId(null); }} disabled={uploadingProof}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleUploadProof} disabled={uploadingProof}>
                                    {uploadingProof ? 'Uploading...' : 'Submit Proof'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New Block Modal */}
            {isAddingBlock && (
                <div className="modal-overlay" onClick={() => setIsAddingBlock(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Block</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setIsAddingBlock(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-control">
                                <label className="label">Block Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., 5th Cross Street"
                                    value={addBlockName}
                                    onChange={e => setAddBlockName(e.target.value)}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Ward</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Ward 26"
                                    value={addBlockWard}
                                    onChange={e => setAddBlockWard(e.target.value)}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Address / Area (Optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Near Water Tank"
                                    value={addBlockAddress}
                                    onChange={e => setAddBlockAddress(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button className="btn btn-ghost" onClick={() => setIsAddingBlock(false)} disabled={loading}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleCreateBlockList} disabled={loading || !addBlockName.trim() || !addBlockWard.trim()}>
                                    {loading ? 'Creating...' : 'Create Block'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for map events
function MapEvents({ onClick }: { onClick: (e: any) => void }) {
    useMapEvents({ click: onClick });
    return null;
}

export default AdoptBlock;
