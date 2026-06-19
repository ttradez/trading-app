import {
  doc, getDoc, runTransaction, serverTimestamp, type Firestore,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Handle uniqueness service.
 *
 * Firestore schema (additive — no migration needed for existing users):
 *
 *   handles/{handleLower}            → { uid, claimedAt }
 *
 * Each lowercase handle gets one doc; the doc id IS the canonical
 * lookup key. `users/{uid}.handle` still holds the user's chosen
 * display casing for read.
 *
 * Why a separate collection: Firestore can't enforce uniqueness on a
 * non-id field. Keying the doc by lowercased handle gives us O(1)
 * existence check + atomic claim via a transaction. Lowercasing
 * collapses "Wolf42" / "WOLF42" / "wolf42" into one identity for
 * collision purposes (Twitter / Discord pattern).
 *
 * Security rules to add server-side (Firestore console):
 *
 *   match /handles/{h} {
 *     allow read:   if true;
 *     allow create: if request.auth.uid == request.resource.data.uid;
 *     allow update: if false;
 *     allow delete: if request.auth.uid == resource.data.uid;
 *   }
 *
 * The transaction below enforces the same invariant client-side so
 * the UI surfaces "handle taken" immediately, but server rules are
 * the authoritative line of defense against a malicious client.
 */

/** Canonical lookup key. Case-insensitive: "Wolf42" → "wolf42". */
function canonical(handle: string): string {
  return handle.trim().toLowerCase();
}

/** Cheap existence check — used by the TraderName screen's debounced
 *  availability indicator. NOT a guarantee (the doc could be claimed
 *  between this read and the user tapping Continue); the transactional
 *  `claimHandle` below is the real gate. */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const key = canonical(handle);
  if (!key) return false;
  try {
    const snap = await getDoc(doc(db, 'handles', key));
    return !snap.exists();
  } catch (e) {
    // Network blip / rules error: don't block the user. They'll hit
    // the same check in the transactional claim path, which is the
    // real gate. Log so we notice persistent failures.
    // eslint-disable-next-line no-console
    console.warn('[handleClaim] availability check failed', e);
    return true;
  }
}

/** Result of a claim attempt — discriminated union so call sites
 *  can branch on outcome without try/catching on error message. */
export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'taken' | 'invalid' | 'network' };

/**
 * Atomic claim of a handle for a given uid. Idempotent — re-claiming
 * the same handle as the same uid is a no-op (covers returning users
 * who re-run the onboarding flow). Throws `taken` when the canonical
 * handle is already held by a different uid.
 *
 * Run AT SIGNUP, AFTER the Firebase user is created. The whole
 * read/write happens inside a Firestore transaction so two users
 * picking the same handle simultaneously can't both win.
 */
export async function claimHandle(handle: string, uid: string): Promise<ClaimResult> {
  const key = canonical(handle);
  if (!key) return { ok: false, reason: 'invalid' };
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db as Firestore, 'handles', key);
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const owner = (snap.data() as { uid?: string } | undefined)?.uid;
        if (owner && owner !== uid) {
          // Throwing inside a transaction rolls everything back. We
          // tag with a recognisable name so the catch below can
          // distinguish "taken" from "network".
          const err = new Error('handle-taken');
          (err as any).code = 'pt/handle-taken';
          throw err;
        }
        // Same uid → idempotent no-op; just bump claimedAt.
      }
      tx.set(ref, {
        uid,
        claimedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === 'pt/handle-taken') return { ok: false, reason: 'taken' };
    // Network / rules failure. Surface as 'network' so callers can
    // decide whether to retry or proceed with a degraded experience.
    // eslint-disable-next-line no-console
    console.warn('[handleClaim] claim transaction failed', e);
    return { ok: false, reason: 'network' };
  }
}
