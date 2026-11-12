import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { durations } from '@/constants/motion';
import { colors, radii } from '@/constants/tokens';
import { haptics } from '@/utils/haptics';

const OPEN_MS = durations.sheetOpen;
const CLOSE_MS = durations.sheetClose;
const BACKDROP_OPEN_MS = durations.backdropOpen;
const BACKDROP_CLOSE_MS = durations.backdropClose;
const SHEET_OFFSCREEN = 640;
/** Soft ease-out — same language as date / week pill. */
const EASE_OUT = Easing.out(Easing.cubic);
/** Extra white paint below the rounded sheet so keyboard edges stay filled. */
const KEYBOARD_FILL_EXTRA = 48;
/** Fallback when the platform event omits duration (common on Android). */
const KEYBOARD_FALLBACK_MS = Platform.OS === 'ios' ? 250 : 220;
/** Generous top band for drag-to-dismiss (beyond the 5pt grabber). */
const DISMISS_BAND_HEIGHT = 52;
/** Dy / velocity that commits a dismiss from the drag band. */
const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 0.95;

type SheetPanelProps = {
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  /** Skip local enter animation when parent (Modal) drives values. */
  animateOnMount?: boolean;
  backdropOpacity?: Animated.Value;
  sheetTranslateY?: Animated.Value;
};

/** Same parallel close as BottomSheetModal (settings / add). */
function animateSheetClosed(
  backdropOpacity: Animated.Value,
  sheetTranslateY: Animated.Value,
  onFinished: () => void,
) {
  Animated.parallel([
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: BACKDROP_CLOSE_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }),
    Animated.timing(sheetTranslateY, {
      toValue: SHEET_OFFSCREEN,
      duration: CLOSE_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }),
  ]).start(({ finished }) => {
    if (finished) onFinished();
  });
}

function keyboardEasing(event: KeyboardEvent) {
  switch (event.easing) {
    case 'easeIn':
      return Easing.in(Easing.ease);
    case 'easeOut':
      return Easing.out(Easing.ease);
    case 'linear':
      return Easing.linear;
    case 'keyboard':
      // iOS keyboard curve approximation
      return Easing.bezier(0.17, 0.59, 0.4, 0.77);
    case 'easeInEaseOut':
    default:
      return Easing.inOut(Easing.ease);
  }
}

/**
 * Backdrop + white bottom panel. Use as a transparentModal screen root,
 * or wrap with BottomSheetModal for an in-screen RN Modal.
 *
 * Dim fades via opacity; sheet slides separately. White keyboard fill
 * extends under the panel so the sheet does not look cut off above the keyboard.
 */
