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
import { useRouter, useSearchParams } from "next/navigation";
import { NAV_ITEMS } from "@/lib/portal/constants";
import type { PortalPage, Toast, ToastType } from "@/lib/portal/types";
import { clearPortalAccessToken } from "@/lib/supabase/accessToken";
import { canAccess, defaultPageForRole, type PortalPermission } from "@/lib/auth/roles";
import type { PortalUser } from "@/lib/supabase/portalAuth.types";
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
import {
  bulkUpsertStaffingDemand,
  deleteStaffingDemandCell,
  listStaffingDemand,
  upsertStaffingDemandCell,
} from "@/lib/supabase/staffingDemandRepo";
import type { StaffingDemandRow } from "@/lib/supabase/staffingDemand.types";
import { defaultDemandWindow, type DemandWindow } from "@/lib/portal/demandWindow";
import { buildBulkRows } from "@/components/portal/sections/demand/demandAggregate";
import { listStaffingDemandRowsMeta, upsertStaffingDemandRowMeta } from "@/lib/supabase/staffingDemandRowsRepo";
import type { StaffingDemandRowMeta } from "@/lib/supabase/staffingDemandRows.types";
import { demandRowMetaKey, mergeRowMetaPatch, type DemandRowStatus } from "@/components/portal/sections/demand/demandRowMeta";
import {
  archiveAddress,
  createAddress,
  listAddresses,
  restoreAddress,
  updateAddress,
} from "@/lib/supabase/addressesRepo";
import type { AddressInsert, AddressRow, AddressUpdate } from "@/lib/supabase/addresses.types";
import {
  archiveVacancyProject,
  createVacancyProject,
  duplicateVacancyProject,
  listVacancyProjects,
  restoreVacancyProject,
} from "@/lib/supabase/vacancyProjectsRepo";
import type { VacancyProjectListRow } from "@/lib/supabase/vacancyProjects.types";
import {
  createRate,
  deleteRate,
  deleteRateCard,
  findOrCreateRateCard,
  listRateCards,
  listRates,
  updateRate,
  updateRateCard,
} from "@/lib/supabase/ratesRepo";
import type { RateCardRow, RateCardUpdate, RateInsert, RateRow, RateUpdate } from "@/lib/supabase/rates.types";

interface PortalContextValue {
  activePage: PortalPage;
  goto: (page: PortalPage) => void;

  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  toasts: Toast[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;

  densityCompact: boolean;
  toggleDensity: () => void;

  contextAction: ContextAction | null;
  setContextAction: (action: ContextAction | null) => void;

  currentUser: PortalUser;
  /** Есть ли у текущей роли доступ к разделу или праву. Интерфейс прячет, база закрывает. */
  can: (permission: PortalPermission) => boolean;
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

  demandRows: StaffingDemandRow[];
  demandLoading: boolean;
  demandError: string | null;
  demandWindow: DemandWindow;
  setDemandWindow: (window: DemandWindow) => void;
  refreshDemand: () => Promise<void>;
  upsertDemandCell: (
    project: string,
    city: string,
    position: string,
    demandDate: string,
    plannedCount: number,
  ) => Promise<boolean>;
  deleteDemandCell: (project: string, city: string, position: string, demandDate: string) => Promise<boolean>;
  addDemandBulk: (input: {
    project: string;
    cities: string[];
    positions: string[];
    fromDate: string;
    toDate: string;
    plannedCount: number;
  }) => Promise<boolean>;
  bulkSetDemandCells: (
    rows: { project: string; city: string; position: string; demand_date: string; planned_count: number }[],
  ) => Promise<boolean>;

  demandRowMeta: StaffingDemandRowMeta[];
  demandRowMetaLoading: boolean;
  demandRowMetaError: string | null;
  refreshDemandRowMeta: () => Promise<void>;
  updateDemandRowMeta: (
    project: string,
    city: string,
    position: string,
    patch: { status?: DemandRowStatus; comment?: string | null },
  ) => Promise<boolean>;

  addresses: AddressRow[];
  addressesLoading: boolean;
  addressesError: string | null;
  refreshAddresses: () => Promise<void>;
  addAddress: (input: AddressInsert) => Promise<boolean>;
  saveAddress: (id: string, patch: AddressUpdate) => Promise<boolean>;
  archiveAddressRecord: (id: string) => Promise<void>;
  restoreAddressRecord: (id: string) => Promise<void>;
  duplicateAddressRecord: (id: string) => Promise<void>;

  selectedAddressId: string | null;
  openAddressDrawer: (id: string) => void;
  closeAddressDrawer: () => void;

  vacancyProjects: VacancyProjectListRow[];
  vacancyProjectsLoading: boolean;
  vacancyProjectsError: string | null;
  refreshVacancyProjects: () => Promise<void>;
  addVacancyProject: (input: { title: string; categoryOptionId: string | null }) => Promise<boolean>;
  archiveVacancyProjectRecord: (id: string) => Promise<void>;
  restoreVacancyProjectRecord: (id: string) => Promise<void>;
  duplicateVacancyProjectRecord: (id: string) => Promise<void>;

  selectedVacancyProjectId: string | null;
  openVacancyProjectDrawer: (id: string) => void;
  closeVacancyProjectDrawer: () => void;

  rateCards: RateCardRow[];
  rates: RateRow[];
  ratesLoading: boolean;
  ratesError: string | null;
  refreshRates: () => Promise<void>;
  addRate: (input: {
    project: string;
    city: string;
    legalEntity: string;
    rate: Omit<RateInsert, "rate_card_id">;
  }) => Promise<boolean>;
  saveRate: (id: string, patch: RateUpdate) => Promise<boolean>;
  deleteRateRecord: (id: string) => Promise<boolean>;
  saveRateCard: (id: string, patch: RateCardUpdate) => Promise<boolean>;
  deleteRateCardRecord: (id: string) => Promise<boolean>;

  selectedRateId: string | null;
  openRateDrawer: (id: string) => void;
  closeRateDrawer: () => void;
}

export interface ContextAction {
  label: string;
  onClick: () => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: PortalUser;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser] = useState<PortalUser>(initialUser);
  // Стартовый раздел зависит от роли: у рекрутера «Обзора» нет вовсе.
  const [activePage, setActivePage] = useState<PortalPage>(() => defaultPageForRole(initialUser.role));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [densityCompact, setDensityCompact] = useState(false);
  const [contextAction, setContextAction] = useState<ContextAction | null>(null);
  const toastSeq = useRef(0);

