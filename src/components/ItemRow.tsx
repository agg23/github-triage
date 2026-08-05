import {
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  IssueClosedIcon,
  IssueOpenedIcon,
} from "@primer/octicons-react";
import { Button, IssueLabelToken, Label, type LabelProps, RelativeTime } from "@primer/react";
import type { ItemState } from "../../shared/types";
import type { ActorClass, ForMeReason, SnoozeChoice, TriageItem } from "../types";
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

const MAX_LABELS = 8;

interface StateIconProps {
  item: TriageItem;
}

const StateIcon: React.FC<StateIconProps> = ({ item }) => {
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

const stateTitleOf = (item: TriageItem): string => {
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

const ActorLink: React.FC<ActorLinkProps> = ({ login, actorClass }) => (
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
}

export const ItemRow: React.FC<ItemRowProps> = ({ item, showRepo, onSnooze, onWake }) => {
  const openerIsLast =
    item.lastActionKind === "opened" ||
    (item.lastActor === item.author && item.lastActivityAt === item.createdAt);
  const lastVerb = item.lastActionKind ?? "responded";

  return (
    <div className={item.mutedBy === undefined ? styles.item : `${styles.item} ${styles.muted}`}>
      <div className={styles.state} title={stateTitleOf(item)}>
        <StateIcon item={item} />
      </div>

      <div className={styles.main}>
        <div className={styles.titleLine}>
          <a className={styles.title} href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
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
          <span>#{item.number}</span>
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

      {onSnooze && !item.snooze && (
        <div className={styles.actions}>
          <SnoozeActions onSnooze={(choice) => onSnooze(item, choice)} />
        </div>
      )}
      {onWake && item.snooze && (
        <div className={`${styles.actions} ${styles.actionsVisible}`}>
          <Button size="small" onClick={() => onWake(item)}>
            Wake
          </Button>
        </div>
      )}
    </div>
  );
};