export function SheetPanel({
  onClose,
  children,
  sheetStyle,
  animateOnMount = true,
  backdropOpacity: backdropOpacityProp,
  sheetTranslateY: sheetTranslateYProp,
}: SheetPanelProps) {
  const insets = useSafeAreaInsets();
  const localBackdrop = useRef(
    new Animated.Value(animateOnMount ? 0 : 1),
  ).current;
  const localSheet = useRef(
    new Animated.Value(animateOnMount ? SHEET_OFFSCREEN : 0),
  ).current;
  const backdropOpacity = backdropOpacityProp ?? localBackdrop;
  const sheetTranslateY = sheetTranslateYProp ?? localSheet;
  /** Route sheets own values; BottomSheetModal passes shared ones. */
  const ownsCloseAnimation =
    backdropOpacityProp == null && sheetTranslateYProp == null;
  const keyboardLift = useRef(new Animated.Value(0)).current;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const dragOriginY = useRef(0);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!animateOnMount || backdropOpacityProp != null) return;
    Animated.parallel([
      Animated.timing(localBackdrop, {
        toValue: 1,
        duration: BACKDROP_OPEN_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(localSheet, {
        toValue: 0,
        duration: OPEN_MS,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateOnMount, backdropOpacityProp, localBackdrop, localSheet]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animateLift = (toValue: number, event: KeyboardEvent) => {
      const duration =
        typeof event.duration === 'number' && event.duration > 0
          ? event.duration
          : KEYBOARD_FALLBACK_MS;

      Animated.timing(keyboardLift, {
        toValue,
        duration,
        easing: keyboardEasing(event),
        // marginBottom cannot use the native driver
        useNativeDriver: false,
      }).start();
    };

    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardOpen(true);
      animateLift(e.endCoordinates.height, e);
    });
    const onHide = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardOpen(false);
      animateLift(0, e);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [keyboardLift]);

  /**
   * Settings-style dismiss: ease-out slide + backdrop fade, then unmount.
   * Route sheets (calendar) must animate here — router.back() alone is abrupt.
   * Modal-owned sheets just forward; BottomSheetModal runs the same curve.
   */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    if (!ownsCloseAnimation) {
      // Modal owns the close animation; ignore further drag while it runs.
      onCloseRef.current();
      return;
    }
    animateSheetClosed(backdropOpacity, sheetTranslateY, () => {
      onCloseRef.current();
    });
  }, [backdropOpacity, ownsCloseAnimation, sheetTranslateY]);

  const dismissPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !closingRef.current,
        onMoveShouldSetPanResponder: (_e, gesture) =>
          !closingRef.current &&
          Math.abs(gesture.dy) > 3 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          if (closingRef.current) return;
          Keyboard.dismiss();
          sheetTranslateY.stopAnimation((value) => {
            dragOriginY.current = typeof value === 'number' ? value : 0;
          });
        },
        onPanResponderMove: (_e, gesture) => {
          if (closingRef.current) return;
          // Drag down only — upward rubber-band stays at rest.
          const next = Math.max(0, dragOriginY.current + gesture.dy);
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_e, gesture) => {
          if (closingRef.current) return;
          const next = Math.max(0, dragOriginY.current + gesture.dy);
          const flingDown = gesture.vy > DISMISS_VELOCITY;
          if (next >= DISMISS_DISTANCE || flingDown) {
            requestClose();
            return;
          }
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: OPEN_MS,
            easing: EASE_OUT,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          if (closingRef.current) return;
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: OPEN_MS,
            easing: EASE_OUT,
            useNativeDriver: true,
          }).start();
        },
      }),
    [requestClose, sheetTranslateY],
  );

  // fill = lift + EXTRA so white paint tracks the animated keyboard gap
  const animatedFillHeight = Animated.add(
    keyboardLift,
    KEYBOARD_FILL_EXTRA,
  );

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[styles.backdropFill, { opacity: backdropOpacity }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={requestClose}
        style={styles.backdropHit}
      />
      {/*
        Native driver owns open/close slide; JS driver owns keyboard lift.
        Keep them on separate nodes so the animations do not conflict.
      */}
      <Animated.View
        style={[
          styles.sheetColumn,
          { transform: [{ translateY: sheetTranslateY }] },
        ]}>
        <Animated.View style={{ marginBottom: keyboardLift }}>
          <View
            style={[
              styles.sheet,
              {
                paddingBottom: keyboardOpen
                  ? 16
                  : Math.max(insets.bottom, 16),
              },
              sheetStyle,
            ]}>
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="시트 닫기 핸들"
              accessibilityHint="아래로 끌어서 닫아요"
              style={styles.dismissBand}
              {...dismissPan.panHandlers}>
              <View style={styles.grabber} />
            </View>
            {children}
          </View>
          {/*
            White continuation below the rounded panel. Negative margin keeps
            layout height at the sheet while painting into the keyboard lift
            gap / under the keyboard so sides stay white.
          */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.keyboardFill,
              {
                height: animatedFillHeight,
                marginBottom: Animated.multiply(animatedFillHeight, -1),
              },
            ]}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

type BottomSheetModalProps = SheetPanelProps & {
  visible: boolean;
  /** Fires after the close animation finishes (not when reopened mid-close). */
  onDismissed?: () => void;
};

/**
 * Reliable custom bottom sheet for Expo Go.
 * Avoids native formSheet blank-content / zero-height layouts.
 * Backdrop fades; sheet slides — Modal itself has no slide animation.
 */
export function BottomSheetModal({
  visible,
  onClose,
  onDismissed,
  children,
  sheetStyle,
}: BottomSheetModalProps) {
  const [presented, setPresented] = useState(visible);
  const presentedRef = useRef(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const closingRef = useRef(false);
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      presentedRef.current = true;
      setPresented(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SHEET_OFFSCREEN);
      haptics.sheetOpen();
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BACKDROP_OPEN_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: OPEN_MS,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!presentedRef.current) return;

    closingRef.current = true;
    animateSheetClosed(backdropOpacity, sheetTranslateY, () => {
      if (!closingRef.current) return;
      presentedRef.current = false;
      setPresented(false);
      onDismissedRef.current?.();
    });
  }, [visible, backdropOpacity, sheetTranslateY]);

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <SheetPanel
        onClose={onClose}
        sheetStyle={sheetStyle}
        animateOnMount={false}
        backdropOpacity={backdropOpacity}
        sheetTranslateY={sheetTranslateY}>
        {children}
      </SheetPanel>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  backdropHit: {
    ...StyleSheet.absoluteFill,
  },
  sheetColumn: {
    width: '100%',
    maxHeight: '92%',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.chip + 8,
    borderTopRightRadius: radii.chip + 8,
    paddingTop: 0,
    overflow: 'hidden',
  },
  keyboardFill: {
    backgroundColor: colors.white,
  },
  /** ~52pt top band — drag anywhere here to dismiss, not only the 5pt pill. */
  dismissBand: {
    height: DISMISS_BAND_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mutedLight,
  },
});
