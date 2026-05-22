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
  const paused = useCelebrationQueueStore((s) => s.paused);
  const [active, setActive] = useState<CelebrationEvent | null>(null);
  const activeRef = useRef<CelebrationEvent | null>(null);
  activeRef.current = active;

  useEffect(() => {
    // Hold while another modal owns the screen (PostTradeSummary).
    // Re-fires on `paused` flipping back to false → the queue drains
    // anything that landed while paused.
    if (active || queueLen === 0 || paused) return;
    const next = useCelebrationQueueStore.getState().dequeue();
    if (next) setActive(next);
  }, [queueLen, active, paused]);

  if (!active) return null;
  return (
    <CelebrationModal
      event={active}
      onDismiss={() => setActive(null)}
    />
  );
}
