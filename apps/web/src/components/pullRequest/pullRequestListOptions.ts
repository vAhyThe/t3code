import { currentTranslator } from "~/i18n/I18nProvider";
import type { PullRequestInvolvement, PullRequestListState } from "@t3tools/contracts";
import {
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  ClockIcon,
  EyeIcon,
  LayersIcon,
  ListChecksIcon,
  Maximize2Icon,
  Minimize2Icon,
  PenLineIcon,
  UserLockIcon,
} from "lucide-react";

import type { PullRequestFilterOption } from "./PullRequestListFilters";
import type { PullRequestListSort } from "./pullRequestListPreferences";
import { PullRequestGlyph } from "./pullRequestIcons";

export const INVOLVEMENT_TABS = [
  { value: "all", label: currentTranslator()("pullRequest.filterAll"), Icon: LayersIcon },
  {
    value: "reviewing",
    label: currentTranslator()("pullRequest.involvementReviewing"),
    Icon: EyeIcon,
  },
  {
    value: "authored",
    label: currentTranslator()("pullRequest.involvementAuthored"),
    Icon: PenLineIcon,
  },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestInvolvement>>;

export const STATE_TABS = [
  { value: "all", label: currentTranslator()("pullRequest.filterAll"), Icon: LayersIcon },
  {
    value: "open",
    label: currentTranslator()("chat.openInOpen"),
    Icon: PullRequestGlyph.pullRequest,
  },
  {
    value: "closed",
    label: currentTranslator()("pullRequest.stateClosed"),
    Icon: PullRequestGlyph.closed,
  },
  {
    value: "merged",
    label: currentTranslator()("pullRequest.stateMerged"),
    Icon: PullRequestGlyph.merged,
  },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestListState>>;

export const SORT_OPTIONS = [
  { value: "ready", label: currentTranslator()("pullRequest.sortReadiness"), Icon: ListChecksIcon },
  { value: "blocked", label: currentTranslator()("pullRequest.sortBlocked"), Icon: UserLockIcon },
  { value: "updated", label: currentTranslator()("pullRequest.sortUpdated"), Icon: ClockIcon },
  {
    value: "newest",
    label: currentTranslator()("pullRequest.sortNewest"),
    Icon: CalendarArrowDownIcon,
  },
  {
    value: "oldest",
    label: currentTranslator()("pullRequest.sortOldest"),
    Icon: CalendarArrowUpIcon,
  },
  { value: "largest", label: currentTranslator()("pullRequest.sortLargest"), Icon: Maximize2Icon },
  {
    value: "smallest",
    label: currentTranslator()("pullRequest.sortSmallest"),
    Icon: Minimize2Icon,
  },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestListSort>>;
