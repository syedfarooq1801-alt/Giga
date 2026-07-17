import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
