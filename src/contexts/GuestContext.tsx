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
  /** Leaves guest mode. By default (after a successful migration into a
   * real account) it also wipes the local guest data; pass
   * { keepData: true } when the user is just heading to the login screen,
   * so backing out doesn't destroy chats they haven't migrated yet. */
  exitGuestMode: (options?: { keepData?: boolean }) => Promise<void>;
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

  const exitGuestMode = useCallback(async (options?: { keepData?: boolean }) => {
    if (options?.keepData) {
      // Only drop the "I'm in guest mode" flag -- the id and the stored
      // conversations stay, so signing in can still migrate them (and
      // coming back to guest mode finds them intact).
      await setGuestModeEnabled(false);
    } else {
      await clearGuestData();
      setGuestId(null);
    }
    setIsGuest(false);
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, guestId, loading, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
};
