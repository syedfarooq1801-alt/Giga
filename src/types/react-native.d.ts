declare module 'react-native' {
  import * as React from 'react';
  import * as ReactNative from '@types/react-native';

  export interface ViewProps extends ReactNative.ViewProps {}
  export interface TextProps extends ReactNative.TextProps {}
  export interface TouchableOpacityProps extends ReactNative.TouchableOpacityProps {}
  export interface TextInputProps extends ReactNative.TextInputProps {}
  export interface ScrollViewProps extends ReactNative.ScrollViewProps {}
  export interface FlatListProps<T> extends ReactNative.FlatListProps<T> {}
  export interface ModalProps extends ReactNative.ModalProps {}
  export interface KeyboardAvoidingViewProps extends ReactNative.KeyboardAvoidingViewProps {}
  export interface ActivityIndicatorProps extends ReactNative.ActivityIndicatorProps {}
  export interface SwitchProps extends ReactNative.SwitchProps {}

  export const View: React.ComponentType<ViewProps>;
  export const Text: React.ComponentType<TextProps>;
  export const TouchableOpacity: React.ComponentType<TouchableOpacityProps>;
  export const TextInput: React.ComponentType<TextInputProps>;
  export const ScrollView: React.ComponentType<ScrollViewProps>;
  export const FlatList: React.ComponentType<FlatListProps<any>>;
  export const Modal: React.ComponentType<ModalProps>;
  export const KeyboardAvoidingView: React.ComponentType<KeyboardAvoidingViewProps>;
  export const ActivityIndicator: React.ComponentType<ActivityIndicatorProps>;
  export const Switch: React.ComponentType<SwitchProps>;

  export * from '@types/react-native';
} 