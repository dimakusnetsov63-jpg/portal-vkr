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
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import {
  archiveCandidate,
  createCandidate,
  listCandidates,
  restoreCandidate,
  updateCandidate,
} from "@/lib/supabase/candidatesRepo";
import type {
  Candidate as RealCandidate,
  CandidateInsert,
  CandidateUpdate,
} from "@/lib/supabase/candidates.types";
import {
  createCandidateListOption,
  listCandidateListOptions,
  updateCandidateListOption,
} from "@/lib/supabase/candidateListOptionsRepo";
import type { CandidateListOption, CandidateListType } from "@/lib/supabase/candidateListOptions.types";

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

  authEmail: string | null;
  signOut: () => Promise<void>;

  realCandidates: RealCandidate[];
  realCandidatesLoading: boolean;
  realCandidatesError: string | null;
  refreshRealCandidates: () => Promise<void>;
  addRealCandidate: (input: CandidateInsert) => Promise<boolean>;
  saveRealCandidate: (id: string, patch: CandidateUpdate) => Promise<boolean>;
  archiveRealCandidate: (id: string) => Promise<void>;
  restoreRealCandidate: (id: string) => Promise<void>;

  selectedRealCandidateId: string | null;
  openRealCandidateDrawer: (id: string) => void;
  closeRealCandidateDrawer: () => void;

  listOptions: CandidateListOption[];
  listOptionsLoading: boolean;
  listOptionsError: string | null;
  refreshListOptions: () => Promise<void>;
  addListOption: (listType: CandidateListType, value: string) => Promise<boolean>;
  renameListOption: (id: string, value: string) => Promise<boolean>;
  setListOptionActive: (id: string, active: boolean) => Promise<void>;
  reorderListOption: (id: string, direction: "up" | "down") => Promise<void>;
}

