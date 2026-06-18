import { useEffect, useMemo, useRef, useState } from "react";
import {
  Moon, Sun, Plus, Trash2, Printer, Download, FilePlus2, Receipt,
  Copy, Save, History, CheckCircle2, Upload, FileJson, CalendarPlus,
  Search, Share2, Eraser, Percent, Sparkles, LayoutGrid, MoreHorizontal,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import logoAsset from "@/assets/gee-logo-black.png.asset.json";
import qrAsset from "@/assets/gee-qr.png.asset.json";

type ItemPreset = { name: string; price: number };

const PRESETS: { group: string; items: ItemPreset[] }[] = [
  {
    group: "Apparel",
    items: [
      { name: "Sando", price: 400 },
      { name: "Shirt", price: 450 },
      { name: "Polo", price: 500 },
      { name: "Hoodie Warmer", price: 550 },
    ],
  },
  {
    group: "Y2K Series",
    items: [
      { name: "Y2K Regular Shirt", price: 550 },
      { name: "Y2K Jersey", price: 650 },
      { name: "Y2K Jersey Shirt (2 lines neck)", price: 600 },
      { name: "Y2K Polo Shirt", price: 650 },
      { name: "Y2K Longsleeve", price: 700 },
    ],
  },
];

type LineItem = { id: string; name: string; qty: number; price: number; size?: string };
type Status = "Draft" | "Pending" | "Paid" | "Cancelled";
type Fees = { layout: number; shipping: number };
type Template = "long" | "box" | "compact" | "modern";

type InvoiceState = {
  invoiceNumber: string;
  dateCreated: string;
  dueDate: string;
  status: Status;
  customer: {
    name: string; contact: string; facebook: string;
    team: string; address: string; event: string;
  };
  items: LineItem[];
  fees: Fees;
  discountType: "fixed" | "percent";
  discountValue: number;
  downpayment: number;
  notes: string;
  terms: { colors: boolean; dp: boolean; noCancel: boolean };
  paymentMethod: string;
  receiptWidth: 58 | 80;
  template: Template;
};

const HISTORY_KEY = "gee-graphics-history-v1";
const STORAGE_KEY = "gee-graphics-invoice-v3";
type HistoryEntry = { id: string; savedAt: string; state: InvoiceState };

const peso = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function nextInvoiceNumber(): string {
  const raw = localStorage.getItem("gee-graphics-invoice-counter");
  const n = raw ? parseInt(raw, 10) + 1 : 1;
  localStorage.setItem("gee-graphics-invoice-counter", String(n));
  return "INV-" + String(n).padStart(5, "0");
}

function initialState(): InvoiceState {
  return {
    invoiceNumber: "INV-00001",
    dateCreated: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "Draft",
    customer: { name: "", contact: "", facebook: "", team: "", address: "", event: "" },
    items: [],
    fees: { layout: 0, shipping: 0 },
    discountType: "fixed",
    discountValue: 0,
    downpayment: 0,
    notes: "",
    terms: { colors: true, dp: true, noCancel: true },
    paymentMethod: "Cash",
    receiptWidth: 80,
    template: "long",
  };
}

export default function InvoiceGenerator() {
  const [dark, setDark] = useState(false);
  const [state, setState] = useState<InvoiceState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setState({ ...initialState(), ...JSON.parse(saved) }); }
      catch {
        const s = initialState(); s.invoiceNumber = nextInvoiceNumber(); setState(s);
      }
    } else {
      const s = initialState(); s.invoiceNumber = nextInvoiceNumber(); setState(s);
    }
    if (localStorage.getItem("gee-graphics-theme") === "dark") {
      setDark(true); document.documentElement.classList.add("dark");
    }
    setHydrated(true);
    try {
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedAt(new Date());
    }
  }, [state, hydrated]);

  const toggleDark = () => {
    const v = !dark;
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("gee-graphics-theme", v ? "dark" : "light");
  };

  const subtotal = useMemo(() => state.items.reduce((s, i) => s + i.qty * i.price, 0), [state.items]);
  const totalQty = useMemo(() => state.items.reduce((s, i) => s + i.qty, 0), [state.items]);
  const feesTotal = useMemo(() => state.fees.layout + state.fees.shipping, [state.fees]);
  const discountAmount = useMemo(() => {
    const base = subtotal + feesTotal;
    if (state.discountType === "percent") return (base * state.discountValue) / 100;
    return state.discountValue;
  }, [state.discountType, state.discountValue, subtotal, feesTotal]);
  const total = Math.max(0, subtotal + feesTotal - discountAmount);
  const balance = Math.max(0, total - state.downpayment);

  const update = <K extends keyof InvoiceState>(k: K, v: InvoiceState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const addItem = (preset?: ItemPreset) =>
    setState((s) => ({
      ...s,
      items: [...s.items, {
        id: crypto.randomUUID(), name: preset?.name ?? "",
        qty: 1, price: preset?.price ?? 0,
      }],
    }));

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const removeItem = (id: string) =>
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));

  const clearItems = () => {
    if (state.items.length === 0) return;
    if (!confirm("Clear all items?")) return;
    update("items", []);
    toast.success("Items cleared");
  };

  const newInvoice = () => {
    if (!confirm("Start a new invoice? Current draft will be cleared.")) return;
    const s = initialState();
    s.invoiceNumber = nextInvoiceNumber();
    setState(s);
    toast.success("New invoice started");
  };

  const duplicateInvoice = () => {
    setState((s) => ({ ...s, invoiceNumber: nextInvoiceNumber(), status: "Draft", downpayment: 0 }));
    toast.success("Invoice duplicated");
  };

  const markAsPaid = () => {
    setState((s) => ({ ...s, status: "Paid", downpayment: total }));
    toast.success("Marked as Paid");
  };

  const set50Downpayment = () => {
    update("downpayment", Math.round(total / 2));
    toast.success("Set 50% downpayment");
  };

  const roundTotal = () => {
    const rounded = Math.ceil(total / 10) * 10;
    const diff = rounded - total;
    update("discountValue", Math.max(0, state.discountValue - diff));
    toast.success(`Rounded to ${peso(rounded)}`);
  };

  const addDaysToDue = (days: number) => {
    const d = new Date(state.dateCreated || new Date().toISOString().slice(0, 10));
    d.setDate(d.getDate() + days);
    update("dueDate", d.toISOString().slice(0, 10));
  };

  const saveToHistory = () => {
    const entry: HistoryEntry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), state };
    const next = [entry, ...history.filter((h) => h.state.invoiceNumber !== state.invoiceNumber)].slice(0, 50);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    toast.success("Saved to history");
  };
  const loadFromHistory = (entry: HistoryEntry) => {
    setState({ ...initialState(), ...entry.state });
    toast.success(`Loaded ${entry.state.invoiceNumber}`);
  };
  const deleteFromHistory = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${state.invoiceNumber}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };
  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { setState({ ...initialState(), ...JSON.parse(String(reader.result)) }); toast.success("Imported"); }
      catch { toast.error("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  const buildText = () => {
    const lines: string[] = [];
    lines.push(`GEE GRAPHICS — ${state.invoiceNumber}`);
    lines.push(`Date: ${state.dateCreated}${state.dueDate ? ` · Due: ${state.dueDate}` : ""}`);
    lines.push(`Status: ${state.status} · Payment: ${state.paymentMethod}`);
    if (state.customer.name) lines.push(`\nBilled To: ${state.customer.name}`);
    if (state.customer.team) lines.push(state.customer.team);
    if (state.customer.contact) lines.push(`Tel: ${state.customer.contact}`);
    lines.push(`\n— Items —`);
    state.items.forEach((i) => {
      lines.push(`• ${i.name}${i.size ? ` (${i.size})` : ""} — ${i.qty} × ${peso(i.price)} = ${peso(i.qty * i.price)}`);
    });
    lines.push(`\nSubtotal: ${peso(subtotal)}`);
    if (feesTotal > 0) lines.push(`Fees: ${peso(feesTotal)}`);
    if (discountAmount > 0) lines.push(`Discount: -${peso(discountAmount)}`);
    lines.push(`TOTAL: ${peso(total)}`);
    if (state.downpayment > 0) {
      lines.push(`Downpayment: ${peso(state.downpayment)}`);
      lines.push(`Balance: ${peso(balance)}`);
    }
    return lines.join("\n");
  };

  const copyAsText = async () => {
    try { await navigator.clipboard.writeText(buildText()); toast.success("Receipt copied"); }
    catch { toast.error("Failed to copy"); }
  };

  const shareInvoice = async () => {
    const text = buildText();
    if (navigator.share) {
      try {
        await navigator.share({ title: state.invoiceNumber, text });
      } catch { /* canceled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied (share not supported)");
    }
  };

  const handlePrint = () => window.print();

  const renderCanvas = async () => {
    const { default: html2canvas } = await import("html2canvas-pro");
    if (!printRef.current) throw new Error("Preview not ready");
    return await html2canvas(printRef.current, {
      scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false,
      onclone: (doc) => {
        doc.querySelectorAll(".receipt-paper").forEach((el) => el.classList.add("capture-clean"));
      },
    });
  };

  const downloadPDF = async () => {
    toast.loading("Generating PDF...", { id: "pdf" });
    try {
      const canvas = await renderCanvas();
      const { jsPDF } = await import("jspdf");
      const isBox = state.template === "box";
      const widthMm = isBox ? 210 : state.receiptWidth;
      const heightMm = (canvas.height * widthMm) / canvas.width;
      const pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm], orientation: "portrait" });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);
      pdf.save(`${state.invoiceNumber}.pdf`);
      toast.success("PDF downloaded", { id: "pdf" });
    } catch (e) {
      console.error(e); toast.error("Failed to generate PDF", { id: "pdf" });
    }
  };

  const downloadImage = async () => {
    toast.loading("Generating image...", { id: "img" });
    try {
      const canvas = await renderCanvas();
      const link = document.createElement("a");
      link.download = `${state.invoiceNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Image downloaded", { id: "img" });
    } catch (e) {
      console.error(e); toast.error("Failed to generate image", { id: "img" });
    }
  };

  // Keyboard shortcuts: Ctrl/Cmd + S/N/P/D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); saveToHistory(); }
      else if (k === "p") { e.preventDefault(); handlePrint(); }
      else if (k === "d") { e.preventDefault(); downloadPDF(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, history]);

  const filteredPresets = useMemo(() => {
    if (!itemQuery.trim()) return PRESETS;
    const q = itemQuery.toLowerCase();
    return PRESETS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [itemQuery]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="GEE GRAPHICS" className="h-10 w-auto object-contain dark:invert" />
            {savedAt && (
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                Auto-saved · {savedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <input
              ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }}
            />
            <Button variant="outline" size="sm" onClick={newInvoice}><FilePlus2 className="h-3.5 w-3.5" /> New</Button>
            <Button variant="outline" size="sm" onClick={saveToHistory}><Save className="h-3.5 w-3.5" /> Save</Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Copy className="h-3.5 w-3.5" /> File
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={duplicateInvoice}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Import JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJSON}>
                  <FileJson className="h-4 w-4 mr-2" /> Export JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copyAsText}>
                  <Copy className="h-4 w-4 mr-2" /> Copy as Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareInvoice}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="h-3.5 w-3.5" /> History
                  {history.length > 0 && (
                    <span className="ml-1 rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                      {history.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader><SheetTitle className="font-display">Saved Invoices</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-2 overflow-y-auto pb-6">
                  {history.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                      No saved invoices yet.
                    </div>
                  ) : history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{h.state.invoiceNumber}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {h.state.customer.name || "—"} · {h.state.status}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{new Date(h.savedAt).toLocaleString()}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="outline" onClick={() => loadFromHistory(h)}>Load</Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteFromHistory(h.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadImage}>
                  <Download className="h-4 w-4 mr-2" /> Download PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadPDF}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={markAsPaid} disabled={state.status === "Paid"}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Paid
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_440px]">
        <section className="no-print space-y-5">
          {/* Template */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <LayoutGrid className="h-4 w-4" /> Receipt Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  { id: "long", label: "Long Receipt", desc: "Default thermal" },
                  { id: "box", label: "Box / Bond", desc: "A4 table layout" },
                  { id: "compact", label: "Compact", desc: "Minimal narrow" },
                  { id: "modern", label: "Modern Card", desc: "Dark header" },
                ] as { id: Template; label: string; desc: string }[]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update("template", t.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      state.template === t.id
                        ? "border-foreground bg-accent"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <div className="text-xs font-semibold">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base">Invoice Details</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice Number">
                <Input value={state.invoiceNumber} onChange={(e) => update("invoiceNumber", e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={state.status} onValueChange={(v) => update("status", v as Status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Draft", "Pending", "Paid", "Cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date Created">
                <Input type="date" value={state.dateCreated} onChange={(e) => update("dateCreated", e.target.value)} />
              </Field>
              <Field label="Due Date">
                <div className="space-y-1.5">
                  <Input type="date" value={state.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
                  <div className="flex gap-1">
                    {[3, 7, 14].map((d) => (
                      <Button key={d} type="button" variant="secondary" size="sm" className="h-6 flex-1 text-[10px]" onClick={() => addDaysToDue(d)}>
                        <CalendarPlus className="h-3 w-3" /> +{d}d
                      </Button>
                    ))}
                  </div>
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base">Customer</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer Name">
                <Input value={state.customer.name} onChange={(e) => update("customer", { ...state.customer, name: e.target.value })} />
              </Field>
              <Field label="Contact Number">
                <Input value={state.customer.contact} onChange={(e) => update("customer", { ...state.customer, contact: e.target.value })} />
              </Field>
              <Field label="Facebook Name">
                <Input value={state.customer.facebook} onChange={(e) => update("customer", { ...state.customer, facebook: e.target.value })} />
              </Field>
              <Field label="Team / Organization">
                <Input value={state.customer.team} onChange={(e) => update("customer", { ...state.customer, team: e.target.value })} />
              </Field>
              <Field label="Delivery Address" full>
                <Input value={state.customer.address} onChange={(e) => update("customer", { ...state.customer, address: e.target.value })} />
              </Field>
              <Field label="Event Name (optional)" full>
                <Input value={state.customer.event} onChange={(e) => update("customer", { ...state.customer, event: e.target.value })} />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="font-display text-base">Order Items</CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{totalQty} pcs</span>
                <Button size="sm" variant="outline" onClick={clearItems}><Eraser className="h-3.5 w-3.5" /> Clear</Button>
                <Button size="sm" variant="outline" onClick={() => addItem()}><Plus className="h-3.5 w-3.5" /> Custom</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search items..." value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {filteredPresets.map((g) => (
                <div key={g.group}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {g.group}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((i) => (
                      <Button
                        key={i.name} type="button" variant="secondary" size="sm"
                        className="h-8 rounded-full border border-border/60 px-3 text-xs font-normal hover:border-foreground/30"
                        onClick={() => addItem(i)}
                      >
                        <Plus className="h-3 w-3 opacity-60" />
                        {i.name}
                        <span className="ml-1 font-semibold text-foreground">{peso(i.price)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}

              <Separator />

              {state.items.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  Tap any chip above to add an item.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="col-span-5">Item</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-2">Price</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1" />
                  </div>
                  {state.items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-border/70 bg-card p-2">
                      <div className="col-span-12 sm:col-span-5">
                        <Input placeholder={`Item ${idx + 1}`} value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} />
                      </div>
                      <div className="col-span-5 sm:col-span-2">
                        <div className="flex h-9 items-center rounded-md border border-input">
                          <button type="button" className="flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={() => updateItem(item.id, { qty: Math.max(0, item.qty - 1) })} aria-label="Decrease">−</button>
                          <input type="number" min={0} value={item.qty}
                            onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) || 0 })}
                            className="h-full w-full min-w-0 bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                          <button type="button" className="flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={() => updateItem(item.id, { qty: item.qty + 1 })} aria-label="Increase">+</button>
                        </div>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input type="number" min={0} value={item.price}
                          onChange={(e) => updateItem(item.id, { price: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="col-span-4 text-right text-sm font-semibold tabular-nums sm:col-span-2">
                        {peso(item.qty * item.price)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="col-span-12">
                        <Input placeholder="Size / variant (e.g. M, L, XL — Red)" value={item.size ?? ""}
                          onChange={(e) => updateItem(item.id, { size: e.target.value })} className="h-8 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-1 text-sm text-muted-foreground">
                Subtotal: <span className="ml-2 font-semibold tabular-nums text-foreground">{peso(subtotal)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base">Additional Charges</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {([["layout", "Layout Fee"], ["shipping", "Shipping Fee"]] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input type="number" min={0} value={state.fees[key]}
                    onChange={(e) => update("fees", { ...state.fees, [key]: Number(e.target.value) || 0 })} />
                </Field>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base">Discount & Payment</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Discount Type">
                <Select value={state.discountType} onValueChange={(v) => update("discountType", v as "fixed" | "percent")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount (₱)</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Discount Value">
                <Input type="number" min={0} value={state.discountValue}
                  onChange={(e) => update("discountValue", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Downpayment">
                <div className="space-y-1.5">
                  <Input type="number" min={0} value={state.downpayment}
                    onChange={(e) => update("downpayment", Number(e.target.value) || 0)} />
                  <div className="flex gap-1">
                    <Button type="button" variant="secondary" size="sm" className="h-6 flex-1 text-[10px]" onClick={set50Downpayment}>
                      <Percent className="h-3 w-3" /> 50%
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="h-6 flex-1 text-[10px]" onClick={() => update("downpayment", total)}>
                      Full
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="h-6 flex-1 text-[10px]" onClick={roundTotal}>
                      <Sparkles className="h-3 w-3" /> Round
                    </Button>
                  </div>
                </div>
              </Field>
              <Field label="Balance">
                <Input value={peso(balance)} readOnly className="font-semibold tabular-nums" />
              </Field>
              <Field label="Payment Method" full>
                <Select value={state.paymentMethod} onValueChange={(v) => update("paymentMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Cash", "GCash", "Maya", "Bank Transfer", "Card", "Other"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Receipt Width" full>
                <div className="flex gap-1.5">
                  {([58, 80] as const).map((w) => (
                    <Button key={w} type="button" variant={state.receiptWidth === w ? "default" : "outline"}
                      size="sm" className="flex-1" onClick={() => update("receiptWidth", w)}>
                      {w}mm {w === 58 ? "(thermal)" : "(standard)"}
                    </Button>
                  ))}
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={3} placeholder="e.g. Full sublimation, front and back print..."
                value={state.notes} onChange={(e) => update("notes", e.target.value)} />
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base">Terms & Conditions</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              <TermsCheckbox checked={state.terms.colors} onChange={(v) => update("terms", { ...state.terms, colors: v })} label="Colors may vary slightly" />
              <TermsCheckbox checked={state.terms.dp} onChange={(v) => update("terms", { ...state.terms, dp: v })} label="50% Downpayment required before production" />
              <TermsCheckbox checked={state.terms.noCancel} onChange={(v) => update("terms", { ...state.terms, noCancel: v })} label="No cancellation once production starts" />
            </CardContent>
          </Card>

          <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-[10px] text-muted-foreground">
            <strong>Shortcuts:</strong> Ctrl/⌘+S Save · Ctrl/⌘+P Print · Ctrl/⌘+D PDF
          </div>
        </section>

        <section className="lg:sticky lg:top-[80px] lg:h-[calc(100vh-100px)] lg:overflow-auto lg:pb-4">
          <div className="no-print mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Live preview · {state.template}
          </div>
          <ReceiptRenderer
            innerRef={printRef} state={state}
            subtotal={subtotal} totalQty={totalQty}
            feesTotal={feesTotal} discountAmount={discountAmount}
            total={total} balance={balance}
          />
        </section>
      </main>
    </div>
  );
}

/* ============ RECEIPT RENDERERS ============ */

type RProps = {
  innerRef: React.RefObject<HTMLDivElement | null>;
  state: InvoiceState;
  subtotal: number;
  totalQty: number;
  feesTotal: number;
  discountAmount: number;
  total: number;
  balance: number;
};

function ReceiptRenderer(props: RProps) {
  switch (props.state.template) {
    case "box": return <TemplateBox {...props} />;
    case "compact": return <TemplateCompact {...props} />;
    case "modern": return <TemplateModern {...props} />;
    default: return <TemplateLong {...props} />;
  }
}

function FooterBlocks() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
          Replacement Policy
        </div>
        <p className="text-[9px] leading-snug text-neutral-700">
          We offer shirt replacements under the following conditions
          <span className="italic text-neutral-500"> (printitownit)</span>:
        </p>
        <ul className="space-y-0.5 text-[9px] leading-snug text-neutral-700">
          <li>• Stained upon release</li>
          <li>• Incorrect jersey number</li>
          <li>• Incorrect name spelling</li>
          <li>• Incorrect size (per order form)</li>
        </ul>
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-black">
          Scan QR Code
        </div>
        <div className="text-[8.5px] leading-snug text-neutral-600">
          For concerns, inquiries, and order assistance
        </div>
        <img src={qrAsset.url} alt="QR" className="mt-1 h-24 w-24 object-contain" crossOrigin="anonymous" />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "text-[13px] font-bold text-black" : "text-[11px] text-neutral-700"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* --- TEMPLATE 1: Long Receipt (default) --- */
function TemplateLong({ innerRef, state, subtotal, totalQty, discountAmount, total, balance }: RProps) {
  const previewPx = state.receiptWidth === 58 ? 280 : 360;
  return (
    <div className="mx-auto w-full" style={{ maxWidth: previewPx }}>
      <div id="invoice-print" ref={innerRef} className="receipt-paper">
        <div className="px-6 pb-6 pt-2">
          <div className="flex flex-col items-center text-center">
            <img src={logoAsset.url} alt="GEE GRAPHICS" className="h-20 w-auto object-contain" crossOrigin="anonymous" />
            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500">Official Receipt</div>
            <div className="mt-3 text-[10px] leading-relaxed text-neutral-600">geegraphics8@gmail.com · 0915-494-1544</div>
          </div>
          <div className="receipt-divider my-4" />
          <div className="space-y-1 text-[11px] text-neutral-700">
            <div className="flex justify-between"><span className="text-neutral-500">Invoice No.</span><span className="font-semibold text-black">{state.invoiceNumber}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Date</span><span>{state.dateCreated || "—"}</span></div>
            {state.dueDate && <div className="flex justify-between"><span className="text-neutral-500">Due</span><span>{state.dueDate}</span></div>}
            <div className="flex justify-between"><span className="text-neutral-500">Status</span><span className="font-semibold uppercase tracking-wider">{state.status}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Payment</span><span>{state.paymentMethod}</span></div>
          </div>
          <div className="receipt-divider my-4" />
          <div className="space-y-0.5 text-[11px] text-neutral-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Billed To</div>
            <div className="font-semibold text-black">{state.customer.name || "—"}</div>
            {state.customer.team && <div>{state.customer.team}</div>}
            {state.customer.address && <div>{state.customer.address}</div>}
            {state.customer.contact && <div>Tel: {state.customer.contact}</div>}
            {state.customer.facebook && <div>FB: {state.customer.facebook}</div>}
            {state.customer.event && <div>Event: {state.customer.event}</div>}
          </div>
          <div className="receipt-divider my-4" />
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <span>Item</span><span>Total</span>
            </div>
            {state.items.length === 0 ? (
              <div className="py-2 text-center text-[11px] text-neutral-400">No items yet</div>
            ) : state.items.map((i) => (
              <div key={i.id} className="flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-black">
                    {i.name || "Item"}
                    {i.size && <span className="ml-1 text-neutral-500">· {i.size}</span>}
                  </div>
                  <div className="text-[10px] text-neutral-500">{i.qty} × {peso(i.price)}</div>
                </div>
                <div className="shrink-0 font-semibold tabular-nums text-black">{peso(i.qty * i.price)}</div>
              </div>
            ))}
            <div className="pt-1 text-right text-[10px] text-neutral-500">Total Pieces: {totalQty}</div>
          </div>
          <div className="receipt-divider my-4" />
          <div className="space-y-1">
            <Row label="Subtotal" value={peso(subtotal)} />
            {state.fees.layout > 0 && <Row label="Layout Fee" value={peso(state.fees.layout)} />}
            {state.fees.shipping > 0 && <Row label="Shipping Fee" value={peso(state.fees.shipping)} />}
            {discountAmount > 0 && (
              <Row label={`Discount${state.discountType === "percent" ? ` (${state.discountValue}%)` : ""}`} value={`- ${peso(discountAmount)}`} />
            )}
            <div className="receipt-divider my-2" />
            <Row label="TOTAL" value={peso(total)} bold />
            {state.downpayment > 0 && (
              <>
                <Row label="Downpayment" value={peso(state.downpayment)} />
                <Row label="Balance Due" value={peso(balance)} bold />
              </>
            )}
          </div>

          {state.notes && (
            <>
              <div className="receipt-divider my-4" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-[11px] text-neutral-700">{state.notes}</p>
            </>
          )}

          {(state.terms.colors || state.terms.dp || state.terms.noCancel) && (
            <>
              <div className="receipt-divider my-4" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Terms</div>
              <ul className="mt-1 space-y-0.5 text-[10px] text-neutral-600">
                {state.terms.colors && <li>· Colors may vary slightly.</li>}
                {state.terms.dp && <li>· 50% downpayment required before production.</li>}
                {state.terms.noCancel && <li>· No cancellation once production starts.</li>}
              </ul>
            </>
          )}

          <div className="receipt-divider my-4" />
          <div className="text-center">
            <div className="font-display text-[14px] font-bold uppercase tracking-[0.15em] text-black">Thank You</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-neutral-700">For trusting us with your order</div>
          </div>
          <div className="receipt-divider my-4" />
          <FooterBlocks />
        </div>
      </div>
    </div>
  );
}

/* --- TEMPLATE 2: Box / Bond paper --- */
function TemplateBox({ innerRef, state, subtotal, totalQty, discountAmount, total, balance }: RProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
      <div id="invoice-print" ref={innerRef} className="rounded-md border-2 border-black bg-white p-8 text-black shadow-xl">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <img src={logoAsset.url} alt="GEE GRAPHICS" className="h-16 w-auto object-contain" crossOrigin="anonymous" />
            <div>
              <div className="font-display text-xl font-bold tracking-tight">GEE GRAPHICS</div>
              <div className="text-[10px] text-neutral-600">geegraphics8@gmail.com · 0915-494-1544</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold uppercase tracking-tight">Invoice</div>
            <div className="text-xs font-semibold">{state.invoiceNumber}</div>
            <div className="text-[10px] text-neutral-600">{state.dateCreated}{state.dueDate && ` · Due ${state.dueDate}`}</div>
            <span className="mt-1 inline-block rounded border border-black px-2 text-[10px] font-bold uppercase">{state.status}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Billed To</div>
            <div className="font-semibold">{state.customer.name || "—"}</div>
            {state.customer.team && <div>{state.customer.team}</div>}
            {state.customer.address && <div>{state.customer.address}</div>}
            {state.customer.contact && <div>Tel: {state.customer.contact}</div>}
            {state.customer.facebook && <div>FB: {state.customer.facebook}</div>}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Payment</div>
            <div>{state.paymentMethod}</div>
            {state.customer.event && <div className="mt-1 text-[10px] text-neutral-500">Event: {state.customer.event}</div>}
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y-2 border-black text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {state.items.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-neutral-400">No items yet</td></tr>
            ) : state.items.map((i) => (
              <tr key={i.id} className="border-b border-neutral-300">
                <td className="py-2">
                  <div className="font-medium">{i.name || "Item"}</div>
                  {i.size && <div className="text-[10px] text-neutral-500">{i.size}</div>}
                </td>
                <td className="py-2 text-center tabular-nums">{i.qty}</td>
                <td className="py-2 text-right tabular-nums">{peso(i.price)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{peso(i.qty * i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-between gap-6">
          <div className="flex-1 text-[10px] text-neutral-600">
            <div>Total pieces: <span className="font-semibold text-black">{totalQty}</span></div>
            {state.notes && <div className="mt-2 whitespace-pre-wrap">{state.notes}</div>}
          </div>
          <div className="w-64 space-y-1 text-xs">
            <Row label="Subtotal" value={peso(subtotal)} />
            {state.fees.layout > 0 && <Row label="Layout Fee" value={peso(state.fees.layout)} />}
            {state.fees.shipping > 0 && <Row label="Shipping" value={peso(state.fees.shipping)} />}
            {discountAmount > 0 && <Row label="Discount" value={`- ${peso(discountAmount)}`} />}
            <div className="my-1 border-t border-black" />
            <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span className="tabular-nums">{peso(total)}</span></div>
            {state.downpayment > 0 && (
              <>
                <Row label="Downpayment" value={peso(state.downpayment)} />
                <div className="flex justify-between rounded bg-black px-2 py-1 text-sm font-bold text-white">
                  <span>BALANCE</span><span className="tabular-nums">{peso(balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 border-t-2 border-black pt-4 text-center">
          <div className="font-display text-base font-bold uppercase tracking-[0.2em]">Thank You for trusting us with your order</div>
        </div>

        <div className="mt-4">
          <FooterBlocks />
        </div>
      </div>
    </div>
  );
}

/* --- TEMPLATE 3: Compact (super minimal) --- */
function TemplateCompact({ innerRef, state, subtotal, totalQty, discountAmount, total, balance }: RProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 320 }}>
      <div id="invoice-print" ref={innerRef} className="rounded-sm bg-white p-5 text-black shadow-lg">
        <div className="flex items-center justify-between">
          <img src={logoAsset.url} alt="GG" className="h-8 w-auto object-contain" crossOrigin="anonymous" />
          <div className="text-right">
            <div className="text-[10px] font-bold tabular-nums">{state.invoiceNumber}</div>
            <div className="text-[9px] text-neutral-500">{state.dateCreated}</div>
          </div>
        </div>
        <div className="my-3 border-t border-dashed border-neutral-400" />
        <div className="text-[10px] text-neutral-700">
          <div className="font-semibold text-black">{state.customer.name || "Walk-in"}</div>
          {state.customer.contact && <div>{state.customer.contact}</div>}
        </div>
        <div className="my-3 border-t border-dashed border-neutral-400" />
        <div className="space-y-1 text-[10px]">
          {state.items.length === 0 ? (
            <div className="text-center text-neutral-400">No items</div>
          ) : state.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-2">
              <span className="flex-1 truncate">{i.qty}× {i.name}{i.size && ` (${i.size})`}</span>
              <span className="font-semibold tabular-nums">{peso(i.qty * i.price)}</span>
            </div>
          ))}
        </div>
        <div className="my-3 border-t border-dashed border-neutral-400" />
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{peso(subtotal)}</span></div>
          {discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">- {peso(discountAmount)}</span></div>}
        </div>
        <div className="mt-2 flex items-baseline justify-between border-y-2 border-black py-2">
          <span className="font-display text-xs font-bold uppercase">Total</span>
          <span className="font-display text-lg font-bold tabular-nums">{peso(total)}</span>
        </div>
        {state.downpayment > 0 && (
          <div className="mt-1 flex justify-between text-[10px]">
            <span>Balance</span><span className="font-bold tabular-nums">{peso(balance)}</span>
          </div>
        )}
        <div className="mt-3 text-center text-[9px] uppercase tracking-[0.2em] text-neutral-600">
          {totalQty} pcs · {state.paymentMethod} · {state.status}
        </div>
        <div className="mt-3 text-center text-[9px] uppercase tracking-wider">Thank you!</div>
        <div className="my-3 border-t border-dashed border-neutral-400" />
        <FooterBlocks />
      </div>
    </div>
  );
}

/* --- TEMPLATE 4: Modern Card --- */
function TemplateModern({ innerRef, state, subtotal, totalQty, discountAmount, total, balance }: RProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 420 }}>
      <div id="invoice-print" ref={innerRef} className="overflow-hidden rounded-2xl bg-white text-black shadow-2xl">
        <div className="bg-black p-6 text-white">
          <div className="flex items-center justify-between">
            <img src={logoAsset.url} alt="GEE GRAPHICS" className="h-10 w-auto object-contain invert" crossOrigin="anonymous" />
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">{state.status}</span>
          </div>
          <div className="mt-5 text-[10px] uppercase tracking-[0.25em] text-white/60">Invoice</div>
          <div className="font-display text-2xl font-bold tracking-tight">{state.invoiceNumber}</div>
          <div className="mt-1 text-[11px] text-white/70">{state.dateCreated}{state.dueDate && ` · Due ${state.dueDate}`}</div>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Billed To</div>
            <div className="mt-1 font-semibold">{state.customer.name || "—"}</div>
            {state.customer.team && <div className="text-xs text-neutral-600">{state.customer.team}</div>}
            {state.customer.contact && <div className="text-xs text-neutral-600">{state.customer.contact}</div>}
            {state.customer.address && <div className="text-xs text-neutral-600">{state.customer.address}</div>}
          </div>
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Items ({totalQty} pcs)</div>
            <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {state.items.length === 0 ? (
                <div className="p-3 text-center text-xs text-neutral-400">No items yet</div>
              ) : state.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{i.name || "Item"}</div>
                    <div className="text-[10px] text-neutral-500">{i.qty} × {peso(i.price)}{i.size && ` · ${i.size}`}</div>
                  </div>
                  <div className="shrink-0 text-xs font-semibold tabular-nums">{peso(i.qty * i.price)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg bg-neutral-50 p-4">
            <Row label="Subtotal" value={peso(subtotal)} />
            {state.fees.layout > 0 && <Row label="Layout" value={peso(state.fees.layout)} />}
            {state.fees.shipping > 0 && <Row label="Shipping" value={peso(state.fees.shipping)} />}
            {discountAmount > 0 && <Row label="Discount" value={`- ${peso(discountAmount)}`} />}
            <div className="my-1 border-t border-neutral-300" />
            <div className="flex items-baseline justify-between">
              <span className="font-display text-xs font-semibold uppercase tracking-wider">Total</span>
              <span className="font-display text-2xl font-bold tabular-nums">{peso(total)}</span>
            </div>
            {state.downpayment > 0 && (
              <>
                <Row label="Downpayment" value={peso(state.downpayment)} />
                <div className="flex justify-between rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
                  <span>Balance</span><span className="tabular-nums">{peso(balance)}</span>
                </div>
              </>
            )}
          </div>

          {state.notes && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-700">{state.notes}</p>
            </div>
          )}

          <div className="text-center">
            <div className="font-display text-base font-bold uppercase tracking-[0.18em]">Thank You</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-600">For trusting us with your order</div>
          </div>

          <FooterBlocks />
        </div>
      </div>
    </div>
  );
}

/* ============ small UI helpers ============ */
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TermsCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span>{label}</span>
    </label>
  );
}
