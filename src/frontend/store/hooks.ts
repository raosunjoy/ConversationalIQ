/**
 * Redux Typed Hooks
 * Properly typed versions of useDispatch and useSelector
 */

import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './index';

// Typed version of useDispatch hook
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Typed version of useSelector hook
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;