export type ClassItem = { id: string; name: string; day: number; start: string; end: string; room: string };
export type SchoolActivity = { id: string; title: string; start: string; end: string; note: string };
export type TaskItem = { id: string; title: string; due: string; done: boolean; repeat: boolean };
export type Expense = { id: string; label: string; amount: number; income: boolean };
export type Subject = { id: string; name: string; scores: { id: string; name: string; earned: number; total: number }[] };
export type Planner = {
  nickname: string; classes: ClassItem[]; tasks: TaskItem[]; expenses: Expense[]; subjects: Subject[];
  attendance: string[]; noClass: string[]; notifyAt: boolean; notifyBefore: boolean; minutes: number;
  welcomeClaimed: boolean; activities?: SchoolActivity[];
};
export const emptyPlanner: Planner = { nickname: '', classes: [], tasks: [], expenses: [], subjects: [], attendance: [], noClass: [], notifyAt: false, notifyBefore: false, minutes: 15, welcomeClaimed: false };
export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value;
}
export const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function mergeClasses(existing: ClassItem[], incoming: ClassItem[]) {
  const result = [...existing];
  for (const item of incoming) if (!result.some(c => c.name.trim().toLowerCase() === item.name.trim().toLowerCase() && c.day === item.day && c.start === item.start && c.end === item.end)) result.push(item);
  return result;
}
export function grade(subject: Subject) {
  const total = subject.scores.reduce((n, s) => n + s.total, 0);
  return total ? subject.scores.reduce((n, s) => n + s.earned, 0) / total * 100 : null;
}
export function streak(dates: string[], today = new Date()) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  if (!dates.includes(dateKey(day))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (dates.includes(dateKey(day))) { count++; day.setDate(day.getDate() - 1); }
  return count;
}
export function reminderDates(classes: ClassItem[], planner: Planner, now = new Date()) {
  const results: { id: string; date: Date; title: string }[] = [];
  for (let offset = 0; offset < 28; offset++) {
    const day = new Date(now); day.setDate(day.getDate() + offset);
    if (planner.noClass.includes(dateKey(day))) continue;
    for (const item of classes.filter(c => c.day === day.getDay())) {
      if (!validTime(item.start)) continue;
      const [h, m] = item.start.split(':').map(Number);
      const start = new Date(day); start.setHours(h, m, 0, 0);
      for (const lead of [...(planner.notifyAt ? [0] : []), ...(planner.notifyBefore ? [planner.minutes] : [])]) {
        const date = new Date(start.getTime() - lead * 60000);
        if (date > now) results.push({ id: `${item.id}-${dateKey(day)}-${lead}`, date, title: lead ? `${item.name} starts in ${lead} minutes` : `${item.name} starts now` });
      }
    }
  }
  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}
