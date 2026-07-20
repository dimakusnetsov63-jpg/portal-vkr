export type StageId =
  | "response"
  | "invited"
  | "interview"
  | "processing"
  | "confirmed"
  | "first_shift"
  | "rejected"
  | "no_show";

export type BadgeColor =
  | "blue"
  | "amber"
  | "violet"
  | "teal"
  | "green"
  | "red"
  | "gray";

export interface Stage {
  id: StageId;
  name: string;
  color: BadgeColor;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  cities: string[];
}

export interface Comment {
  who: string;
  at: Date;
  text: string;
}

export interface NewCandidateInput {
  fio: string;
  project: string;
  city: string;
  stage: StageId;
  recruiter: string;
}

export interface Candidate {
  id: string;
  fio: string;
  project: string;
  city: string;
  stage: StageId;
  recruiter: string;
  manager: string;
  coordinator: string;
  responseAt: Date;
  invitedAt: Date | null;
  interviewAt: Date | null;
  processedAt: Date | null;
  firstShiftAt: Date | null;
  comments: Comment[];
}

export type DemandLevel = "zero" | "normal" | "elevated" | "critical";

export interface DemandDay {
  date: Date;
  need: number;
  level: DemandLevel;
}

export type DemandMatrix = Record<string, Record<string, DemandDay[]>>;

export interface Channel {
  name: string;
  budget: number;
  responses: number;
  invites: number;
  processed: number;
  shifts: number;
}

export type NotificationType = "critical" | "important" | "info";

export interface PortalNotification {
  id: number;
  type: NotificationType;
  title: string;
  text: string;
  project: string;
  minsAgo: number;
  read: boolean;
}

export type PortalPage =
  | "overview"
  | "demand"
  | "candidates"
  | "marketing"
  | "analytics"
  | "notifications"
  | "settings";

export type DemoState = "normal" | "loading" | "empty" | "error";

export type ToastType = "success" | "error";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}
