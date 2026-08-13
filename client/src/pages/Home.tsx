import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Command,
  Link2,
  MessageSquare,
  Network,
  Plus,
  Pencil,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const STATUSES = ["To Do", "In Progress", "Done", "Blocked"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const RELATIONSHIPS = ["blocks", "is blocked by", "relates to", "duplicates", "parent/child"] as const;

type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];
type Relationship = (typeof RELATIONSHIPS)[number];

type TaskRecord = {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: Date | string | null;
  assigneeId: number | null;
  updatedAt: Date | string;
};

const priorityTone: Record<Priority, string> = {
  Low: "bg-[#e7e7e7] text-[#111]",
  Medium: "bg-white text-[#111]",
  High: "bg-[#ffdc45] text-[#111]",
  Urgent: "bg-[#111] text-white",
};

const statusTone: Record<Status, string> = {
  "To Do": "bg-white",
  "In Progress": "bg-[#ffdc45]",
  Done: "bg-[#b9edbd]",
  Blocked: "bg-[#ffb3a8]",
};

function dateLabel(date: Date | string | null) {
  if (!date) return "NO DUE DATE";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

function isOverdue(task: TaskRecord) {
  return Boolean(task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done");
}

function StatBox({ label, value, accent = "bg-white" }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className={`brutal-card-soft p-5 min-h-[130px] flex flex-col justify-between ${accent}`}>
      <p className="font-mono text-[11px] font-bold tracking-[0.18em]">{label}</p>
      <p className="font-display text-6xl leading-none">{value}</p>
    </div>
  );
}

function TaskCard({ task, onOpen, onDragStart }: { task: TaskRecord; onOpen: () => void; onDragStart: () => void }) {
  return (
    <article draggable onDragStart={onDragStart} onClick={onOpen} className="brutal-card-soft p-4 bg-white hover:bg-[#f1f1f1] transition-colors group cursor-grab active:cursor-grabbing">
      <div className="flex items-start justify-between gap-3">
        <span className={`px-2 py-1 text-[10px] font-bold font-mono uppercase ${priorityTone[task.priority]}`}>{task.priority}</span>
        <span className="font-mono text-[10px] text-black/55">#{String(task.id).padStart(4, "0")}</span>
      </div>
      <h3 className="mt-4 text-base font-bold leading-tight tracking-[-0.03em] group-hover:underline">{task.title}</h3>
      <div className="mt-5 flex items-center justify-between gap-2 border-t-2 border-black pt-3 font-mono text-[10px] uppercase">
        <span className={isOverdue(task) ? "text-red-600 font-bold" : "text-black/60"}>{dateLabel(task.dueDate)}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </article>
  );
}

function Header({ view, onCreate }: { view: string; onCreate: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <header className="border-b-4 border-black pb-7 mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-8">
      <div>
        <div className="flex items-center gap-3 font-mono text-[11px] font-bold tracking-[0.18em] mb-6">
          <span className="inline-flex h-3 w-3 bg-[#ffdc45] border-2 border-black" />
          WORKSPACE / 01
          <span className="text-black/40">/</span>
          {view.toUpperCase()}
        </div>
        <h1 className="font-display text-[clamp(4rem,10vw,9.5rem)] leading-[0.77] max-w-5xl">LINKED<br /><span className="text-[#777]">WORK</span></h1>
        <p className="mt-8 max-w-xl text-sm leading-relaxed font-medium">A command center for tasks that know what they depend on. Track momentum, expose blockers, and keep every thread connected.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 border-2 border-black px-3 py-3 font-mono text-[10px] font-bold">
          <Command className="h-3.5 w-3.5" /> K / QUICK ACTIONS
        </div>
        <Button onClick={onCreate} className="brutal-button rounded-none h-12 px-5 bg-black text-white hover:bg-[#ffdc45] hover:text-black font-bold">
          <Plus className="h-4 w-4 mr-2" /> NEW TASK
        </Button>
      </div>
      <nav className="absolute top-6 right-8 hidden md:flex items-center gap-1 border-2 border-black bg-white p-1">
        {[["/", "CONSOLE"], ["/board", "BOARD"], ["/tasks", "INDEX"]].map(([path, label]) => (
          <button key={path} onClick={() => setLocation(path)} className={`px-3 py-2 font-mono text-[10px] font-bold ${view === label ? "bg-black text-white" : "hover:bg-[#ffdc45]"}`}>{label}</button>
        ))}
      </nav>
    </header>
  );
}

function Dashboard({ tasks, onOpen, onCreate }: { tasks: TaskRecord[]; onOpen: (task: TaskRecord) => void; onCreate: () => void }) {
  const dashboard = trpc.task.dashboard.useQuery();
  if (dashboard.isLoading) return <><Header view="CONSOLE" onCreate={onCreate} /><div className="brutal-card-soft p-10 font-mono text-xs">SYNCING WORKSPACE SIGNAL...</div></>;
  if (dashboard.isError) return <><Header view="CONSOLE" onCreate={onCreate} /><div className="brutal-card-soft p-10 bg-[#ffb3a8]"><p className="font-display text-4xl">DATA OFFLINE.</p><p className="font-mono text-xs mt-3">{dashboard.error.message}</p></div></>;
  const counts = dashboard.data?.counts ?? { "To Do": 0, "In Progress": 0, Done: 0, Blocked: 0 };
  const overdue = (dashboard.data?.overdue ?? []) as TaskRecord[];
  const recent = (dashboard.data?.recent ?? []) as TaskRecord[];
  return (
    <>
      <Header view="CONSOLE" onCreate={onCreate} />
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-12">
        <StatBox label="TO DO" value={counts["To Do"]} />
        <StatBox label="IN PROGRESS" value={counts["In Progress"]} accent="bg-[#ffdc45]" />
        <StatBox label="DONE" value={counts.Done} accent="bg-[#b9edbd]" />
        <StatBox label="BLOCKED" value={counts.Blocked} accent="bg-[#ffb3a8]" />
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-8">
        <section className="brutal-card p-6 bg-black text-white min-h-[360px]">
          <div className="flex items-center justify-between border-b-2 border-white pb-4 mb-6">
            <div className="flex items-center gap-3"><CircleAlert className="h-5 w-5 text-[#ffdc45]" /><h2 className="font-display text-3xl tracking-[-0.05em]">ATTENTION NEEDED</h2></div>
            <span className="font-mono text-[10px]">{overdue.length} OPEN</span>
          </div>
          {overdue.length ? <div className="space-y-3">{overdue.map(task => <button key={task.id} onClick={() => onOpen(task)} className="w-full text-left border-b border-white/30 pb-4 flex items-center justify-between gap-4 hover:text-[#ffdc45]"><span className="font-bold">{task.title}</span><span className="font-mono text-[10px] text-[#ffb3a8]">OVERDUE / {dateLabel(task.dueDate)}</span></button>)}</div> : <div className="h-56 flex flex-col justify-center"><p className="font-display text-5xl text-[#ffdc45]">CLEAR.</p><p className="font-mono text-[11px] mt-3 text-white/60">NO OVERDUE TASKS IN YOUR WORKSPACE.</p></div>}
        </section>
        <section className="brutal-card p-6 rule-grid min-h-[360px]">
          <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4"><div className="flex items-center gap-3"><RefreshCcw className="h-5 w-5" /><h2 className="font-display text-3xl tracking-[-0.05em]">RECENT SIGNAL</h2></div><span className="font-mono text-[10px]">{tasks.length} TOTAL</span></div>
          <div className="divide-y-2 divide-black">{recent.length ? recent.map(task => <button key={task.id} onClick={() => onOpen(task)} className="w-full text-left py-4 flex items-center justify-between gap-4 hover:bg-white/70"><span className="font-bold leading-tight">{task.title}</span><span className={`shrink-0 px-2 py-1 font-mono text-[9px] font-bold ${statusTone[task.status]}`}>{task.status.toUpperCase()}</span></button>) : <div className="py-16 text-center font-mono text-xs">NO RECENT ACTIVITY YET.</div>}</div>
        </section>
      </div>
    </>
  );
}

function Board({ tasks, onOpen, onCreate, onStatusChange }: { tasks: TaskRecord[]; onOpen: (task: TaskRecord) => void; onCreate: () => void; onStatusChange: (task: TaskRecord, status: Status) => void }) {
  const [dragged, setDragged] = useState<TaskRecord | null>(null);
  const [boardSearch, setBoardSearch] = useState("");
  const [boardPriority, setBoardPriority] = useState<Priority | "all">("all");
  const visibleTasks = tasks.filter(task => task.title.toLowerCase().includes(boardSearch.toLowerCase()) && (boardPriority === "all" || task.priority === boardPriority));
  return (
    <>
      <Header view="BOARD" onCreate={onCreate} />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5"><p className="font-mono text-[11px] font-bold tracking-[0.16em]">DRAG A TASK TO CHANGE ITS STATUS</p><div className="flex gap-2"><Input value={boardSearch} onChange={event => setBoardSearch(event.target.value)} placeholder="FILTER BOARD" className="rounded-none border-2 border-black h-9 bg-white font-mono text-[10px] w-44" /><select value={boardPriority} onChange={event => setBoardPriority(event.target.value as Priority | "all")} className="h-9 border-2 border-black bg-white px-2 font-mono text-[10px] font-bold"><option value="all">ALL PRIORITY</option>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select><span className="font-mono text-[11px] self-center">{visibleTasks.length} / {tasks.length}</span></div></div>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        {STATUSES.map(status => {
          const columnTasks = visibleTasks.filter(task => task.status === status);
          return <div key={status} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragged) { onStatusChange(dragged, status); setDragged(null); } }} className={`min-h-[500px] p-3 border-2 border-black ${statusTone[status]}`}>
            <div className="flex items-center justify-between px-1 pb-3 mb-3 border-b-2 border-black"><h2 className="font-display text-2xl">{status.toUpperCase()}</h2><span className="font-mono text-[11px] font-bold">{String(columnTasks.length).padStart(2, "0")}</span></div>
            <div className="space-y-3">{columnTasks.map(task => <TaskCard key={task.id} task={task} onOpen={() => onOpen(task)} onDragStart={() => setDragged(task)} />)}</div>
            {!columnTasks.length && <div className="border-2 border-dashed border-black/40 p-6 text-center font-mono text-[10px] text-black/50 mt-3">DROP TASKS HERE</div>}
          </div>;
        })}
      </section>
    </>
  );
}

