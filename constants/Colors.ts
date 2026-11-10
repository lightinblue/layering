/** White-tone minimal palette (세부 색은 피그마 반영 예정). */
const tint = '#2B6CB0';

export default {
  light: {
    text: '#1A1A1A',
    background: '#FFFFFF',
    tint,
    tabIconDefault: '#A0AEC0',
    tabIconSelected: tint,
    muted: '#718096',
    border: '#E2E8F0',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: '#63B3ED',
    tabIconDefault: '#718096',
    tabIconSelected: '#63B3ED',
    muted: '#A0AEC0',
    border: '#2D3748',
  },
};
