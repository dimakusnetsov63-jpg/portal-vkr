"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MANAGERS, COORDINATORS } from "@/lib/portal/constants";
import { generateCandidates } from "@/lib/portal/generateCandidates";
import { INITIAL_NOTIFICATIONS } from "@/lib/portal/notifications";
import { pick } from "@/lib/portal/random";
import { createRng } from "@/lib/portal/random";
import type {
  Candidate,
  NewCandidateInput,
  PortalNotification,
  PortalPage,
  Toast,
  ToastType,
} from "@/lib/portal/types";

const staffRng = createRng(20260722);

interface PortalContextValue {
  activePage: PortalPage;
  goto: (page: PortalPage) => void;

  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  candidates: Candidate[];
  addCandidate: (input: NewCandidateInput) => void;
  addComment: (candidateId: string, text: string) => void;

  selectedCandidateId: string | null;
  openCandidateDrawer: (id: string) => void;
  closeCandidateDrawer: () => void;

  notifications: PortalNotification[];
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;

  toasts: Toast[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;

  densityCompact: boolean;
  toggleDensity: () => void;

  contextAction: ContextAction | null;
  setContextAction: (action: ContextAction | null) => void;
}

export interface ContextAction {
  label: string;
  onClick: () => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<PortalPage>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>(() => generateCandidates());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PortalNotification[]>(INITIAL_NOTIFICATIONS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [densityCompact, setDensityCompact] = useState(false);
  const [contextAction, setContextAction] = useState<ContextAction | null>(null);
  const toastSeq = useRef(0);
  const candidateSeq = useRef(0);

  const goto = useCallback((page: PortalPage) => {
    setActivePage(page);
    setMobileSidebarOpen(false);
    setContextAction(null);
  }, []);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const pushToast = useCallback((message: string, type: ToastType = "success") => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addCandidate = useCallback(
    (input: NewCandidateInput) => {
      candidateSeq.current += 1;
      const now = new Date();
      const newCandidate: Candidate = {
        id: `KND-${4000 + candidateSeq.current}`,
        fio: input.fio,
        project: input.project,
        city: input.city,
        stage: input.stage,
        recruiter: input.recruiter,
        manager: pick(staffRng, MANAGERS),
        coordinator: pick(staffRng, COORDINATORS),
        responseAt: now,
        invitedAt: null,
        interviewAt: null,
        processedAt: null,
        firstShiftAt: null,
        comments: [],
      };
      setCandidates((prev) => [newCandidate, ...prev]);
      pushToast("Кандидат добавлен в реестр");
    },
    [pushToast],
  );

  const addComment = useCallback((candidateId: string, text: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, comments: [...c.comments, { who: "Дмитрий Кузнецов", at: new Date(), text }] }
          : c,
      ),
    );
  }, []);

  const openCandidateDrawer = useCallback((id: string) => setSelectedCandidateId(id), []);
  const closeCandidateDrawer = useCallback(() => setSelectedCandidateId(null), []);

  const markNotificationRead = useCallback((id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    pushToast("Все уведомления отмечены прочитанными");
  }, [pushToast]);

  const toggleDensity = useCallback(() => setDensityCompact((v) => !v), []);

  useEffect(() => {
    document.body.classList.toggle("density-compact", densityCompact);
  }, [densityCompact]);

  const value = useMemo<PortalContextValue>(
    () => ({
      activePage,
      goto,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      candidates,
      addCandidate,
      addComment,
      selectedCandidateId,
      openCandidateDrawer,
      closeCandidateDrawer,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      toasts,
      pushToast,
      dismissToast,
      densityCompact,
      toggleDensity,
      contextAction,
      setContextAction,
    }),
    [
      activePage,
      goto,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      candidates,
      addCandidate,
      addComment,
      selectedCandidateId,
      openCandidateDrawer,
      closeCandidateDrawer,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      toasts,
      pushToast,
      dismissToast,
      densityCompact,
      toggleDensity,
      contextAction,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}
