import { doc, getDoc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from '../types';

export const BADGE_DEFINITIONS = [
    {
        // first_report is awarded by checkReportBadges (report-count based)
        id: 'first_report',
        name: 'First Reporter',
        description: 'Submitted your first report.',
        icon: '📝',
        condition: () => false,
    },
    {
        id: 'clean_ambassador',
        name: 'Clean Ambassador',
        description: 'Reached 100 contribution points.',
        icon: '🌟',
        condition: (profile: UserProfile, newPoints: number) => (profile.points ?? 0) < 100 && newPoints >= 100
    },
    {
        id: 'waste_warrior',
        name: 'Waste Warrior',
        description: 'Reached 500 contribution points.',
        icon: '⚔️',
        condition: (profile: UserProfile, newPoints: number) => (profile.points ?? 0) < 500 && newPoints >= 500
    },
    { id: 'glass_guardian', name: 'Glass Guardian', description: 'Reported 3+ glass-on-road issues.', icon: '🛡️', condition: () => false },
    { id: 'temple_zone_hero', name: 'Temple Zone Hero', description: 'Active in a temple/special zone.', icon: '🛕', condition: () => false },
    { id: 'street_savior', name: 'Street Savior', description: 'Submitted 10+ reports.', icon: '🏆', condition: () => false },
];

/** Award point-milestone badges (Clean Ambassador, Waste Warrior).
 *  Returns the list of newly awarded badge IDs for the caller to toast. */
export async function checkAndAwardBadges(
    userId: string,
    currentProfile: UserProfile,
    newPoints: number,
): Promise<string[]> {
    if (newPoints <= (currentProfile.points ?? 0)) return [];

    const newBadges: typeof BADGE_DEFINITIONS[0][] = [];
    for (const badge of BADGE_DEFINITIONS) {
        if (!currentProfile.badges?.includes(badge.id) && badge.condition(currentProfile, newPoints)) {
            newBadges.push(badge);
        }
    }

    if (newBadges.length > 0) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { badges: arrayUnion(...newBadges.map(b => b.id)) });
        for (const badge of newBadges) {
            await addDoc(collection(db, `users/${userId}/notifications`), {
                title: `New Badge Unlocked! ${badge.icon}`,
                body: `You've earned the "${badge.name}" badge.`,
                type: 'system',
                read: false,
                createdAt: serverTimestamp(),
                link: '/profile',
            });
        }
    }
    return newBadges.map(b => b.id);
}

/** Award report-count-based badges (First Reporter, Glass Guardian, Street Savior, Temple Zone Hero).
 *  Returns the list of newly awarded badge IDs for the caller to toast. */
export async function checkReportBadges(
    userId: string,
    currentBadges: string[],
    totalReports: number,
    issueType: string,
    inFestivalZone: boolean,
): Promise<string[]> {
    const newBadgeIds: string[] = [];

    // First Reporter: very first report
    if (totalReports === 1 && !currentBadges.includes('first_report')) {
        newBadgeIds.push('first_report');
    }

    // Glass Guardian: 3+ glass_on_road reports
    if (issueType === 'glass_on_road' && !currentBadges.includes('glass_guardian')) {
        const snap = await getCountFromServer(
            query(collection(db, 'reports'), where('reporterId', '==', userId), where('issueType', '==', 'glass_on_road'))
        );
        if (snap.data().count >= 3) newBadgeIds.push('glass_guardian');
    }

    // Street Savior: 10+ total reports
    if (totalReports >= 10 && !currentBadges.includes('street_savior')) {
        newBadgeIds.push('street_savior');
    }

    // Temple Zone Hero: submit from an active festival/special zone
    if (inFestivalZone && !currentBadges.includes('temple_zone_hero')) {
        newBadgeIds.push('temple_zone_hero');
    }

    if (newBadgeIds.length > 0) {
        await updateDoc(doc(db, 'users', userId), { badges: arrayUnion(...newBadgeIds) });
        for (const badgeId of newBadgeIds) {
            const def = BADGE_DEFINITIONS.find(b => b.id === badgeId);
            if (def) {
                await addDoc(collection(db, `users/${userId}/notifications`), {
                    title: `Badge Unlocked! ${def.icon}`,
                    body: `You've earned the "${def.name}" badge: ${def.description}`,
                    type: 'system',
                    read: false,
                    createdAt: serverTimestamp(),
                    link: '/profile',
                });
            }
        }
    }
    return newBadgeIds;
}
