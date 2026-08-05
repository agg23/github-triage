import { TriangleDownIcon } from "@primer/octicons-react";
import { Button, SelectPanel, type SelectPanelItemInput } from "@primer/react";
import { useMemo, useState } from "react";
import styles from "./Filters.module.scss";

interface FilterSelectPanelProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export const FilterSelectPanel: React.FC<FilterSelectPanelProps> = ({
  label,
  value,
  options,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const allItems = useMemo<SelectPanelItemInput[]>(
    () => options.map((option) => ({ text: option, id: option })),
    [options],
  );
  const items = useMemo(() => {
    const needle = filter.trim().toLowerCase();

    if (!needle) {
      return allItems;
    }

    return allItems.filter((item) => item.text?.toLowerCase().includes(needle));
  }, [allItems, filter]);

  const selected = allItems.find((item) => item.text === value);

  return (
    <SelectPanel
      title={`Filter by ${label.toLowerCase()}`}
      renderAnchor={({ children: _children, ...anchorProps }) => (
        <Button
          {...anchorProps}
          variant="invisible"
          size="small"
          className={value ? `${styles.button} ${styles.buttonActive}` : styles.button}
          trailingAction={TriangleDownIcon}
        >
          {label}
        </Button>
      )}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          setFilter("");
        }
      }}
      items={items}
      selected={selected}
      onSelectedChange={(item: SelectPanelItemInput | undefined) => onChange(item?.text ?? "")}
      filterValue={filter}
      onFilterChange={setFilter}
      placeholder={`Filter ${label.toLowerCase()}…`}
      overlayProps={{ width: "small", height: "medium" }}
    />
  );
};
