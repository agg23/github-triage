import { CommentIcon, FileDiffIcon, RepoPushIcon } from "@primer/octicons-react";
import { Label, type LabelProps, Overlay, RelativeTime, Spinner } from "@primer/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DetailComment, ItemDetail } from "../../shared/types";
import { api } from "../api";
import { useItemHighlight } from "../itemHighlight";
import { classify } from "../triage";
import type { TriageItem } from "../types";
import styles from "./ItemPreview.module.scss";
import { ActorLink, StateIcon, stateTitleOf } from "./ItemRow";
import rowStyles from "./ItemRow.module.scss";

const OPEN_DELAY_MS = 50;
const CLOSE_DELAY_MS = 200;

// Mirrors Primer's Overlay width="xlarge", which we need to keep the card on screen
const CARD_WIDTH = 640;
const MAX_HEIGHT_RATIO = 0.8;
const ANCHOR_GAP = 8;
const VIEWPORT_MARGIN = 12;
const MIN_ROOM_BELOW = 280;

const PREVIEW_COMMENTS = 3;

interface Loaded {
  detail?: ItemDetail;
  error?: string;
}

const cache = new Map<string, Loaded>();
const inFlight = new Map<string, Promise<Loaded>>();

const fetchDetail = (id: string): Promise<Loaded> => {
  const existing = inFlight.get(id);

  if (existing) {
    return existing;
  }

  const promise = api
    .itemDetail(id)
    .then((detail) => ({ detail }))
    .catch((caught) => ({ error: caught instanceof Error ? caught.message : String(caught) }))
    .then((loaded) => {
      cache.set(id, loaded);
      inFlight.delete(id);

      return loaded;
    });

  inFlight.set(id, promise);

  return promise;
};

