declare module 'react' {
  import * as React from '@types/react';

  export type FC<P = {}> = React.FC<P>;
  export type ReactNode = React.ReactNode;
  export type RefObject<T> = React.RefObject<T>;

  export const createContext: typeof React.createContext;
  export const useContext: typeof React.useContext;
  export const useState: typeof React.useState;
  export const useEffect: typeof React.useEffect;
  export const useRef: typeof React.useRef;

  export * from '@types/react';
} 