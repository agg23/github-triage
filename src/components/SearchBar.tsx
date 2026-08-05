import { SearchIcon, StarFillIcon, XIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, TextInput } from "@primer/react";
import { useMemo } from "react";
import { serializeRules } from "../../shared/query";
import type { View } from "../../shared/types";
import type { Filters } from "../types";
import styles from "./Filters.module.scss";

interface SearchBarProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  views: View[];
}

export const SearchBar: React.FC<SearchBarProps> = ({ filters, setFilters, views }) => {
  const { query } = filters;
  const setQuery = (next: string) => setFilters({ ...filters, query: next });

  const activeName = useMemo(() => {
    if (query.trim() === "") {
      return "Full";
    }

    return views.find((view) => serializeRules(view.rules) === query)?.name ?? "Custom";
  }, [query, views]);

  return (
    <div className={styles.row}>
      {views.length > 0 && (
        <ActionMenu>
          <ActionMenu.Button size="small">View: {activeName}</ActionMenu.Button>
          <ActionMenu.Overlay>
            <ActionList selectionVariant="single">
              <ActionList.Item selected={activeName === "Full"} onSelect={() => setQuery("")}>
                Full
                <ActionList.Description variant="block">
                  Everything, unfiltered
                </ActionList.Description>
              </ActionList.Item>
              {views.map((view) => (
                <ActionList.Item
                  key={view.id}
                  selected={activeName === view.name}
                  onSelect={() => setQuery(serializeRules(view.rules))}
                >
                  {view.name}
                  {view.isDefault && (
                    <ActionList.TrailingVisual>
                      <StarFillIcon />
                    </ActionList.TrailingVisual>
                  )}
                </ActionList.Item>
              ))}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      )}

      <TextInput
        className={styles.search}
        leadingVisual={SearchIcon}
        placeholder="Search all triage"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        trailingAction={
          <TextInput.Action
            icon={XIcon}
            aria-label="Clear search"
            style={{ visibility: query ? "visible" : "hidden" }}
            onClick={() => setQuery("")}
          />
        }
      />
    </div>
  );
};
