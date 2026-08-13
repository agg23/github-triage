import {
  FlagIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  IssueClosedIcon,
  IssueOpenedIcon,
} from "@primer/octicons-react";
import {
  Button,
  IconButton,
  IssueLabelToken,
  Label,
  type LabelProps,
  RelativeTime,
} from "@primer/react";
import type { ItemState } from "../../shared/types";
import { useLastOpened } from "../lastOpened";
import type { ActorClass, ForMeReason, SnoozeChoice, TriageItem } from "../types";
import { ItemPreview } from "./ItemPreview";
import { SnoozeActions } from "./SnoozeMenu";
import styles from "./ItemRow.module.scss";

interface ForMeBadge {
  variant: LabelProps["variant"];
  title: string;
}

const FOR_ME_REASONS: Record<ForMeReason, ForMeBadge> = {
  yours: { variant: "accent", title: "You authored this" },
  "review requested": { variant: "attention", title: "Your review is requested" },
  assigned: { variant: "done", title: "Assigned to you" },
  involved: {
    variant: "secondary",
    title: "You've commented or reviewed here, and someone else acted last",
  },
};

const FlagSlashIcon: React.FC = () => (
  <span className={styles.iconStack}>
    <FlagIcon size={16} />
    <svg className={styles.slash} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <line className={styles.slashCasing} x1="2.5" y1="2.5" x2="13.5" y2="13.5" />
      <line className={styles.slashLine} x1="2.5" y1="2.5" x2="13.5" y2="13.5" />
    </svg>
  </span>
);

export const MAX_LABELS = 8;

interface StateIconProps {
  item: TriageItem;
}

export const StateIcon: React.FC<StateIconProps> = ({ item }) => {
  if (item.type === "issue") {
    return item.state === "OPEN" ? (
      <IssueOpenedIcon className={styles.stateOpen} />
    ) : (
      <IssueClosedIcon className={styles.stateDone} />
    );
  }

  if (item.state === "MERGED") {
    return <GitMergeIcon className={styles.stateDone} />;
  }

  if (item.state === "CLOSED") {
    return <GitPullRequestClosedIcon className={styles.stateClosed} />;
  }

  if (item.isDraft) {
    return <GitPullRequestDraftIcon className={styles.stateDraft} />;
  }

  return <GitPullRequestIcon className={styles.stateOpen} />;
};

export const stateTitleOf = (item: TriageItem): string => {
  if (item.type === "issue") {
    return item.state === "OPEN" ? "Open issue" : "Closed issue";
  }

  if (item.state === "MERGED") {
    return "Merged pull request";
  }

  if (item.state === "CLOSED") {
    return "Closed pull request";
  }

  if (item.isDraft) {
    return "Draft pull request";
  }

  return "Open pull request";
};

const wakeTitleOf = (snooze: ItemState): string => {
  if (!snooze.wakeAt) {
    return "wakes on new human activity";
  }

  if (snooze.wakeOnActivityAfter) {
    return `wakes ${snooze.wakeAt}, or earlier on new human activity`;
  }

  return `wakes ${snooze.wakeAt}`;
};

interface SnoozeChipProps {
  snooze: ItemState;
}

const SnoozeChip: React.FC<SnoozeChipProps> = ({ snooze }) => (
  <Label size="small" variant="done" title={wakeTitleOf(snooze)}>
    {snooze.wakeAt ? (
      <>
        wakes&nbsp;
        <RelativeTime datetime={snooze.wakeAt} format="micro" />
        {snooze.wakeOnActivityAfter && " / activity"}
      </>
    ) : (
      "wakes on activity"
    )}
  </Label>
);

interface ActorLinkProps {
  login: string;
  actorClass: ActorClass;
}

export const ActorLink: React.FC<ActorLinkProps> = ({ login, actorClass }) => (
  <>
    <a
      className={styles.user}
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noreferrer"
    >
      {login}
    </a>
    <Label size="small" variant="secondary" title={`${actorClass} contributor`}>
      {actorClass}
    </Label>
  </>
);

interface ItemRowProps {
  item: TriageItem;
  showRepo?: boolean;
  onSnooze?: (item: TriageItem, choice: SnoozeChoice) => void;
  onWake?: (item: TriageItem) => void;
  onFlag?: (item: TriageItem) => void;
  onUnflag?: (item: TriageItem) => void;
}

