import { ClockIcon, ZapIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, IconButton } from "@primer/react";
import { HOUR_MS } from "../../shared/constants";
import type { SnoozeChoice } from "../types";

const SNOOZE_PRESETS = [
  { label: "2 hours", hours: 2 },
  { label: "8 hours", hours: 8 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
] as const;

interface SnoozeActionsProps {
  onSnooze: (choice: SnoozeChoice) => void;
}

export const SnoozeActions: React.FC<SnoozeActionsProps> = ({ onSnooze }) => {
  const snoozeFor = (hours: number, wakeOnActivity: boolean) =>
    onSnooze({
      wakeAt: new Date(Date.now() + hours * HOUR_MS).toISOString(),
      wakeOnActivity,
    });

  return (
    <>
      <IconButton
        icon={ZapIcon}
        size="small"
        variant="invisible"
        aria-label="Snooze until new human activity"
        onClick={() => onSnooze({ wakeAt: undefined, wakeOnActivity: true })}
      />
      <ActionMenu>
        <ActionMenu.Anchor>
          <IconButton
            icon={ClockIcon}
            size="small"
            variant="invisible"
            aria-label="Snooze for a duration"
          />
        </ActionMenu.Anchor>
        <ActionMenu.Overlay align="end">
          <ActionList>
            <ActionList.Group>
              <ActionList.GroupHeading>Snooze for</ActionList.GroupHeading>
              {SNOOZE_PRESETS.map((preset) => (
                <ActionList.Item key={preset.label} onSelect={() => snoozeFor(preset.hours, false)}>
                  {preset.label}
                </ActionList.Item>
              ))}
            </ActionList.Group>
            <ActionList.Divider />
            <ActionList.Group>
              <ActionList.GroupHeading>Unless activity, for</ActionList.GroupHeading>
              {SNOOZE_PRESETS.map((preset) => (
                <ActionList.Item key={preset.label} onSelect={() => snoozeFor(preset.hours, true)}>
                  {preset.label}
                </ActionList.Item>
              ))}
            </ActionList.Group>
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>
    </>
  );
};