function IndexView({ tasks, allTasks, onOpen, onCreate, filters, setFilters }: { tasks: TaskRecord[]; allTasks: TaskRecord[]; onOpen: (task: TaskRecord) => void; onCreate: () => void; filters: { search: string; status?: Status; priority?: Priority; due?: "overdue" | "upcoming"; linkedTaskId?: number; relationshipType?: Relationship }; setFilters: React.Dispatch<React.SetStateAction<{ search: string; status?: Status; priority?: Priority; due?: "overdue" | "upcoming"; linkedTaskId?: number; relationshipType?: Relationship }>> }) {
  return (
    <>
      <Header view="INDEX" onCreate={onCreate} />
      <section className="brutal-card-soft p-4 mb-6 bg-[#ffdc45]">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4" /><Input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="SEARCH TASK TITLES" className="rounded-none border-2 border-black pl-9 h-11 bg-white font-mono text-xs placeholder:text-black/50" /></div>
          <select value={filters.status ?? "all"} onChange={event => setFilters(current => ({ ...current, status: event.target.value === "all" ? undefined : event.target.value as Status }))} className="h-11 border-2 border-black bg-white px-3 font-mono text-xs font-bold"><option value="all">ALL STATUS</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select>
          <select value={filters.priority ?? "all"} onChange={event => setFilters(current => ({ ...current, priority: event.target.value === "all" ? undefined : event.target.value as Priority }))} className="h-11 border-2 border-black bg-white px-3 font-mono text-xs font-bold"><option value="all">ALL PRIORITY</option>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select>
          <select value={filters.due ?? "all"} onChange={event => setFilters(current => ({ ...current, due: event.target.value === "all" ? undefined : event.target.value as "overdue" | "upcoming" }))} className="h-11 border-2 border-black bg-white px-3 font-mono text-xs font-bold"><option value="all">ANY DUE DATE</option><option value="overdue">OVERDUE</option><option value="upcoming">UPCOMING</option></select>
          <select value={filters.relationshipType ?? "all"} onChange={event => setFilters(current => ({ ...current, relationshipType: event.target.value === "all" ? undefined : event.target.value as Relationship }))} className="h-11 border-2 border-black bg-white px-3 font-mono text-xs font-bold"><option value="all">ANY LINK TYPE</option>{RELATIONSHIPS.map(relation => <option key={relation}>{relation}</option>)}</select>
          <select value={filters.linkedTaskId ?? "all"} onChange={event => setFilters(current => ({ ...current, linkedTaskId: event.target.value === "all" ? undefined : Number(event.target.value) }))} className="h-11 border-2 border-black bg-white px-3 font-mono text-xs font-bold"><option value="all">ANY CONNECTED TASK</option>{allTasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
        </div>
      </section>
      <section className="brutal-card-soft overflow-hidden bg-white">
        <div className="hidden md:grid grid-cols-[70px_minmax(240px,1.4fr)_150px_120px_140px_100px] gap-4 px-5 py-3 bg-black text-white font-mono text-[10px] font-bold tracking-wider"><span>ID</span><span>TASK</span><span>STATUS</span><span>PRIORITY</span><span>DUE</span><span>LINKS</span></div>
        {tasks.length ? tasks.map(task => <button key={task.id} onClick={() => onOpen(task)} className="w-full text-left grid grid-cols-1 md:grid-cols-[70px_minmax(240px,1.4fr)_150px_120px_140px_100px] gap-2 md:gap-4 px-5 py-5 border-b-2 border-black last:border-0 hover:bg-[#ffdc45] items-center"><span className="font-mono text-[10px] text-black/50">#{String(task.id).padStart(4, "0")}</span><span className="font-bold leading-tight">{task.title}</span><span className={`w-fit px-2 py-1 font-mono text-[9px] font-bold ${statusTone[task.status]}`}>{task.status.toUpperCase()}</span><span className="font-mono text-[10px] uppercase">{task.priority}</span><span className={`font-mono text-[10px] ${isOverdue(task) ? "text-red-600 font-bold" : ""}`}>{dateLabel(task.dueDate)}</span><span className="font-mono text-[10px] flex items-center gap-1"><Link2 className="h-3 w-3" /> OPEN</span></button>) : <div className="p-16 text-center"><p className="font-display text-4xl">NO MATCHES.</p><p className="font-mono text-xs mt-2 text-black/50">ADJUST THE FILTERS OR CREATE A NEW TASK.</p></div>}
      </section>
    </>
  );
}

function NewTaskDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (task: TaskRecord) => void }) {
  const utils = trpc.useUtils();
  const create = trpc.task.create.useMutation({ onSuccess: task => { utils.task.list.invalidate(); utils.task.dashboard.invalidate(); onCreated(task as TaskRecord); } });
  const [form, setForm] = useState({ title: "", description: "", status: "To Do" as Status, priority: "Medium" as Priority, dueDate: "", assigneeId: "" });
  if (!open) return null;
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.title.trim()) return; create.mutate({ title: form.title, description: form.description || undefined, status: form.status, priority: form.priority, dueDate: form.dueDate ? new Date(form.dueDate) : null, assigneeId: form.assigneeId ? Number(form.assigneeId) : null }); };
  return <div className="fixed inset-0 z-50 bg-black/70 p-4 md:p-8 flex items-center justify-center" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={submit} className="brutal-card w-full max-w-2xl bg-white p-6 md:p-8 max-h-[90vh] overflow-y-auto"><div className="flex items-start justify-between mb-8"><div><p className="font-mono text-[10px] font-bold tracking-[0.18em]">NEW RECORD / TASK</p><h2 className="font-display text-5xl mt-2">MAKE A THREAD.</h2></div><button type="button" onClick={onClose} className="border-2 border-black p-2 hover:bg-[#ffdc45]"><X className="h-5 w-5" /></button></div><div className="space-y-5"><div><Label className="font-mono text-[10px] font-bold">TITLE</Label><Input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="What needs to move?" className="rounded-none border-2 border-black h-12 mt-2 text-lg font-bold" /></div><div><Label className="font-mono text-[10px] font-bold">DESCRIPTION</Label><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Context, outcome, acceptance criteria..." className="rounded-none border-2 border-black mt-2 min-h-28" /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><Label className="font-mono text-[10px] font-bold">STATUS</Label><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as Status })} className="mt-2 h-11 w-full border-2 border-black px-2 font-mono text-xs font-bold">{STATUSES.map(status => <option key={status}>{status}</option>)}</select></div><div><Label className="font-mono text-[10px] font-bold">PRIORITY</Label><select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as Priority })} className="mt-2 h-11 w-full border-2 border-black px-2 font-mono text-xs font-bold">{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select></div><div><Label className="font-mono text-[10px] font-bold">DUE DATE</Label><Input type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} className="rounded-none border-2 border-black h-11 mt-2 font-mono text-xs" /></div></div><div><Label className="font-mono text-[10px] font-bold">ASSIGNEE ID <span className="font-normal text-black/50">(OPTIONAL)</span></Label><Input inputMode="numeric" value={form.assigneeId} onChange={event => setForm({ ...form, assigneeId: event.target.value })} placeholder="e.g. 12" className="rounded-none border-2 border-black h-11 mt-2 font-mono text-xs" /></div></div><div className="mt-8 flex justify-end gap-3"><Button type="button" onClick={onClose} variant="outline" className="rounded-none border-2 border-black font-bold">CANCEL</Button><Button disabled={create.isPending} type="submit" className="brutal-button rounded-none bg-black text-white hover:bg-[#ffdc45] hover:text-black font-bold">{create.isPending ? "CREATING..." : "CREATE TASK"}</Button></div></form></div>;
}

