// All role types in the system
export type UserRole =
    | 'citizen'
    | 'volunteer'
    | 'shop_owner'
    | 'hotel_owner'
    | 'market_vendor'
    | 'farmer'
    | 'animal_shelter'
    | 'recycler'
    | 'college_admin'
    | 'corp_officer'
    | 'corp_admin'
    | 'system_admin'
    | 'super_admin'
    | 'zonal_officer'
    | 'ward_officer'
    | 'sanitation_worker';

export interface UserProfile {
    uid: string;
    displayName: string;
    email?: string;
    phone?: string;
    photoURL?: string;
    roles: UserRole[];
    ward?: string;
    organization?: string;
    points: number;
    badges: string[];
    createdAt: any;
    updatedAt: any;
    fcmToken?: string;
    language: 'en' | 'ta';
    pendingRoleRequest?: {
        requestedRole: UserRole;
        status: 'pending' | 'approved' | 'rejected';
        requestedAt: any;
    };
    adoptedBlocks: string[];
    totalReports: number;
    resolvedReports: number;
    /** Business role approval (e.g. shop_owner, hotel_owner); undefined treated as not-yet-approved */
    approved?: boolean;
    /** Consecutive days with at least one report */
    loginStreak?: number;
}

export type ReportStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'verified';
export type ReportPriority = 'low' | 'normal' | 'high' | 'sos';
export type IssueType =
    | 'glass_on_road'
    | 'garbage_pile'
    | 'plastic_waste'
    | 'organic_waste'
    | 'drainage'
    | 'burning'
    | 'toilet_issue'
    | 'dead_animal'
    | 'others';

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface Report {
    id: string;
    reporterId: string;
    reporterName?: string; // hidden from officers, shown in admin
    issueType: IssueType;
    description?: string;
    photoURL: string;
    afterPhotoURL?: string;
    location: GeoPoint;
    address?: string;
    ward?: string;
    status: ReportStatus;
    priority: ReportPriority;
    isGlassSOS: boolean;
    isAnonymous: boolean;
    assignedTo?: string;
    assignedWorker?: string;
    statusHistory: StatusHistoryEntry[];
    specialZone?: string;
    festivalBoost?: boolean;
    createdAt: any;
    updatedAt: any;
    resolvedAt?: any;
    // AI before-after verification fields (set by Cloud Function)
    aiVerified?: boolean;
    aiVerifiedAt?: any;
    aiConfidence?: number;
    aiImprovement?: 'NONE' | 'PARTIAL' | 'SIGNIFICANT' | 'COMPLETE' | 'PENDING_MANUAL_REVIEW';
    aiVerifyNote?: string;
}

export interface StatusHistoryEntry {
    status: ReportStatus;
    changedBy: string;
    changedByName: string;
    timestamp: any;
    note?: string;
}

export type WasteListingStatus = 'open' | 'claimed' | 'picked' | 'expired';
export type WasteCategory = 'shop' | 'hotel' | 'market';
export type WasteType = 'dry_plastic' | 'dry_cardboard' | 'dry_metal' | 'organic_veg' | 'organic_cooked' | 'mixed';

export interface WasteListing {
    id: string;
    listerId: string;
    listerName: string;
    category: WasteCategory;
    wasteType: WasteType;
    quantity: string;
    pickupWindow: string;
    location: GeoPoint;
    address?: string;
    ward?: string;
    status: WasteListingStatus;
    claimerId?: string;
    claimerName?: string;
    rating?: number;
    feedback?: string;
    createdAt: any;
    updatedAt: any;
    claimedAt?: any;
    pickedAt?: any;
    expiresAt: any;
}

export type BlockStatus = 'green' | 'yellow' | 'red' | 'unmonitored';

export interface Block {
    id: string;
    name: string;
    ward: string;
    address?: string;
    center: GeoPoint;
    bounds: [GeoPoint, GeoPoint]; // NW, SE corners
    status: BlockStatus;
    score?: number; // cleanliness score 0-100
    ownerId?: string;
    ownerName?: string;
    ownerOrg?: string;
    lastCleanProofURL?: string;
    lastCleanProofAt?: any;
    openComplaints: number;
    cleanliness_score: number;
    adopterId?: string | null;
    adoptedAt?: any;
}

export interface Badge {
    id: string;
    name: string;
    nameTA: string;
    description: string;
    icon: string;
    color: string;
    requirement: string;
}

export interface LeaderboardEntry {
    rank: number;
    id: string;
    name: string;
    score: number;
    points?: number;
    ward?: string;
    type: 'user' | 'ward' | 'college';
}

export interface SpecialZone {
    id: string;
    name: string;
    nameTA: string;
    center: GeoPoint;
    radius: number; // in meters
    type: 'temple' | 'market' | 'bus_stand' | 'hospital' | 'park' | 'other';
    festivalDays?: string[]; // ISO date strings
    isActive: boolean;
}

export interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: 'report_status' | 'waste_claim' | 'badge_earned' | 'festival' | 'system';
    read: boolean;
    data?: Record<string, string>;
    createdAt: any;
}

export interface Ward {
    id: string;
    name: string;
    nameTA: string;
    councilor?: string;
    openReports: number;
    resolvedReports: number;
    cleanlinessScore: number;
    wasteExchanges: number;
    adoptedBlocks: number;
}
