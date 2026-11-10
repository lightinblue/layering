import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii } from '@/constants/tokens';

const OPEN_MS = 280;
const CLOSE_MS = 220;
const BACKDROP_OPEN_MS = 240;
const BACKDROP_CLOSE_MS = 200;
const SHEET_OFFSCREEN = 640;
/** Extra white paint below the rounded sheet so keyboard edges stay filled. */
const KEYBOARD_FILL_EXTRA = 48;

type SheetPanelProps = {
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  /** Skip local enter animation when parent (Modal) drives values. */
  animateOnMount?: boolean;
  backdropOpacity?: Animated.Value;
  sheetTranslateY?: Animated.Value;
};

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!animateOnMount || backdropOpacityProp != null) return;
    Animated.parallel([
      Animated.timing(localBackdrop, {
        toValue: 1,
        duration: BACKDROP_OPEN_MS,
        useNativeDriver: true,
      }),
      Animated.timing(localSheet, {
        toValue: 0,
        duration: OPEN_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateOnMount, backdropOpacityProp, localBackdrop, localSheet]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const keyboardOpen = keyboardHeight > 0;
  const fillHeight = keyboardOpen
    ? keyboardHeight + KEYBOARD_FILL_EXTRA
    : KEYBOARD_FILL_EXTRA;

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[styles.backdropFill, { opacity: backdropOpacity }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={styles.backdropHit}
      />
      <Animated.View
        style={[
          styles.sheetColumn,
          {
            transform: [{ translateY: sheetTranslateY }],
            marginBottom: keyboardHeight,
          },
        ]}>
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
          <View style={styles.grabberWrap} accessibilityElementsHidden>
            <View style={styles.grabber} />
          </View>
          {children}
        </View>
        {/*
          White continuation below the rounded panel. Negative margin keeps
          layout height at the sheet while painting into the keyboard lift
          gap / under the keyboard so sides stay white.
        */}
        <View
          pointerEvents="none"
          style={[
            styles.keyboardFill,
            {
              height: fillHeight,
              marginBottom: -fillHeight,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

type BottomSheetModalProps = SheetPanelProps & {
  visible: boolean;
};

/**
 * Reliable custom bottom sheet for Expo Go.
 * Avoids native formSheet blank-content / zero-height layouts.
 * Backdrop fades; sheet slides — Modal itself has no slide animation.
 */
export function BottomSheetModal({
  visible,
  onClose,
  children,
  sheetStyle,
}: BottomSheetModalProps) {
  const [presented, setPresented] = useState(visible);
  const presentedRef = useRef(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      presentedRef.current = true;
      setPresented(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SHEET_OFFSCREEN);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BACKDROP_OPEN_MS,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: OPEN_MS,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!presentedRef.current) return;

    closingRef.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: BACKDROP_CLOSE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_OFFSCREEN,
        duration: CLOSE_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && closingRef.current) {
        presentedRef.current = false;
        setPresented(false);
      }
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
    paddingTop: 8,
    overflow: 'hidden',
  },
  keyboardFill: {
    backgroundColor: colors.white,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mutedLight,
  },
});