  const [realCandidates, setRealCandidates] = useState<RealCandidate[]>([]);
  const [realCandidatesLoading, setRealCandidatesLoading] = useState(true);
  const [realCandidatesError, setRealCandidatesError] = useState<string | null>(null);
  const [selectedRealCandidateId, setSelectedRealCandidateId] = useState<string | null>(null);

  const [listOptions, setListOptions] = useState<CandidateListOption[]>([]);
  const [listOptionsLoading, setListOptionsLoading] = useState(true);
  const [listOptionsError, setListOptionsError] = useState<string | null>(null);

  const [demandRows, setDemandRows] = useState<StaffingDemandRow[]>([]);
  const [demandLoading, setDemandLoading] = useState(true);
  const [demandError, setDemandError] = useState<string | null>(null);
  const [demandWindow, setDemandWindow] = useState<DemandWindow>(() => defaultDemandWindow());

  const [demandRowMeta, setDemandRowMeta] = useState<StaffingDemandRowMeta[]>([]);
  const [demandRowMetaLoading, setDemandRowMetaLoading] = useState(true);
  const [demandRowMetaError, setDemandRowMetaError] = useState<string | null>(null);
  const demandRowMetaSavingRef = useRef<Set<string>>(new Set());

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [vacancyProjects, setVacancyProjects] = useState<VacancyProjectListRow[]>([]);
  const [vacancyProjectsLoading, setVacancyProjectsLoading] = useState(true);
  const [vacancyProjectsError, setVacancyProjectsError] = useState<string | null>(null);
  const [selectedVacancyProjectId, setSelectedVacancyProjectId] = useState<string | null>(null);

  const [rateCards, setRateCards] = useState<RateCardRow[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);

  const can = useCallback(
    (permission: PortalPermission) => canAccess(currentUser.role, permission),
    [currentUser.role],
  );

