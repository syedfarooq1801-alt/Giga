declare module 'expo-status-bar' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  export interface StatusBarProps extends ViewProps {
    style?: 'auto' | 'inverted' | 'light' | 'dark';
    hidden?: boolean;
    backgroundColor?: string;
    translucent?: boolean;
  }

  export class StatusBar extends Component<StatusBarProps> {}
} 