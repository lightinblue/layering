import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
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

type SheetPanelProps = {
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * Backdrop + white bottom panel. Use as a transparentModal screen root,
 * or wrap with BottomSheetModal for an in-screen RN Modal.
 */
export function SheetPanel({ onClose, children, sheetStyle }: SheetPanelProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={styles.backdrop}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.avoider}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
            sheetStyle,
          ]}>
          <View style={styles.grabberWrap} accessibilityElementsHidden>
            <View style={styles.grabber} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

type BottomSheetModalProps = SheetPanelProps & {
  visible: boolean;
};

/**
 * Reliable custom bottom sheet for Expo Go.
 * Avoids native formSheet blank-content / zero-height layouts.
 */
export function BottomSheetModal({
  visible,
  onClose,
  children,
  sheetStyle,
}: BottomSheetModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <SheetPanel onClose={onClose} sheetStyle={sheetStyle}>
        {children}
      </SheetPanel>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  avoider: {
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
