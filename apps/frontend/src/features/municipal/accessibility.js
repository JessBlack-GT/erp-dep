import { Platform } from 'react-native';

// React Native Android 0.72 throws for web-only accessibility roles such as `main` and `listitem`.
// Omit the role on native so the child controls retain their own supported roles and labels.
export const webAccessibilityRole = (role) => (Platform.OS === 'web' ? role : undefined);