function TaskDrawer({ task, onClose, allTasks }: { task: TaskRecord | null; onClose: () => void; allTasks: TaskRecord[] }) {
  const utils = trpc.useUtils();
  const detailInput = useMemo(() => task ? { id: task.id } : { id: 0 }, [task]);
  const detail = trpc.task.get.useQuery(detailInput, { enabled: Boolean(task) });
  const update = trpc.task.update.useMutation({ onSuccess: () => { utils.task.list.invalidate(); utils.task.dashboard.invalidate(); detail.refetch(); } });
  const addLink = trpc.task.addLink.useMutation({ onSuccess: () => { detail.refetch(); utils.task.list.invalidate(); } });
  const removeLink = trpc.task.removeLink.useMutation({ onSuccess: () => detail.refetch() });
  const removeTask = trpc.task.remove.useMutation({ onSuccess: () => { utils.task.list.invalidate(); utils.task.dashboard.invalidate(); onClose(); } });
  const comment = trpc.task.comment.useMutation({ onSuccess: () => { setCommentText(""); detail.refetch(); } });
  const [linkSearch, setLinkSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({ title: "", description: "", dueDate: "", assigneeId: "" });
  const [relationship, setRelationship] = useState<Relationship>("relates to");
  const [commentText, setCommentText] = useState("");
  const connectedIds = new Set((detail.data?.links ?? []).map(link => link.task?.id));
  const candidates = allTasks.filter(item => item.id !== task?.id && !connectedIds.has(item.id) && item.title.toLowerCase().includes(linkSearch.toLowerCase())).slice(0, 6);
  if (!task) return null;
  const current = (detail.data?.task ?? task) as TaskRecord;
  const beginEdit = () => { setEditDraft({ title: current.title, description: current.description ?? "", dueDate: current.dueDate ? new Date(current.dueDate).toISOString().slice(0, 10) : "", assigneeId: current.assigneeId ? String(current.assigneeId) : "" }); setEditing(true); };
  const saveEdit = () => { update.mutate({ id: current.id, title: editDraft.title, description: editDraft.description || null, dueDate: editDraft.dueDate ? new Date(editDraft.dueDate) : null, assigneeId: editDraft.assigneeId ? Number(editDraft.assigneeId) : null }, { onSuccess: () => setEditing(false) }); };
  return <div className="fixed inset-0 z-40 bg-black/45 flex justify-end" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><aside className="w-full max-w-2xl h-full overflow-y-auto task-scroll bg-white border-l-4 border-black p-5 md:p-8"><div className="flex items-start justify-between gap-5 border-b-4 border-black pb-6"><div><p className="font-mono text-[10px] font-bold tracking-[0.18em]">TASK / #{String(current.id).padStart(4, "0")}</p><h2 className="font-display text-5xl leading-[0.88] mt-3">{current.title}</h2></div><div className="flex items-center gap-2"><button onClick={beginEdit} className="border-2 border-black p-2 hover:bg-[#ffdc45]" aria-label="Edit task"><Pencil className="h-4 w-4" /></button><button onClick={onClose} className="border-2 border-black p-2 hover:bg-[#ffdc45]" aria-label="Close task"><X className="h-5 w-5" /></button></div></div>{detail.isLoading && <div className="my-5 border-2 border-black bg-[#ffdc45] p-3 font-mono text-[10px] font-bold">LOADING TASK DETAIL...</div>}{detail.isError && <div className="my-5 border-2 border-red-600 bg-[#ffb3a8] p-3 font-mono text-[10px] font-bold">TASK DETAIL ERROR / {detail.error.message}</div>}<div className="py-6 flex flex-wrap gap-3"><select value={current.status} onChange={event => update.mutate({ id: current.id, status: event.target.value as Status })} className={`h-10 border-2 border-black px-3 font-mono text-xs font-bold ${statusTone[current.status]}`}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select><select value={current.priority} onChange={event => update.mutate({ id: current.id, priority: event.target.value as Priority })} className={`h-10 border-2 border-black px-3 font-mono text-xs font-bold ${priorityTone[current.priority]}`}>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select><span className={`h-10 border-2 border-black px-3 inline-flex items-center font-mono text-xs font-bold ${isOverdue(current) ? "bg-[#ffb3a8]" : "bg-white"}`}><CalendarClock className="h-3.5 w-3.5 mr-2" />{dateLabel(current.dueDate)}</span><span className="h-10 border-2 border-black px-3 inline-flex items-center font-mono text-xs font-bold bg-white">ASSIGNEE / {current.assigneeId ?? "UNASSIGNED"}</span></div>{editing && <section className="border-2 border-black bg-[#ffdc45] p-4 mb-6"><div className="font-mono text-[10px] font-bold tracking-wider mb-3">EDIT CORE FIELDS</div><div className="space-y-3"><Input value={editDraft.title} onChange={event => setEditDraft({ ...editDraft, title: event.target.value })} className="rounded-none border-2 border-black bg-white font-bold" placeholder="Title" /><Textarea value={editDraft.description} onChange={event => setEditDraft({ ...editDraft, description: event.target.value })} className="rounded-none border-2 border-black bg-white" placeholder="Description" /><div className="grid grid-cols-2 gap-3"><Input type="date" value={editDraft.dueDate} onChange={event => setEditDraft({ ...editDraft, dueDate: event.target.value })} className="rounded-none border-2 border-black bg-white font-mono text-xs" /><Input inputMode="numeric" value={editDraft.assigneeId} onChange={event => setEditDraft({ ...editDraft, assigneeId: event.target.value })} className="rounded-none border-2 border-black bg-white font-mono text-xs" placeholder="Assignee ID" /></div><div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={() => setEditing(false)} className="rounded-none border-2 border-black font-mono text-[10px] font-bold">CANCEL</Button><Button type="button" onClick={saveEdit} disabled={update.isPending || !editDraft.title.trim()} className="rounded-none bg-black text-white hover:bg-white hover:text-black font-mono text-[10px] font-bold">{update.isPending ? "SAVING..." : "SAVE EDIT"}</Button></div></div></section>}<section className="border-t-2 border-black py-6"><div className="flex items-center justify-between mb-3"><h3 className="font-display text-2xl">DESCRIPTION</h3></div><p className="text-sm leading-relaxed whitespace-pre-wrap">{current.description || "No description yet."}</p></section><section className="border-t-2 border-black py-6"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><Network className="h-5 w-5" /><h3 className="font-display text-2xl">LINKED TASKS</h3></div><span className="font-mono text-[10px]">{detail.data?.links?.length ?? 0} CONNECTIONS</span></div><div className="border-2 border-black p-3 bg-[#f2f2f2]"><div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" /><Input value={linkSearch} onChange={event => setLinkSearch(event.target.value)} placeholder="QUICK-LINK SEARCH" className="rounded-none border-2 border-black pl-8 h-9 bg-white font-mono text-[10px]" /></div><select value={relationship} onChange={event => setRelationship(event.target.value as Relationship)} className="h-9 border-2 border-black bg-white px-2 font-mono text-[10px] font-bold"><option value="blocks">blocks</option><option value="is blocked by">is blocked by</option><option value="relates to">relates to</option><option value="duplicates">duplicates</option><option value="parent/child">parent/child</option></select></div>{linkSearch && <div className="mt-2 divide-y divide-black/20 bg-white border-2 border-black">{candidates.length ? candidates.map(candidate => <button key={candidate.id} onClick={() => { addLink.mutate({ sourceTaskId: current.id, targetTaskId: candidate.id, relationshipType: relationship }); setLinkSearch(""); }} className="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-[#ffdc45]"><span className="text-xs font-bold">{candidate.title}</span><Plus className="h-4 w-4" /></button>) : <p className="p-3 font-mono text-[10px]">NO UNLINKED TASKS FOUND.</p>}</div>}</div><div className="mt-4 space-y-3">{detail.data?.links?.length ? detail.data.links.map(link => <div key={link.id} className="border-2 border-black p-3 flex items-center gap-3"><div className="shrink-0">{link.direction === "outgoing" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="font-mono text-[10px] font-bold text-black/60 uppercase">{link.relationshipType}</p><p className="font-bold truncate">{link.task?.title ?? "Deleted task"}</p><p className="font-mono text-[10px] mt-1">{link.task?.status}</p></div><button onClick={() => removeLink.mutate({ id: link.id })} className="p-1 hover:bg-[#ffb3a8]" aria-label="Remove link"><X className="h-4 w-4" /></button></div>) : <p className="font-mono text-[10px] text-black/55 py-4">NO LINKS YET. CONNECT THIS TASK TO BUILD THE CHAIN.</p>}</div></section><section className="border-t-2 border-black py-6"><div className="flex items-center gap-3 mb-4"><MessageSquare className="h-5 w-5" /><h3 className="font-display text-2xl">COMMENTS</h3></div><div className="flex gap-2"><Textarea value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Leave a note on this task..." className="rounded-none border-2 border-black min-h-20" /><Button disabled={!commentText.trim() || comment.isPending} onClick={() => comment.mutate({ taskId: current.id, content: commentText })} className="self-end rounded-none bg-black text-white hover:bg-[#ffdc45] hover:text-black h-10 font-mono text-[10px] font-bold">POST</Button></div><div className="mt-4 space-y-3">{detail.data?.comments?.map(item => <div key={item.id} className="border-l-4 border-black pl-3"><p className="text-sm">{item.content}</p><p className="mt-1 font-mono text-[10px] text-black/50">{dateLabel(item.createdAt)}</p></div>)}</div></section><section className="border-t-2 border-black py-6"><div className="flex items-center gap-3 mb-4"><RefreshCcw className="h-5 w-5" /><h3 className="font-display text-2xl">ACTIVITY LOG</h3></div><div className="space-y-4">{detail.data?.activity?.length ? detail.data.activity.map(item => <div key={item.id} className="flex gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 border-2 border-black ${item.eventType === "status_change" ? "bg-[#ffdc45]" : item.eventType === "link_created" ? "bg-[#b9edbd]" : item.eventType === "comment" ? "bg-[#ffb3a8]" : "bg-white"}`} /><div><p className="text-sm font-medium">{item.message}</p><p className="font-mono text-[10px] text-black/50 uppercase mt-1">{item.eventType.replace("_", " ")} / {dateLabel(item.createdAt)}</p></div></div>) : <p className="font-mono text-[10px] text-black/55">NO ACTIVITY RECORDED.</p>}</div></section><section className="border-t-2 border-black pt-5"><Button variant="outline" onClick={() => { if (confirm("Delete this task and its linked history?")) removeTask.mutate({ id: current.id }); }} className="rounded-none border-2 border-red-600 text-red-600 hover:bg-[#ffb3a8] font-mono text-[10px] font-bold"><Trash2 className="h-3 w-3 mr-2" /> DELETE TASK</Button></section></aside></div>;
}

export default function Home() {
  const [location] = useLocation();
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [filters, setFilters] = useState<{ search: string; status?: Status; priority?: Priority; due?: "overdue" | "upcoming"; linkedTaskId?: number; relationshipType?: Relationship }>({ search: "" });
  const queryInput = useMemo(() => ({ search: filters.search || undefined, status: filters.status, priority: filters.priority, due: filters.due, linkedTaskId: filters.linkedTaskId, relationshipType: filters.relationshipType }), [filters.search, filters.status, filters.priority, filters.due, filters.linkedTaskId, filters.relationshipType]);
  const tasksQuery = trpc.task.list.useQuery(queryInput);
  const allTasksInput = useMemo(() => ({}), []);
  const allTasksQuery = trpc.task.list.useQuery(allTasksInput);
  const utils = trpc.useUtils();
  const update = trpc.task.update.useMutation({ onSuccess: () => { utils.task.list.invalidate(); utils.task.dashboard.invalidate(); } });
  const tasks = (tasksQuery.data ?? []) as TaskRecord[];
  const allTasks = (allTasksQuery.data ?? []) as TaskRecord[];
  const view = location === "/board" ? "BOARD" : location === "/tasks" ? "INDEX" : "CONSOLE";
  const dataState = tasksQuery.isLoading ? <div className="brutal-card-soft p-10 font-mono text-xs">LOADING TASK RECORDS...</div> : tasksQuery.isError ? <div className="brutal-card-soft p-10 bg-[#ffb3a8]"><p className="font-display text-4xl">TASK FEED ERROR.</p><p className="font-mono text-xs mt-3">{tasksQuery.error.message}</p></div> : null;
  return <main className="container py-8 md:py-12 relative"><div className="absolute right-10 top-40 hidden 2xl:block w-24 h-24 border-[10px] border-black border-l-transparent rotate-12" />{view === "CONSOLE" && <Dashboard tasks={tasks} onOpen={setSelectedTask} onCreate={() => setNewTaskOpen(true)} />}{view === "BOARD" && (dataState ?? <Board tasks={tasks} onOpen={setSelectedTask} onCreate={() => setNewTaskOpen(true)} onStatusChange={(task, status) => update.mutate({ id: task.id, status })} />)}{view === "INDEX" && (dataState ?? <IndexView tasks={tasks} allTasks={allTasks} onOpen={setSelectedTask} onCreate={() => setNewTaskOpen(true)} filters={filters} setFilters={setFilters} />)}<NewTaskDialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} onCreated={task => { setNewTaskOpen(false); setSelectedTask(task); }} /><TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} allTasks={allTasks} /></main>;
}