  // Restore the active section from `?section=` once, after mount (client
  // only). Initial state above is derived from the role — the same value on
  // the server and in the browser — so this never causes a hydration
  // mismatch. The effect never re-runs itself (empty deps) and nothing here
  // writes `section` back into the URL, so there is no update loop with the
  // section's own filter-writing effect (see DemandSection.tsx).
  useEffect(() => {
    const section = searchParams.get("section");
    // Раздел, закрытый для роли, не восстанавливается: до сюда такой запрос
    // обычно не доходит (middleware уводит на /403), но ссылка могла быть
    // сохранена ещё при другой роли.
    const valid = NAV_ITEMS.some((n) => n.id === section) && canAccess(currentUser.role, section as PortalPage);
    if (valid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from the URL on mount
      setActivePage(section as PortalPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run exactly once, on mount
  }, []);

  const goto = useCallback(
    (page: PortalPage) => {
      // Защита от перехода в закрытый раздел мимо меню (командная палитра,
      // старая ссылка). Данные всё равно закрыты RLS, но показывать пустой
      // раздел вместо отказа — хуже.
      if (!canAccess(currentUser.role, page)) return;
      setActivePage(page);
      setMobileSidebarOpen(false);
      setContextAction(null);
    },
    [currentUser.role],
  );

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

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Сессию не удалось закрыть на сервере — уводим на вход всё равно,
      // токен доступа к данным протухнет сам через 15 минут.
    }
    clearPortalAccessToken();
    router.replace("/login");
    router.refresh();
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

  const refreshDemand = useCallback(async () => {
    setDemandLoading(true);
    setDemandError(null);
    try {
      setDemandRows(await listStaffingDemand(demandWindow.from, demandWindow.to));
    } catch (e) {
      setDemandError(e instanceof Error ? e.message : "Не удалось загрузить потребность");
    } finally {
      setDemandLoading(false);
    }
  }, [demandWindow]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshDemand();
  }, [refreshDemand]);

  const upsertDemandCell = useCallback(
    async (project: string, city: string, position: string, demandDate: string, plannedCount: number) => {
      try {
        const saved = await upsertStaffingDemandCell(project, city, position, demandDate, plannedCount);
        setDemandRows((prev) => {
          const idx = prev.findIndex(
            (r) => r.project === project && r.city === city && r.position === position && r.demand_date === demandDate,
          );
          return idx >= 0 ? prev.map((r, i) => (i === idx ? saved : r)) : [...prev, saved];
        });
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось сохранить потребность", "error");
        return false;
      }
    },
    [pushToast],
  );

  const deleteDemandCell = useCallback(
    async (project: string, city: string, position: string, demandDate: string) => {
      try {
        await deleteStaffingDemandCell(project, city, position, demandDate);
        setDemandRows((prev) =>
          prev.filter(
            (r) => !(r.project === project && r.city === city && r.position === position && r.demand_date === demandDate),
          ),
        );
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось удалить потребность", "error");
        return false;
      }
    },
    [pushToast],
  );

  const addDemandBulk = useCallback(
    async (input: {
      project: string;
      cities: string[];
      positions: string[];
      fromDate: string;
      toDate: string;
      plannedCount: number;
    }) => {
      const rows = buildBulkRows(input);
      try {
        const saved = await bulkUpsertStaffingDemand(rows);
        setDemandRows((prev) => {
          const key = (r: { project: string; city: string; position: string; demand_date: string }) =>
            JSON.stringify([r.project, r.city, r.position, r.demand_date]);
          const savedKeys = new Set(saved.map(key));
          return [...prev.filter((r) => !savedKeys.has(key(r))), ...saved];
        });
        pushToast("Потребность добавлена");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось добавить потребность", "error");
        return false;
      }
    },
    [pushToast],
  );

  /** Generic bulk write for copy actions ("Скопировать на 7 дней", "Повторить строку на следующую неделю", …): sets specific (project, city, position, date) cells to specific values, unlike `addDemandBulk`'s city × position × date-range cross-product. */
  const bulkSetDemandCells = useCallback(
    async (rows: { project: string; city: string; position: string; demand_date: string; planned_count: number }[]) => {
      if (rows.length === 0) return true;
      try {
        const saved = await bulkUpsertStaffingDemand(rows);
        setDemandRows((prev) => {
          const key = (r: { project: string; city: string; position: string; demand_date: string }) =>
            JSON.stringify([r.project, r.city, r.position, r.demand_date]);
          const savedKeys = new Set(saved.map(key));
          return [...prev.filter((r) => !savedKeys.has(key(r))), ...saved];
        });
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось скопировать потребность", "error");
        return false;
      }
    },
    [pushToast],
  );