const useDetail = (id: string, wanted: boolean): Loaded | undefined => {
  const [loaded, setLoaded] = useState(() => cache.get(id));

  useEffect(() => {
    if (!wanted || loaded) {
      return;
    }

    let cancelled = false;
    void fetchDetail(id).then((result) => {
      if (!cancelled) {
        setLoaded(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, wanted, loaded]);

  return loaded;
};

interface Placement {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const placementFor = (anchor: HTMLElement): Placement => {
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left, window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN),
  );
  const cap = window.innerHeight * MAX_HEIGHT_RATIO;
  const below = window.innerHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
  const above = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;

  if (below < MIN_ROOM_BELOW && above > below) {
    return {
      left,
      bottom: window.innerHeight - rect.top + ANCHOR_GAP,
      maxHeight: Math.min(cap, above),
    };
  }

  return { left, top: rect.bottom + ANCHOR_GAP, maxHeight: Math.min(cap, below) };
};

const withoutImages = (html: string): string => {
  const parsed = document.createElement("template");
  parsed.innerHTML = html;

  for (const image of parsed.content.querySelectorAll("img")) {
    const marker = document.createElement("span");
    marker.className = styles.imageMarker;
    marker.textContent = image.getAttribute("alt") || "image";
    image.replaceWith(marker);
  }

  return parsed.innerHTML;
};

interface ExcerptProps {
  html: string;
  /** Overrides the line clamp */
  className?: string;
}

const Excerpt: React.FC<ExcerptProps> = ({ html, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const rendered = useMemo(() => withoutImages(html), [html]);

  useLayoutEffect(() => {
    const node = ref.current;

    if (node) {
      setClipped(node.scrollHeight > node.clientHeight + 1);
    }
  }, [rendered]);

  return (
    <>
      <div
        ref={ref}
        className={`markdown-body ${styles.excerpt} ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
      {clipped && <div className={styles.more}>…</div>}
    </>
  );
};

interface ReviewBadge {
  variant: LabelProps["variant"];
  text: string;
}

const REVIEW_STATES: Record<string, ReviewBadge> = {
  APPROVED: { variant: "success", text: "approved" },
  CHANGES_REQUESTED: { variant: "danger", text: "changes requested" },
  DISMISSED: { variant: "secondary", text: "dismissed" },
  COMMENTED: { variant: "secondary", text: "reviewed" },
};

interface CommentExcerptProps {
  comment: DetailComment;
}

const CommentExcerpt: React.FC<CommentExcerptProps> = ({ comment }) => {
  const isReview = comment.reviewState !== undefined;
  const badge = comment.reviewState ? REVIEW_STATES[comment.reviewState] : undefined;

  return (
    <div className={styles.comment}>
      <div className={`${rowStyles.meta} ${styles.commentMeta}`}>
        {isReview ? <FileDiffIcon size={12} /> : <CommentIcon size={12} />}
        <ActorLink
          login={comment.author}
          actorClass={classify(comment.author, comment.authorType)}
        />
        {badge && (
          <Label size="small" variant={badge.variant}>
            {badge.text}
          </Label>
        )}
        <RelativeTime datetime={comment.createdAt} />
        {comment.fileComments !== undefined && comment.fileComments > 0 && (
          <>
            <span className={rowStyles.metaSep}>·</span>
            <span>
              {comment.fileComments} file {comment.fileComments === 1 ? "comment" : "comments"}
            </span>
          </>
        )}
      </div>
      {/* An approval with no content should be shown, but has no body to display */}
      {comment.bodyHTML && <Excerpt html={comment.bodyHTML} />}
    </div>
  );
};

interface PushExcerptProps {
  item: TriageItem;
}

const PushExcerpt: React.FC<PushExcerptProps> = ({ item }) => (
  <div className={styles.comment}>
    <div className={`${rowStyles.meta} ${styles.commentMeta}`}>
      <RepoPushIcon size={12} />
      <ActorLink login={item.lastActor} actorClass={item.lastActorClass} />
      <span>pushed</span>
      <RelativeTime datetime={item.lastActivityAt} />
    </div>
  </div>
);

interface DiffStatProps {
  detail: ItemDetail;
}

const DiffStat: React.FC<DiffStatProps> = ({ detail }) => {
  const { additions, deletions, changedFiles } = detail;

  if (typeof additions !== "number") {
    return null;
  }

  return (
    <>
      <span className={rowStyles.metaSep}>·</span>
      <span>
        {changedFiles} {changedFiles === 1 ? "file" : "files"}
      </span>
      <span className={styles.added}>+{additions.toLocaleString()}</span>
      <span className={styles.removed}>−{(deletions ?? 0).toLocaleString()}</span>
    </>
  );
};

interface CardBodyProps {
  item: TriageItem;
  loaded: Loaded | undefined;
}

const CardBody: React.FC<CardBodyProps> = ({ item, loaded }) => {
  if (!loaded) {
    return (
      <div className={styles.center}>
        <Spinner size="small" />
      </div>
    );
  }

  if (!loaded.detail) {
    return (
      <p className={styles.empty}>Not cached yet. Content arrives the next time this item syncs.</p>
    );
  }

  const { bodyHTML, comments, commentCount } = loaded.detail;
  const human = comments.filter(
    (comment) => classify(comment.author, comment.authorType) !== "bot",
  );
  const shown = human.slice(-PREVIEW_COMMENTS);
  const pushed = item.lastActionKind === "pushed";

  return (
    <>
      {bodyHTML ? (
        <Excerpt html={bodyHTML} className={styles.body} />
      ) : (
        <p className={styles.empty}>No description</p>
      )}
      {commentCount > 0 && (
        <div className={styles.comments}>
          <div className={styles.commentsHead}>
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
            {/* The count is every comment, but bots and the cache limit what we can show */}
            {shown.length > 0 && shown.length < commentCount && ` · last ${shown.length}`}
          </div>
          {shown.map((comment) => (
            <CommentExcerpt key={`${comment.author}-${comment.createdAt}`} comment={comment} />
          ))}
          {pushed && <PushExcerpt item={item} />}
        </div>
      )}
    </>
  );
};

let showing: React.Dispatch<React.SetStateAction<boolean>> | undefined;

interface ItemPreviewProps {
  item: TriageItem;
  className?: string;
  children: React.ReactNode;
}

export const ItemPreview: React.FC<ItemPreviewProps> = ({ item, className, children }) => {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const noReturnFocusRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | undefined>(undefined);
  const [overflowed, setOverflowed] = useState(false);
  const { markOpened } = useItemHighlight();
  const loaded = useDetail(item.id, open);

  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      if (next) {
        if (showing && showing !== setOpen) {
          showing(false);
        }

        showing = setOpen;
      } else if (showing === setOpen) {
        showing = undefined;
      }

      setOpen(next);
    }, delay);
  };

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);

      if (showing === setOpen) {
        showing = undefined;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const node = contentRef.current;

    setOverflowed(node !== null && node.scrollHeight > node.clientHeight + 1);
  }, [loaded, placement]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const reposition = () => {
      if (anchorRef.current) {
        setPlacement(placementFor(anchorRef.current));
      }
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  return (
    <>
      <a
        ref={anchorRef}
        className={className}
        href={item.lastCommentUrl ?? item.url}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={() => schedule(true, OPEN_DELAY_MS)}
        onMouseLeave={() => schedule(false, CLOSE_DELAY_MS)}
        onFocus={(event) => event.target.matches(":focus-visible") && schedule(true, 0)}
        onBlur={() => schedule(false, 0)}
        onClick={() => markOpened(item.id)}
      >
        {children}
      </a>

      {open && placement && (
        <Overlay
          role="dialog"
          aria-label={`Preview of ${item.title}`}
          className={styles.card}
          width="xlarge"
          position="fixed"
          top={placement.top}
          bottom={placement.bottom}
          left={placement.left}
          style={{ maxHeight: placement.maxHeight }}
          preventFocusOnOpen
          returnFocusRef={noReturnFocusRef}
          onEscape={() => setOpen(false)}
          onClickOutside={() => setOpen(false)}
        >
          <div className={styles.head}>
            <div className={rowStyles.state} title={stateTitleOf(item)}>
              <StateIcon item={item} />
            </div>
            <div className={rowStyles.main}>
              <div className={rowStyles.titleLine}>
                <a
                  className={rowStyles.title}
                  href={item.lastCommentUrl ?? item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markOpened(item.id)}
                >
                  {item.title}
                </a>
              </div>
              <div className={rowStyles.meta}>
                <span>
                  {item.repo} #{item.number}
                </span>
                <span className={rowStyles.metaSep}>·</span>
                <ActorLink login={item.author} actorClass={item.authorClass} />
                <span>
                  opened <RelativeTime datetime={item.createdAt} />
                </span>
                {loaded?.detail && <DiffStat detail={loaded.detail} />}
              </div>
            </div>
          </div>

          <div ref={contentRef} className={styles.content}>
            <CardBody item={item} loaded={loaded} />
          </div>
          {overflowed && <div className={styles.footer}>…</div>}
        </Overlay>
      )}
    </>
  );
};
