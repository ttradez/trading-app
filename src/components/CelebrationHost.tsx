import React, { useEffect, useRef, useState } from 'react';
import CelebrationModal from './CelebrationModal';
import {
  useCelebrationQueueStore,
  useCelebrationQueueLength,
  CelebrationEvent,
} from '../store/celebrationQueueStore';

/**
 * Drains the unified celebration queue one at a time. Mounted once
 * at the app root so it overlays any screen.
 *
 * Tap "Continue" → current dismisses, the next item (if any) takes
 * its place. Dequeue order is the queue store's responsibility —
 * priority is badge → rank → streak (see celebrationQueueStore).
 */

export default function CelebrationHost() {
  const queueLen = useCelebrationQueueLength();
  const [active, setActive] = useState<CelebrationEvent | null>(null);
  const activeRef = useRef<CelebrationEvent | null>(null);
  activeRef.current = active;

  useEffect(() => {
    if (active || queueLen === 0) return;
    const next = useCelebrationQueueStore.getState().dequeue();
    if (next) setActive(next);
  }, [queueLen, active]);

  if (!active) return null;
  return (
    <CelebrationModal
      event={active}
      onDismiss={() => setActive(null)}
    />
  );
}
