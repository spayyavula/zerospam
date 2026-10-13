import { createNavigationContainerRef } from '@react-navigation/native';
import type { AppStackParamList } from './types';

/** For navigating from outside React components (notification taps). */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
