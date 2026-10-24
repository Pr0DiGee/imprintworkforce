/**
 * Everything waiting on one user, worked out on the server per request:
 * automatic weekly to-dos (report, feedback, follow-ups), their check-up
 * tasks, open tasks, and whether they've added a phone number. Used by the
 * Tasks page and the sidebar dots. cache() makes both share one lookup.
 */
import { cache } from "react";
import { addDays, format, parseISO } from "date-fns";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentWeekMonday, getTargetSundayString, lagosTime, weeklyDeadlines, formatTargetSunday } from "@/lib/date";
import { CHECKUP_WEEKS_KEPT } from "@/lib/checkups";
import { getPrivatePhone } from "@/lib/private-profile";
import { fetchUserMap } from "@/lib/server-data";
import { DEPARTMENT_LABELS, type Department, type UserProfile } from "@/types";

export interface AutoTodo {
  id: string;
  kind: "REPORT" | "FEEDBACK" | "FOLLOW_UP";
  title: string;
  href: string;
  due: string; // ISO
  overdue: boolean;
}

export interface CheckupItem {
  id: string;
  week: string;
  targetName: string;
  /** Only for the current week's partner */
  targetPhone: string | null;
  completed: boolean;
  current: boolean;
  due: string; // ISO, end of that week (Sunday 11:59pm Lagos)
  overdue: boolean;
}

export interface ActionSummary {
  autoTodos: AutoTodo[];
  checkups: CheckupItem[];
  openTaskCount: number;
  hasPhone: boolean;
  reportPending: boolean;
  feedbackPending: boolean;
  followUpsPending: number;
}

export const getActionSummary = cache(async (user: UserProfile): Promise<ActionSummary> => {
  const db = getAdminDb();
  const now = new Date();
  const sunday = getTargetSundayString(now);
  const monday = getCurrentWeekMonday(now);
  const oldestWeek = format(addDays(parseISO(monday), -7 * (CHECKUP_WEEKS_KEPT - 1)), "yyyy-MM-dd");
  const deadlines = weeklyDeadlines(sunday);
  const departments = (user.departments ?? []) as Department[];

  const [reports, feedback, contacts, checkupSnap, tasksSnap, phone, userMap] = await Promise.all([
    departments.length ? db.getAll(...departments.map((d) => db.collection("reports").doc(`${d}_${sunday}`))) : Promise.resolve([]),
    db.collection("feedback").doc(`${sunday}_${user.uid}`).get(),
    db.collection("followup_contacts").where("assigned_to", "==", user.uid).get(),
    db.collection("checkup_tasks").where("checker", "==", user.uid).where("week", ">=", oldestWeek).get(),
    db.collection("tasks").where("assigned_to", "==", user.uid).get(),
    getPrivatePhone(user.uid),
    fetchUserMap(),
  ]);

  const autoTodos: AutoTodo[] = [];
  const pendingDepts = departments.filter((_, i) => reports[i]?.data()?.status !== "SUBMITTED");
  for (const dept of pendingDepts) {
    autoTodos.push({
      id: `report_${dept}`,
      kind: "REPORT",
      title: `Submit the ${DEPARTMENT_LABELS[dept]} report`,
      href: "/dashboard/reports",
      due: deadlines.report.toISOString(),
      overdue: now > deadlines.report,
    });
  }
  const feedbackPending = !feedback.exists;
  if (feedbackPending) {
    autoTodos.push({
      id: "feedback",
      kind: "FEEDBACK",
      title: `Send your feedback for ${formatTargetSunday(sunday)}`,
      href: "/dashboard/feedback",
      due: deadlines.feedback.toISOString(),
      overdue: now > deadlines.feedback,
    });
  }
  const followUpsPending = contacts.docs.filter((d) => d.data().last_log_sunday !== sunday).length;
  if (followUpsPending > 0) {
    autoTodos.push({
      id: "followup",
      kind: "FOLLOW_UP",
      title: `${followUpsPending} ${followUpsPending === 1 ? "contact" : "contacts"} to follow up this week`,
      href: "/dashboard/followup",
      due: deadlines.followUp.toISOString(),
      overdue: now > deadlines.followUp,
    });
  }

  // Partner's number only for this week's check-up
  const currentTarget = checkupSnap.docs.find((d) => d.data().week === monday)?.data().target as string | undefined;
  const currentTargetPhone = currentTarget ? await getPrivatePhone(currentTarget) : null;

  const checkups: CheckupItem[] = checkupSnap.docs
    .map((d) => {
      const data = d.data();
      const due = lagosTime(format(addDays(parseISO(data.week), 6), "yyyy-MM-dd"), 23, 59);
      const current = data.week === monday;
      return {
        id: d.id,
        week: data.week,
        targetName: userMap[data.target] ?? "A former worker",
        targetPhone: current ? currentTargetPhone : null,
        completed: Boolean(data.completed),
        current,
        due: due.toISOString(),
        overdue: !data.completed && now > due,
      };
    })
    // Unfinished ones stay for 4 weeks; finished ones only show for the current week
    .filter((c) => !c.completed || c.current)
    .sort((a, b) => b.week.localeCompare(a.week));

  const openTaskCount = tasksSnap.docs.filter((d) => d.data().status !== "COMPLETED").length;

  return {
    autoTodos,
    checkups,
    openTaskCount,
    hasPhone: Boolean(phone),
    reportPending: pendingDepts.length > 0,
    feedbackPending,
    followUpsPending,
  };
});

/** Which sidebar items get a dot. */
export function sidebarDots(summary: ActionSummary) {
  return {
    tasks: summary.openTaskCount > 0 || summary.autoTodos.length > 0 || summary.checkups.some((c) => !c.completed),
    reports: summary.reportPending,
    feedback: summary.feedbackPending,
    followup: summary.followUpsPending > 0,
    profile: !summary.hasPhone,
  };
}
export type SidebarDots = ReturnType<typeof sidebarDots>;
