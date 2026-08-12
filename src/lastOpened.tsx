import { createContext, useContext, useMemo, useState } from "react";

interface LastOpened {
  lastOpenedId: string | undefined;
  markOpened: (id: string) => void;
}

const LastOpenedContext = createContext<LastOpened>({
  lastOpenedId: undefined,
  markOpened: () => {},
});

export const LastOpenedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastOpenedId, markOpened] = useState<string | undefined>(undefined);
  const value = useMemo(() => ({ lastOpenedId, markOpened }), [lastOpenedId]);

  return <LastOpenedContext.Provider value={value}>{children}</LastOpenedContext.Provider>;
};

export const useLastOpened = (): LastOpened => useContext(LastOpenedContext);
