import { supabase } from "@/integrations/supabase/client";

export type ActivityType = "module_passed" | "notebook_run" | "sql_run" | "capstone_passed";
export type ChecklistItemType = "continue_module" | "sql_drill" | "review_earlier_skill" | "capstone_step";

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Deterministic hash of a string (djb2). Same (userId, date) → same seed.
function seed(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return h >>> 0;
}

export async function logActivity(input: {
  userId: string;
  type: ActivityType;
  moduleId?: number | null;
  minutesSpent?: number | null;
}) {
  const dateKey = getTodayKey();
  const { error } = await supabase.from("activity_log").insert({
    user_id: input.userId,
    date: dateKey,
    activity_type: input.type,
    module_id: input.moduleId ?? null,
    minutes_spent: input.minutesSpent ?? null,
  });
  if (error) {
    console.warn("[activity] insert failed", error);
    return false;
  }

  const itemType: ChecklistItemType =
    input.type === "sql_run" ? "sql_drill"
    : input.type === "capstone_passed" ? "capstone_step"
    : "continue_module";

  const refId = input.moduleId != null ? String(input.moduleId) : null;

  let query = supabase.from("daily_checklist")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("date", dateKey)
    .eq("status", "pending")
    .eq("item_type", itemType);

  query = refId != null ? query.eq("ref_id", refId) : query.is("ref_id", null);
  const { error: updateErr } = await query;
  if (updateErr) console.warn("[activity] checklist update failed", updateErr);

  return true;
}

type ChecklistInsert = {
  user_id: string;
  date: string;
  item_type: ChecklistItemType;
  ref_id: string | null;
  label: string;
  status: "pending";
};

export async function ensureDailyChecklist(input: { userId: string; nextModuleLabel: string; moduleId?: number | null }) {
  const dateKey = getTodayKey();
  const { data: existing, error: readErr } = await supabase.from("daily_checklist")
    .select("id").eq("user_id", input.userId).eq("date", dateKey).limit(1);
  if (readErr) {
    console.warn("[activity] checklist read failed", readErr);
    return;
  }
  if ((existing ?? []).length) return;

  // Deterministic per (user, day) — same items on every refresh today.
  const s = seed(`${input.userId}:${dateKey}`);
  const includeSql = (s & 1) === 0;
  const includeReview = (s & 2) === 0;

  const items: ChecklistInsert[] = [{
    user_id: input.userId,
    date: dateKey,
    item_type: "continue_module",
    ref_id: input.moduleId != null ? String(input.moduleId) : null,
    label: input.nextModuleLabel,
    status: "pending",
  }];
  if (includeSql) items.push({
    user_id: input.userId, date: dateKey, item_type: "sql_drill",
    ref_id: null, label: "Quick SQL drill", status: "pending",
  });
  if (includeReview) items.push({
    user_id: input.userId, date: dateKey, item_type: "review_earlier_skill",
    ref_id: null, label: "Review an earlier skill", status: "pending",
  });

  const { error } = await supabase.from("daily_checklist").insert(items);
  if (error) console.warn("[activity] checklist seed failed", error);
}

export async function updateChecklistItemStatus(input: { id: string; status: "pending" | "done" }) {
  const { error } = await supabase.from("daily_checklist")
    .update({
      status: input.status,
      completed_at: input.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  if (error) {
    console.warn("[activity] checklist status failed", error);
    return false;
  }
  return true;
}