export interface ContextAction {
  label: string;
  onClick: () => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({
  children,
  initialUserEmail,
}: {
  children: ReactNode;
  initialUserEmail: string | null;
}) {
  const router = useRouter();
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

  const [authEmail] = useState<string | null>(initialUserEmail);

  const [realCandidates, setRealCandidates] = useState<RealCandidate[]>([]);
  const [realCandidatesLoading, setRealCandidatesLoading] = useState(true);
  const [realCandidatesError, setRealCandidatesError] = useState<string | null>(null);
  const [selectedRealCandidateId, setSelectedRealCandidateId] = useState<string | null>(null);

  const [listOptions, setListOptions] = useState<CandidateListOption[]>([]);
  const [listOptionsLoading, setListOptionsLoading] = useState(true);
  const [listOptionsError, setListOptionsError] = useState<string | null>(null);

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

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }, [router]);

  const refreshRealCandidates = useCallback(async () => {
    setRealCandidatesLoading(true);
    setRealCandidatesError(null);
    try {
      setRealCandidates(await listCandidates());
    } catch (e) {
      setRealCandidatesError(e instanceof Error ? e.message : "Не удалось загрузить кандидатов");
    } finally {
      setRealCandidatesLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshRealCandidates();
  }, [refreshRealCandidates]);

  const addRealCandidate = useCallback(
    async (input: CandidateInsert) => {
      try {
        const created = await createCandidate(input);
        setRealCandidates((prev) => [created, ...prev]);
        pushToast("Кандидат добавлен");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось добавить кандидата", "error");
        return false;
      }
    },
    [pushToast],
  );

  const saveRealCandidate = useCallback(
    async (id: string, patch: CandidateUpdate) => {
      try {
        const updated = await updateCandidate(id, patch);
        setRealCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)));
        pushToast("Изменения сохранены");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось сохранить изменения", "error");
        return false;
      }
    },
    [pushToast],
  );

  const archiveRealCandidate = useCallback(
    async (id: string) => {
      try {
        const updated = await archiveCandidate(id);
        setRealCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)));
        pushToast("Кандидат отмечен как вышедший");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось архивировать кандидата", "error");
      }
    },
    [pushToast],
  );

  const restoreRealCandidate = useCallback(
    async (id: string) => {
      try {
        const updated = await restoreCandidate(id);
        setRealCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)));
        pushToast("Кандидат восстановлен из архива");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось восстановить кандидата", "error");
      }
    },
    [pushToast],
  );

  const openRealCandidateDrawer = useCallback((id: string) => setSelectedRealCandidateId(id), []);
  const closeRealCandidateDrawer = useCallback(() => setSelectedRealCandidateId(null), []);

  const refreshListOptions = useCallback(async () => {
    setListOptionsLoading(true);
    setListOptionsError(null);
    try {
      setListOptions(await listCandidateListOptions());
    } catch (e) {
      setListOptionsError(e instanceof Error ? e.message : "Не удалось загрузить списки");
    } finally {
      setListOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshListOptions();
  }, [refreshListOptions]);

  const addListOption = useCallback(
    async (listType: CandidateListType, value: string) => {
      const trimmed = value.trim();
      const existing = listOptions.find((o) => o.list_type === listType && o.value === trimmed);
      if (existing) {
        if (existing.is_active) {
          pushToast("Такое значение уже есть в списке", "error");
          return false;
        }
        // Re-adding a previously deactivated value reactivates it instead of
        // inserting a duplicate (list_type, value) is unique in the DB).
        try {
          const updated = await updateCandidateListOption(existing.id, { is_active: true });
          setListOptions((prev) => prev.map((o) => (o.id === existing.id ? updated : o)));
          pushToast("Значение восстановлено");
          return true;
        } catch (e) {
          pushToast(e instanceof Error ? e.message : "Не удалось восстановить значение", "error");
          return false;
        }
      }
      try {
        const siblingOrders = listOptions.filter((o) => o.list_type === listType).map((o) => o.sort_order);
        const nextOrder = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0;
        const created = await createCandidateListOption(listType, trimmed, nextOrder);
        setListOptions((prev) => [...prev, created]);
        pushToast("Значение добавлено");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось добавить значение", "error");
        return false;
      }
    },
    [listOptions, pushToast],
  );

  const renameListOption = useCallback(
    async (id: string, value: string) => {
      try {
        const updated = await updateCandidateListOption(id, { value });
        setListOptions((prev) => prev.map((o) => (o.id === id ? updated : o)));
        pushToast("Значение обновлено");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось обновить значение", "error");
        return false;
      }
    },
    [pushToast],
  );

  const setListOptionActive = useCallback(
    async (id: string, active: boolean) => {
      try {
        const updated = await updateCandidateListOption(id, { is_active: active });
        setListOptions((prev) => prev.map((o) => (o.id === id ? updated : o)));
        pushToast(active ? "Значение снова активно" : "Значение деактивировано");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось изменить значение", "error");
      }
    },
    [pushToast],
  );

  const reorderListOption = useCallback(
    async (id: string, direction: "up" | "down") => {
      const current = listOptions.find((o) => o.id === id);
      if (!current) return;
      const siblings = listOptions
        .filter((o) => o.list_type === current.list_type)
        .sort((a, b) => a.sort_order - b.sort_order);
      const idx = siblings.findIndex((o) => o.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return;
      const other = siblings[swapIdx];
      try {
        const [updatedCurrent, updatedOther] = await Promise.all([
          updateCandidateListOption(current.id, { sort_order: other.sort_order }),
          updateCandidateListOption(other.id, { sort_order: current.sort_order }),
        ]);
        setListOptions((prev) =>
          prev.map((o) => {
            if (o.id === updatedCurrent.id) return updatedCurrent;
            if (o.id === updatedOther.id) return updatedOther;
            return o;
          }),
        );
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось изменить порядок", "error");
      }
    },
    [listOptions, pushToast],
  );

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
      authEmail,
      signOut,
      realCandidates,
      realCandidatesLoading,
      realCandidatesError,
      refreshRealCandidates,
      addRealCandidate,
      saveRealCandidate,
      archiveRealCandidate,
      restoreRealCandidate,
      selectedRealCandidateId,
      openRealCandidateDrawer,
      closeRealCandidateDrawer,
      listOptions,
      listOptionsLoading,
      listOptionsError,
      refreshListOptions,
      addListOption,
      renameListOption,
      setListOptionActive,
      reorderListOption,
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
      authEmail,
      signOut,
      realCandidates,
      realCandidatesLoading,
      realCandidatesError,
      refreshRealCandidates,
      addRealCandidate,
      saveRealCandidate,
      archiveRealCandidate,
      restoreRealCandidate,
      selectedRealCandidateId,
      openRealCandidateDrawer,
      closeRealCandidateDrawer,
      listOptions,
      listOptionsLoading,
      listOptionsError,
      refreshListOptions,
      addListOption,
      renameListOption,
      setListOptionActive,
      reorderListOption,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}
