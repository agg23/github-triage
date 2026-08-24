import { createContext, useContext, useMemo, useState } from "react";

/** Transient highlight state shared by every item row */
interface ItemHighlight {
  lastOpenedId: string | undefined;
  markOpened: (id: string) => void;
  /** The stack whose chip is under the cursor, as `repo#stackNumber` */
  hoveredStack: string | undefined;
  setHoveredStack: (key: string | undefined) => void;
}

const ItemHighlightContext = createContext<ItemHighlight>({
  lastOpenedId: undefined,
  markOpened: () => {},
  hoveredStack: undefined,
  setHoveredStack: () => {},
});

export const ItemHighlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastOpenedId, markOpened] = useState<string | undefined>(undefined);
  const [hoveredStack, setHoveredStack] = useState<string | undefined>(undefined);
  const value = useMemo(
    () => ({ lastOpenedId, markOpened, hoveredStack, setHoveredStack }),
    [lastOpenedId, hoveredStack],
  );

  return <ItemHighlightContext.Provider value={value}>{children}</ItemHighlightContext.Provider>;
};

export const useItemHighlight = (): ItemHighlight => useContext(ItemHighlightContext);
