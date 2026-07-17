import { supabase } from "@/integrations/supabase/client";

export type ActivityType = "module_passed" | "notebook_run" | "sql_run" | "capstone_passed";
export type ChecklistItemType = "continue_module" | "sql_drill" | "review_earlier_skill" | "capstone_step";

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function maybeInsert(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
  try {
    const { error } = await (supabase.from(table as never) as any).insert(payload);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn(`[activity] failed to write ${table}`, error);
    return false;
  }
}


async function maybeUpdateChecklistByEvent(userId: string, itemType: ChecklistItemType, date: string, refId?: number | string | null) {
  try {
    let query = (supabase.from("daily_checklist") as any)
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("date", date)
      .eq("status", "pending")
      .eq("item_type", itemType);

    if (refId !== undefined && refId !== null) {
      query = query.eq("ref_id", refId);
    } else {
      query = query.is("ref_id", null);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("[activity] failed to update checklist", error);
    return false;
  }
}

export async function logActivity(input: {
  userId: string;
  type: ActivityType;
  moduleId?: number | null;
  minutesSpent?: number | null;
}) {
  const payload = {
    user_id: input.userId,
    date: getTodayKey(),
    activity_type: input.type,
    module_id: input.moduleId ?? null,
    minutes_spent: input.minutesSpent ?? null,
    created_at: new Date().toISOString(),
  };

  const inserted = await maybeInsert("activity_log", payload);
  if (!inserted) return false;

  const dateKey = getTodayKey();
  const checklistItemType: ChecklistItemType | null = input.type === "sql_run"
    ? "sql_drill"
    : input.type === "module_passed"
      ? "continue_module"
      : input.type === "capstone_passed"
        ? "capstone_step"
        : "continue_module";

  if (checklistItemType) {
    await maybeUpdateChecklistByEvent(input.userId, checklistItemType, dateKey, input.moduleId ?? null);
  }

  return true;
}

export async function ensureDailyChecklist(input: { userId: string; nextModuleLabel: string; moduleId?: number | null }) {
  const dateKey = getTodayKey();
  const { data, error } = await (supabase.from("daily_checklist") as any)
    .select("id")
    .eq("user_id", input.userId)
    .eq("date", dateKey);

  if (error) {
    console.warn("[activity] failed to read checklist", error);
    return [] as Array<{ id: string }>;
  }

  if ((data ?? []).length) return data as Array<{ id: string }>;

  const items = [
    {
      user_id: input.userId,
      date: dateKey,
      item_type: "continue_module",
      ref_id: input.moduleId ?? null,
      label: input.nextModuleLabel,
      status: "pending",
      created_at: new Date().toISOString(),
    },
  ];

  if (Math.random() > 0.35) {
    items.push({
      user_id: input.userId,
      date: dateKey,
      item_type: "sql_drill",
      ref_id: null,
      label: "Quick SQL drill",
      status: "pending",
      created_at: new Date().toISOString(),
    });
  }

  if (Math.random() > 0.45) {
    items.push({
      user_id: input.userId,
      date: dateKey,
      item_type: "review_earlier_skill",
      ref_id: null,
      label: "Review an earlier skill",
      status: "pending",
      created_at: new Date().toISOString(),
    });
  }

  const inserted = await maybeInsert("daily_checklist", items);
  return inserted ? (items as unknown as Array<{ id: string }>) : [];
}

export async function updateChecklistItemStatus(input: { id: string; status: "pending" | "done" }) {
  const { error } = await (supabase.from("daily_checklist") as any)
    .update({ status: input.status, completed_at: input.status === "done" ? new Date().toISOString() : null })
    .eq("id", input.id);

  if (error) {
    console.warn("[activity] failed to update checklist item", error);
    return false;
  }

  return true;
}