  const refreshDemandRowMeta = useCallback(async () => {
    setDemandRowMetaLoading(true);
    setDemandRowMetaError(null);
    try {
      setDemandRowMeta(await listStaffingDemandRowsMeta());
    } catch (e) {
      setDemandRowMetaError(e instanceof Error ? e.message : "Не удалось загрузить статусы и комментарии");
    } finally {
      setDemandRowMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshDemandRowMeta();
  }, [refreshDemandRowMeta]);

  const updateDemandRowMeta = useCallback(
    async (
      project: string,
      city: string,
      position: string,
      patch: { status?: DemandRowStatus; comment?: string | null },
    ) => {
      const key = demandRowMetaKey(project, city, position);
      if (demandRowMetaSavingRef.current.has(key)) {
        pushToast("Сохранение уже выполняется", "error");
        return false;
      }
      demandRowMetaSavingRef.current.add(key);
      try {
        const existing = demandRowMeta.find(
          (m) => m.project === project && m.city === city && m.position === position,
        );
        const merged = mergeRowMetaPatch(
          existing ? { status: existing.status as DemandRowStatus, comment: existing.comment } : undefined,
          patch,
        );
        const saved = await upsertStaffingDemandRowMeta(project, city, position, merged.status, merged.comment);
        setDemandRowMeta((prev) => {
          const idx = prev.findIndex((m) => m.project === project && m.city === city && m.position === position);
          return idx >= 0 ? prev.map((m, i) => (i === idx ? saved : m)) : [...prev, saved];
        });
        return true;
      } catch (e) {
        const fallback = patch.status !== undefined ? "Не удалось сохранить статус" : "Не удалось сохранить комментарий";
        pushToast(e instanceof Error ? e.message : fallback, "error");
        return false;
      } finally {
        demandRowMetaSavingRef.current.delete(key);
      }
    },
    [demandRowMeta, pushToast],
  );

  const refreshAddresses = useCallback(async () => {
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      setAddresses(await listAddresses());
    } catch (e) {
      setAddressesError(e instanceof Error ? e.message : "Не удалось загрузить адреса");
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshAddresses();
  }, [refreshAddresses]);

  const addAddress = useCallback(
    async (input: AddressInsert) => {
      try {
        const created = await createAddress(input);
        setAddresses((prev) => [created, ...prev]);
        pushToast("Адрес добавлен");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось добавить адрес", "error");
        return false;
      }
    },
    [pushToast],
  );

  const saveAddress = useCallback(
    async (id: string, patch: AddressUpdate) => {
      try {
        const updated = await updateAddress(id, patch);
        setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
        pushToast("Изменения сохранены");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось сохранить изменения", "error");
        return false;
      }
    },
    [pushToast],
  );

  const archiveAddressRecord = useCallback(
    async (id: string) => {
      try {
        const updated = await archiveAddress(id);
        setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
        pushToast("Адрес перемещён в архив");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось архивировать адрес", "error");
      }
    },
    [pushToast],
  );

  const restoreAddressRecord = useCallback(
    async (id: string) => {
      try {
        const updated = await restoreAddress(id);
        setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
        pushToast("Адрес восстановлен из архива");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось восстановить адрес", "error");
      }
    },
    [pushToast],
  );

  const openAddressDrawer = useCallback((id: string) => setSelectedAddressId(id), []);
  const closeAddressDrawer = useCallback(() => setSelectedAddressId(null), []);

  const duplicateAddressRecord = useCallback(
    async (id: string) => {
      const source = addresses.find((a) => a.id === id);
      if (!source) return;
      // Explicit whitelist, not a destructure-omit of id/created_at/updated_at/
      // archived_at/created_by*/updated_by* — the DB default and the audit
      // trigger set all of those fresh for the new row anyway, and listing
      // exactly what's copied avoids "unused variable" noise from the fields
      // we'd otherwise have to name just to discard.
      const input: AddressInsert = {
        project: source.project,
        city: source.city,
        position: source.position,
        full_address: `${source.full_address} (копия)`,
        metro: source.metro,
        district: source.district,
        latitude: source.latitude,
        longitude: source.longitude,
        object_type: source.object_type,
        required_count: source.required_count,
        staffed_count: source.staffed_count,
        planned_start_count: source.planned_start_count,
        in_progress_count: source.in_progress_count,
        status: source.status,
        priority: source.priority,
        schedule_type: source.schedule_type,
        shift_type: source.shift_type,
        shift_times: source.shift_times,
        payment_type: source.payment_type,
        payment_amount: source.payment_amount,
        coordinator_name: source.coordinator_name,
        coordinator_phone: source.coordinator_phone,
        coordinator_telegram: source.coordinator_telegram,
        site_manager_name: source.site_manager_name,
        site_manager_phone: source.site_manager_phone,
        coordinator_comment: source.coordinator_comment,
        features: source.features,
        document_links: source.document_links,
      };
      try {
        const created = await createAddress(input);
        setAddresses((prev) => [created, ...prev]);
        pushToast("Адрес продублирован");
        openAddressDrawer(created.id);
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось продублировать адрес", "error");
      }
    },
    [addresses, pushToast, openAddressDrawer],
  );

  const refreshVacancyProjects = useCallback(async () => {
    setVacancyProjectsLoading(true);
    setVacancyProjectsError(null);
    try {
      setVacancyProjects(await listVacancyProjects());
    } catch (e) {
      setVacancyProjectsError(e instanceof Error ? e.message : "Не удалось загрузить вакансии");
    } finally {
      setVacancyProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshVacancyProjects();
  }, [refreshVacancyProjects]);

  const openVacancyProjectDrawer = useCallback((id: string) => setSelectedVacancyProjectId(id), []);
  const closeVacancyProjectDrawer = useCallback(() => setSelectedVacancyProjectId(null), []);

  const addVacancyProject = useCallback(
    async (input: { title: string; categoryOptionId: string | null }) => {
      try {
        const created = await createVacancyProject(input);
        await refreshVacancyProjects();
        pushToast("Вакансия добавлена");
        openVacancyProjectDrawer(created.id);
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось добавить вакансию", "error");
        return false;
      }
    },
    [pushToast, refreshVacancyProjects, openVacancyProjectDrawer],
  );

  // archived_at патчится точечно (не полная перезагрузка списка), чтобы не
  // терять уже подтянутый category_option этой строки — обычный
  // archiveVacancyProject/restoreVacancyProject возвращает голую строку
  // vacancy_projects без embedded-джойна.
  const archiveVacancyProjectRecord = useCallback(
    async (id: string) => {
      try {
        const updated = await archiveVacancyProject(id);
        setVacancyProjects((prev) => prev.map((v) => (v.id === id ? { ...v, archived_at: updated.archived_at } : v)));
        pushToast("Вакансия перемещена в архив");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось архивировать вакансию", "error");
      }
    },
    [pushToast],
  );

  const restoreVacancyProjectRecord = useCallback(
    async (id: string) => {
      try {
        const updated = await restoreVacancyProject(id);
        setVacancyProjects((prev) => prev.map((v) => (v.id === id ? { ...v, archived_at: updated.archived_at } : v)));
        pushToast("Вакансия восстановлена из архива");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось восстановить вакансию", "error");
      }
    },
    [pushToast],
  );

  const duplicateVacancyProjectRecord = useCallback(
    async (id: string) => {
      try {
        const newId = await duplicateVacancyProject(id);
        await refreshVacancyProjects();
        pushToast("Вакансия продублирована");
        openVacancyProjectDrawer(newId);
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось продублировать вакансию", "error");
      }
    },
    [pushToast, refreshVacancyProjects, openVacancyProjectDrawer],
  );

  const refreshRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError(null);
    try {
      // Один раунд-трип на каждую таблицу раздела, без запроса на карточку
      // (N+1) — группировка ставок по rate_card_id происходит на клиенте.
      const [cards, rows] = await Promise.all([listRateCards(), listRates()]);
      setRateCards(cards);
      setRates(rows);
    } catch (e) {
      setRatesError(e instanceof Error ? e.message : "Не удалось загрузить ставки");
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refreshRates();
  }, [refreshRates]);

  const addRate = useCallback(
    async (input: {
      project: string;
      city: string;
      legalEntity: string;
      rate: Omit<RateInsert, "rate_card_id">;
    }) => {
      try {
        const card = await findOrCreateRateCard(input.project, input.city, input.legalEntity);
        const created = await createRate({ ...input.rate, rate_card_id: card.id });
        setRateCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [card, ...prev]));
        setRates((prev) => [created, ...prev]);
        pushToast("Ставка добавлена");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось добавить ставку", "error");
        return false;
      }
    },
    [pushToast],
  );

  const saveRate = useCallback(
    async (id: string, patch: RateUpdate) => {
      try {
        const updated = await updateRate(id, patch);
        setRates((prev) => prev.map((r) => (r.id === id ? updated : r)));
        pushToast("Изменения сохранены");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось сохранить изменения", "error");
        return false;
      }
    },
    [pushToast],
  );

  const deleteRateRecord = useCallback(
    async (id: string) => {
      try {
        await deleteRate(id);
        setRates((prev) => prev.filter((r) => r.id !== id));
        pushToast("Ставка удалена");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось удалить ставку", "error");
        return false;
      }
    },
    [pushToast],
  );

  const saveRateCard = useCallback(
    async (id: string, patch: RateCardUpdate) => {
      try {
        const updated = await updateRateCard(id, patch);
        setRateCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
        pushToast("Условия сохранены");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось сохранить условия", "error");
        return false;
      }
    },
    [pushToast],
  );

  const deleteRateCardRecord = useCallback(
    async (id: string) => {
      try {
        await deleteRateCard(id);
        // Каскад в БД удаляет и строки тарифов блока — синхронизируем локально так же.
        setRateCards((prev) => prev.filter((c) => c.id !== id));
        setRates((prev) => prev.filter((r) => r.rate_card_id !== id));
        pushToast("Блок условий удалён");
        return true;
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Не удалось удалить блок условий", "error");
        return false;
      }
    },
    [pushToast],
  );

  const openRateDrawer = useCallback((id: string) => setSelectedRateId(id), []);
  const closeRateDrawer = useCallback(() => setSelectedRateId(null), []);

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
      toasts,
      pushToast,
      dismissToast,
      densityCompact,
      toggleDensity,
      contextAction,
      setContextAction,
      currentUser,
      can,
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
      demandRows,
      demandLoading,
      demandError,
      demandWindow,
      setDemandWindow,
      refreshDemand,
      upsertDemandCell,
      deleteDemandCell,
      addDemandBulk,
      bulkSetDemandCells,
      demandRowMeta,
      demandRowMetaLoading,
      demandRowMetaError,
      refreshDemandRowMeta,
      updateDemandRowMeta,
      addresses,
      addressesLoading,
      addressesError,
      refreshAddresses,
      addAddress,
      saveAddress,
      archiveAddressRecord,
      restoreAddressRecord,
      duplicateAddressRecord,
      selectedAddressId,
      openAddressDrawer,
      closeAddressDrawer,
      vacancyProjects,
      vacancyProjectsLoading,
      vacancyProjectsError,
      refreshVacancyProjects,
      addVacancyProject,
      archiveVacancyProjectRecord,
      restoreVacancyProjectRecord,
      duplicateVacancyProjectRecord,
      selectedVacancyProjectId,
      openVacancyProjectDrawer,
      closeVacancyProjectDrawer,
      rateCards,
      rates,
      ratesLoading,
      ratesError,
      refreshRates,
      addRate,
      saveRate,
      deleteRateRecord,
      saveRateCard,
      deleteRateCardRecord,
      selectedRateId,
      openRateDrawer,
      closeRateDrawer,
    }),
    [
      activePage,
      goto,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toasts,
      pushToast,
      dismissToast,
      densityCompact,
      toggleDensity,
      contextAction,
      currentUser,
      can,
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
      demandRows,
      demandLoading,
      demandError,
      demandWindow,
      setDemandWindow,
      refreshDemand,
      upsertDemandCell,
      deleteDemandCell,
      addDemandBulk,
      bulkSetDemandCells,
      demandRowMeta,
      demandRowMetaLoading,
      demandRowMetaError,
      refreshDemandRowMeta,
      updateDemandRowMeta,
      addresses,
      addressesLoading,
      addressesError,
      refreshAddresses,
      addAddress,
      saveAddress,
      archiveAddressRecord,
      restoreAddressRecord,
      duplicateAddressRecord,
      selectedAddressId,
      openAddressDrawer,
      closeAddressDrawer,
      vacancyProjects,
      vacancyProjectsLoading,
      vacancyProjectsError,
      refreshVacancyProjects,
      addVacancyProject,
      archiveVacancyProjectRecord,
      restoreVacancyProjectRecord,
      duplicateVacancyProjectRecord,
      selectedVacancyProjectId,
      openVacancyProjectDrawer,
      closeVacancyProjectDrawer,
      rateCards,
      rates,
      ratesLoading,
      ratesError,
      refreshRates,
      addRate,
      saveRate,
      deleteRateRecord,
      saveRateCard,
      deleteRateCardRecord,
      selectedRateId,
      openRateDrawer,
      closeRateDrawer,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}
