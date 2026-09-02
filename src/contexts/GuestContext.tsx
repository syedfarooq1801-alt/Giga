import React, { createContext, useContext, useState, useEffect, FC, ReactNode, useCallback } from 'react';
import {
  isGuestModeEnabled,
  setGuestModeEnabled,
  getOrCreateGuestId,
  clearGuestData,
} from '../services/guestSession';

interface GuestContextType {
  isGuest: boolean;
  guestId: string | null;
  /** True until the initial AsyncStorage read completes -- Navigation
   * waits on this the same way it already waits on Firebase auth's own
   * loading flag, so a returning guest doesn't get bounced to the Auth
   * screen for one frame before this resolves. */
  loading: boolean;
  enterGuestMode: () => Promise<void>;
  /** Called once a guest's local chats have been migrated into a real
   * account (or the user explicitly discards them) -- clears the guest
   * flag/id and all local conversation data. */
  exitGuestMode: () => Promise<void>;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
};

export const GuestProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const enabled = await isGuestModeEnabled();
      if (enabled) {
        const id = await getOrCreateGuestId();
        setGuestId(id);
        setIsGuest(true);
      }
      setLoading(false);
    })();
  }, []);

  const enterGuestMode = useCallback(async () => {
    const id = await getOrCreateGuestId();
    await setGuestModeEnabled(true);
    setGuestId(id);
    setIsGuest(true);
  }, []);

  const exitGuestMode = useCallback(async () => {
    await clearGuestData();
    setGuestId(null);
    setIsGuest(false);
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, guestId, loading, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
};
