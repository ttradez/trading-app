import React from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EconomicEvent, getEventsForDate } from '../data/economicCalendar';

/**
 * EconomicCalendarPanel — slide-up sheet listing macro events for
 * the current replay date. Replaces the symbol-headline NewsPanel
 * as the destination for the chart screen's News button.
 *
 * Date is passed in as YYYY-MM-DD in U.S. Eastern time (the chart
 * screen handles the timezone conversion before this component
 * sees the date). Look-up is a synchronous filter against the
 * bundled `economicCalendar` dataset — no network, no async.
 *
 * Modal animation: slide. Dismiss via the X button or by tapping
 * the backdrop. Swipe-down isn't wired explicitly — Modal's
 * onRequestClose covers the Android system back gesture; iOS
 * users tap the X or backdrop.
 */

const PANEL_BG    = '#0F0F0F';
const PANEL_BORDER = '#1F1F1F';
const RED   = '#FF4757';
const GOLD  = '#FFB800';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July',    'August',   'September', 'October', 'November', 'December',
];

/** "2022-09-13" → "September 13, 2022". Avoids `new Date()` parsing,
 *  which would apply the device timezone to a midnight value and
 *  could roll the day back in negative-UTC-offset zones. */
function formatPrettyDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "08:30" → "8:30 AM ET", "14:00" → "2:00 PM ET". */
function formatTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm} ET`;
}

function impactColor(impact: EconomicEvent['impact']): string {
  if (impact === 'high')   return RED;
  if (impact === 'medium') return GOLD;
  return 'rgba(255,255,255,0.4)';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** YYYY-MM-DD in U.S. Eastern time. */
  date: string;
}

export default function EconomicCalendarPanel({ visible, onClose, date }: Props) {
  const events = getEventsForDate(date);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Drag-handle affordance, even though swipe-to-dismiss
              isn't wired — visual hint that this is a sheet. */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ECONOMIC CALENDAR</Text>
              <Text style={styles.title}>{formatPrettyDate(date)}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No major events scheduled for this date.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {events.map((e, idx) => (
                <View
                  key={`${e.date}-${e.time}-${e.name}-${idx}`}
                  style={styles.row}
                >
                  <View
                    style={[
                      styles.impactDot,
                      { backgroundColor: impactColor(e.impact) },
                    ]}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.time}>{formatTime(e.time)}</Text>
                    <Text style={styles.name} numberOfLines={2}>{e.name}</Text>
                    <Text style={styles.category}>{e.category}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
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
    backgroundColor: PANEL_BG,
    borderTopWidth: 1,
    borderTopColor: PANEL_BORDER,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 14,
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  empty: {
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  list: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
  },
  impactDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  time: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  name: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  category: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
