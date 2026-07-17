import Toast from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info';

export interface UseToastHook {
  showToast: (type: ToastType, text1: string, text2?: string) => void;
}

export const useToast = (): UseToastHook => {
  const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
    Toast.show({
      type,
      text1,
      text2,
      position: 'bottom',
      visibilityTime: 4000,
      autoHide: true,
    });
  };

  return { showToast };
};