export const ItemRow: React.FC<ItemRowProps> = ({
  item,
  showRepo,
  onSnooze,
  onWake,
  onFlag,
  onUnflag,
}) => {
  const { lastOpenedId: lastOpened, markOpened } = useLastOpened();
  const openerIsLast =
    item.lastActionKind === "opened" ||
    (item.lastActor === item.author && item.lastActivityAt === item.createdAt);
  const lastVerb = item.lastActionKind ?? "responded";

  const undo = Boolean(onWake && item.snooze);
  const canUnflag = onUnflag && item.flaggedAt;
  const canFlag = onFlag && !item.flaggedAt;
  const canSnooze = onSnooze && !item.snooze;

  const classNames = [styles.item];

  if (item.mutedBy !== undefined) {
    classNames.push(styles.muted);
  }

  if (item.id === lastOpened) {
    classNames.push(styles.lastOpened);
  }

  if (item.forMeReasons.includes("yours")) {
    classNames.push(styles.mine);
  }

  if (item.flaggedAt) {
    classNames.push(styles.flagged);
  }

  return (
    <div className={classNames.join(" ")}>
      <div className={styles.state} title={stateTitleOf(item)}>
        <StateIcon item={item} />
      </div>

      <div className={styles.main}>
        <div className={styles.titleLine}>
          <ItemPreview item={item} className={styles.title}>
            {item.title}
          </ItemPreview>
          {item.labels.slice(0, MAX_LABELS).map((label) => (
            // "medium" (20px) matches Label size="small" so the pills align
            <IssueLabelToken
              key={label.name}
              text={label.name}
              fillColor={`#${label.color}`}
              size="medium"
            />
          ))}
          {item.mutedBy !== undefined && (
            <Label
              size="small"
              variant="secondary"
              title={
                item.mutedBy ? `Dimmed by "mute(${item.mutedBy})"` : "Dimmed by a mute rule"
              }
            >
              muted
            </Label>
          )}
          {item.flaggedAt && (
            <Label size="small" variant="attention" title={`Flagged ${item.flaggedAt}`}>
              flagged
            </Label>
          )}
          {item.snooze && <SnoozeChip snooze={item.snooze} />}
          {item.forMeReasons.map((reason) => (
            <Label
              key={reason}
              size="small"
              variant={FOR_ME_REASONS[reason].variant}
              title={FOR_ME_REASONS[reason].title}
            >
              {reason}
            </Label>
          ))}
          {item.teamReviewed && item.lastActor === item.author && (
            <Label
              size="small"
              variant="severe"
              title="A team member already reviewed this PR and the author has since responded"
            >
              re-review
            </Label>
          )}
        </div>

        <div className={styles.meta}>
          <a
            className={styles.user}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title="Open at top"
            onClick={() => markOpened(item.id)}
          >
            #{item.number}
          </a>
          <span className={styles.metaSep}>·</span>
          <ActorLink login={item.author} actorClass={item.authorClass} />
          <span>
            opened <RelativeTime datetime={item.createdAt} />
          </span>
          {!openerIsLast && (
            <>
              <span className={styles.metaSep}>·</span>
              {item.lastActor !== item.author && (
                <ActorLink login={item.lastActor} actorClass={item.lastActorClass} />
              )}
              <span>
                {lastVerb} <RelativeTime datetime={item.lastActivityAt} />
              </span>
            </>
          )}
          {item.assignees.length > 0 && (
            <>
              <span className={styles.metaSep}>·</span>
              <span title="assignees">assigned to {item.assignees.join(", ")}</span>
            </>
          )}
          {showRepo && <span className={styles.repo}>{item.repo}</span>}
        </div>
      </div>

      {(undo || canUnflag || canFlag || canSnooze) && (
        <div className={undo ? `${styles.actions} ${styles.actionsVisible}` : styles.actions}>
          {canUnflag && (
            <IconButton
              icon={FlagSlashIcon}
              size="small"
              variant="invisible"
              aria-label="Remove flag"
              onClick={() => onUnflag(item)}
            />
          )}
          {onWake && item.snooze && (
            <Button size="small" onClick={() => onWake(item)}>
              Wake
            </Button>
          )}
          {canFlag && (
            <IconButton
              icon={FlagIcon}
              size="small"
              variant="invisible"
              aria-label="Flag as needing your attention"
              onClick={() => onFlag(item)}
            />
          )}
          {canSnooze && <SnoozeActions onSnooze={(choice) => onSnooze(item, choice)} />}
        </div>
      )}
    </div>
  );
};
