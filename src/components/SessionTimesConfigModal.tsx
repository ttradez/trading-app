import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { colors } from '../theme';
import {
  useSessionTimesStore,
  type SessionKey,
} from '../store/sessionTimesStore';

/**
 * SessionTimesConfigModal — bottom-sheet for the Sessions Phase B config.
 *
 * Mirrors `SymbolPickerSheet`'s sheet shape (backdrop + sliding sheet +
 * handle + title + scrollable rows + gold-tint selected rows + checkmarks).
 * Two sections: a Timezone list (single-select) and three Session rows
 * (NY / London / Asia) with a tappable HH:MM that opens a native time
 * picker. Every change writes to the Zustand store immediately — no
 * "Save" required; persist + AsyncStorage handles durability.
 *
 * The Reset button restores Phase A defaults (NY 09:30 / London 03:00 /
 * Asia 20:00 / tz America/New_York). Done just closes the sheet.
 */

/** IANA tz list — limited to the markets users actually trade from. */
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const SESSION_ROWS: { key: SessionKey; label: string }[] = [
  { key: 'newyork', label: 'New York' },
  { key: 'london', label: 'London' },
  { key: 'asia', label: 'Asia' },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SessionTimesConfigModal({ visible, onClose }: Props) {
  const tz = useSessionTimesStore((s) => s.tz);
  const newyork = useSessionTimesStore((s) => s.newyork);
  const london = useSessionTimesStore((s) => s.london);
  const asia = useSessionTimesStore((s) => s.asia);
  const setTz = useSessionTimesStore((s) => s.setTz);
  const setSessionTime = useSessionTimesStore((s) => s.setSessionTime);
  const reset = useSessionTimesStore((s) => s.reset);

  // Which session row's time-picker is currently open (null = none).
  // Single-picker shape mirrors SettingsScreen's `timePicker` state.
  const [pickerFor, setPickerFor] = useState<SessionKey | null>(null);

  const timeFor = (key: SessionKey) => {
    if (key === 'newyork') return newyork;
    if (key === 'london') return london;
    return asia;
  };

  const onTimePickerEvent = (
    key: SessionKey,
    _event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    setPickerFor(null);
    if (!selected) return;
    setSessionTime(key, selected.getHours(), selected.getMinutes());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Session Times</Text>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* TIMEZONE SECTION */}
            <Text style={styles.sectionLabel}>Timezone</Text>
            <View style={styles.tzList}>
              {TIMEZONES.map((id) => {
                const selected = id === tz;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setTz(id)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      selected && styles.optionSelected,
                      pressed && !selected && styles.optionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Use timezone ${id}`}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                      ]}
                    >
                      {id}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark" size={20} color={colors.gold} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* TIMES SECTION */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
              Times
            </Text>
            <View style={styles.timesList}>
              {SESSION_ROWS.map((row) => {
                const t = timeFor(row.key);
                return (
                  <Pressable
                    key={row.key}
                    onPress={() => setPickerFor(row.key)}
                    style={({ pressed }) => [
                      styles.timeRow,
                      pressed && styles.optionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${row.label} session time`}
                  >
                    <Text style={styles.timeRowLabel}>{row.label}</Text>
                    <Text style={styles.timeRowValue}>
                      {pad(t.hh)}:{pad(t.mm)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* FOOTER ACTIONS */}
            <View style={styles.footer}>
              <Pressable
                onPress={reset}
                style={({ pressed }) => [
                  styles.resetBtn,
                  pressed && styles.resetBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Reset session times to defaults"
              >
                <Text style={styles.resetBtnText}>Reset to defaults</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.doneBtn,
                  pressed && styles.doneBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Native time picker — opened by a row tap. iOS fires inline as
              the wheel scrolls; Android dispatches a single `set` event
              with the chosen Date. Either way we close the picker after
              the first update so the user can immediately reopen it for
              another row. */}
          {pickerFor !== null && (
            <DateTimePicker
              value={(() => {
                const t = timeFor(pickerFor);
                const d = new Date();
                d.setHours(t.hh, t.mm, 0, 0);
                return d;
              })()}
              mode="time"
              display="spinner"
              onChange={(event, selected) =>
                onTimePickerEvent(pickerFor, event, selected)
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 0,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  sectionLabelSpaced: {
    marginTop: 18,
  },
  tzList: {
    // No special wrap — rows are full-width Pressables.
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionSelected: {
    backgroundColor: 'rgba(255,184,0,0.10)',
  },
  optionPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: colors.gold,
  },
  timesList: {
    // Container exists so future separators can pin off it.
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  timeRowLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  timeRowValue: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    gap: 12,
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  resetBtnPressed: {
    opacity: 0.6,
  },
  resetBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  doneBtnPressed: {
    opacity: 0.85,
  },
  doneBtnText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
