"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  HardHat,
  Inbox,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type InvoiceStatus = "PROCESSING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
type DashboardView = "all" | "processing" | "review" | "decided";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type Invoice = {
  id: string;
  vendorName: string;
  vendorEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  isDuplicate: boolean;
  duplicateOf: string | null;
  projectName: string;
  lineItems: LineItem[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const views: { id: DashboardView; label: string }[] = [
  { id: "all", label: "All invoices" },
  { id: "processing", label: "Processing" },
  { id: "review", label: "Needs review" },
  { id: "decided", label: "Approved / rejected" },
];

type InvoiceDraft = {
  vendorName: string;
  vendorEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  projectName: string;
  lineItems: {
    description: string;
    quantity: string;
    unitPrice: string;
  }[];
};

const defaultDraft: InvoiceDraft = {
  vendorName: "",
  vendorEmail: "",
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
  projectName: "",
  lineItems: [{ description: "", quantity: "1", unitPrice: "0" }],
};

async function fetchInvoices() {
  const response = await fetch(`${API_URL}/invoices`, { cache: "no-store" });
  if (!response.ok) throw new Error(`The invoice service returned ${response.status}.`);
  return (await response.json()) as Invoice[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function statusText(status: InvoiceStatus) {
  return {
    PROCESSING: "Processing",
    NEEDS_REVIEW: "Needs review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  }[status];
}

function visibleInView(invoice: Invoice, view: DashboardView) {
  if (view === "processing") return invoice.status === "PROCESSING";
  if (view === "review") return invoice.status === "NEEDS_REVIEW";
  if (view === "decided") return invoice.status === "APPROVED" || invoice.status === "REJECTED";
  return true;
}

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft>(defaultDraft);
  const [submitting, setSubmitting] = useState(false);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices();
      setInvoices(data);
      setSelectedId((current) => current && data.some((invoice) => invoice.id === current) ? current : data[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchInvoices()
      .then((data) => {
        if (!active) return;
        setInvoices(data);
        setSelectedId(data[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load invoices.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const query = search.trim().toLocaleLowerCase();
  const normalizedLineItems = draft.lineItems.map((lineItem) => {
    const quantity = Number(lineItem.quantity || 0);
    const unitPrice = Number(lineItem.unitPrice || 0);
    const amount = Number((quantity * unitPrice).toFixed(2));
    return { ...lineItem, quantity, unitPrice, amount };
  });
  const subtotal = normalizedLineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0);
  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      vendorName: draft.vendorName.trim(),
      vendorEmail: draft.vendorEmail.trim(),
      invoiceNumber: draft.invoiceNumber.trim(),
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      projectName: draft.projectName.trim(),
      subtotal,
      tax,
      total,
      lineItems: normalizedLineItems.map((lineItem) => ({
        description: lineItem.description.trim(),
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        amount: lineItem.amount,
      })),
    };

    if (!payload.vendorName || !payload.vendorEmail || !payload.invoiceNumber || !payload.projectName || payload.lineItems.length === 0 || payload.lineItems.some((lineItem) => !lineItem.description)) {
      setError('Please complete the vendor, invoice, project, and all line-item details.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as Invoice | { message?: string };
      if (!response.ok) {
        throw new Error('message' in result ? result.message ?? 'Unable to create invoice.' : 'Unable to create invoice.');
      }
      const createdInvoice = result as Invoice;
      setInvoices((current) => [createdInvoice, ...current]);
      setSelectedId(createdInvoice.id);
      setShowCreateForm(false);
      setDraft(defaultDraft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesView = visibleInView(invoice, activeView);
    const matchesQuery = !query || `${invoice.vendorName} ${invoice.invoiceNumber} ${invoice.projectName}`.toLocaleLowerCase().includes(query);
    return matchesView && matchesQuery;
  });
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const reviewCount = invoices.length;
  const duplicateCount = invoices.filter((invoice) => invoice.isDuplicate).length;
  const openTotal = invoices
    .filter((invoice) => invoice.status === "PROCESSING" || invoice.status === "NEEDS_REVIEW")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);

  async function updateStatus(invoice: Invoice, status: "APPROVED" | "REJECTED") {
    setWorkingId(invoice.id);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as Invoice | { message?: string };
      if (!response.ok) {
        const message = "message" in result ? result.message : undefined;
        throw new Error(message || `Unable to ${status.toLocaleLowerCase()} this invoice.`);
      }
      const updatedInvoice = result as Invoice;
      setInvoices((current) => current.map((item) => item.id === updatedInvoice.id ? updatedInvoice : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update invoice status.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="desk-shell">
      <aside className="sidebar">
        <a className="brand" href="#inbox" aria-label="Fieldnote invoice desk home">
          <span className="brand-mark"><HardHat size={20} strokeWidth={2.3} /></span>
          <span className="brand-name">Invoice Desk</span>
        </a>
        <nav className="primary-nav" aria-label="Main navigation">
          <a className="nav-link nav-link-active" href="#inbox"><Inbox size={17} /><span>Invoice inbox</span><span className="nav-count">{reviewCount}</span></a>
        </nav>
      </aside>

      <section className="main-area" id="inbox">
        {/* <header className="topbar">
          <div className="breadcrumbs"><strong>Invoice inbox</strong></div>
        </header> */}

        <div className="page-content">
          <div className="page-heading">
            <div>
            <h1>Invoice inbox</h1><p className="page-subtitle">Review incoming invoices and keep projects moving.</p></div>
            {/* <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button className="export-button" type="button" onClick={() => setShowCreateForm(true)} style={{ background: "#1b7f67", color: "#fff", borderRadius: 8, padding: "0 16px" }}>Add invoice</button>
            </div> */}
          </div>

          {showCreateForm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 50, padding: "24px 16px", overflowY: "auto" }}>
              <div style={{ width: "min(760px, calc(100vw - 32px))", maxHeight: "min(85vh, 800px)", margin: "auto", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)", overflow: "hidden", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
                  <strong style={{ fontSize: 18 }}>Add invoice</strong>
                  <button type="button" className="icon-button" onClick={() => setShowCreateForm(false)} aria-label="Close add invoice form"><X size={16} /></button>
                </div>
                {error && (
                  <div className="error-banner" role="alert" style={{ marginBottom: 16, flexShrink: 0 }}>
                    <AlertCircle size={17} />
                    <span>{error}</span>
                    <button type="button" className="dismiss-error" aria-label="Dismiss error" onClick={() => setError(null)}><X size={15} /></button>
                  </div>
                )}
                <form onSubmit={createInvoice} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, overflowY: "auto", padding: "6px 16px 16px 16px", boxSizing: "border-box" }}>
                  <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                    <span>Vendor name</span>
                    <input value={draft.vendorName} onChange={(event) => setDraft((current) => ({ ...current, vendorName: event.target.value }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                    <span>Vendor email</span>
                    <input type="email" value={draft.vendorEmail} onChange={(event) => setDraft((current) => ({ ...current, vendorEmail: event.target.value }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                    <span>Invoice number</span>
                    <input value={draft.invoiceNumber} onChange={(event) => setDraft((current) => ({ ...current, invoiceNumber: event.target.value }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                    <span>Project name</span>
                    <input value={draft.projectName} onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                    <span>Invoice date</span>
                    <input type="date" value={draft.invoiceDate} onChange={(event) => setDraft((current) => ({ ...current, invoiceDate: event.target.value }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                    <span>Due date</span>
                    <input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                  </label>

                  <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12 }}>
                    {draft.lineItems.map((lineItem, index) => (
                      <div key={`${lineItem.description || 'line'}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 3fr) minmax(70px, 1fr) minmax(85px, 1.2fr) auto", boxSizing: "border-box", width: "100%", gap: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 14, background: "#f8fafc" }}>
                        <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                          <span>Line item</span>
                          <input value={lineItem.description} onChange={(event) => setDraft((current) => ({ ...current, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                        </label>
                        <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                          <span>Qty</span>
                          <input type="number" min="0" step="0.01" value={lineItem.quantity} onChange={(event) => setDraft((current) => ({ ...current, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item) }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                        </label>
                        <label style={{ display: "grid", gap: 6, color: "#0f172a" }}>
                          <span>Unit price</span>
                          <input type="number" min="0" step="0.01" value={lineItem.unitPrice} onChange={(event) => setDraft((current) => ({ ...current, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: event.target.value } : item) }))} style={{ border: "1px solid #dfe7ef", padding: "10px 12px", borderRadius: 10, color: "#0f172a", width: "100%", minWidth: 0, boxSizing: "border-box" }} required />
                        </label>
                        <button type="button" className="icon-button" onClick={() => setDraft((current) => ({ ...current, lineItems: current.lineItems.length > 1 ? current.lineItems.filter((_, itemIndex) => itemIndex !== index) : current.lineItems }))} style={{ alignSelf: "end", width: 42, height: 42, borderRadius: 10, background: "#fee2e2", color: "#7f1d1d" }} aria-label="Remove line item"><X size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className="export-button" onClick={() => setDraft((current) => ({ ...current, lineItems: [...current.lineItems, { description: "", quantity: "1", unitPrice: "0" }] }))} style={{ justifySelf: "start", background: "#e2e8f0", color: "#0f172a" }}>+ Add line item</button>
                  </div>

                  
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
                    <button type="button" className="export-button" onClick={() => setShowCreateForm(false)} style={{ background: "#e2e8f0", color: "#0f172a", borderRadius: 8 }}>Cancel</button>
                    <button type="submit" className="approve-button" disabled={submitting} style={{ border: "none", color: "#fff", borderRadius: 8, padding: "10px 20px" }}>{submitting ? <span className="button-spinner" /> : "Create invoice"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <section className="summary-strip" aria-label="Invoice summary">
            <div className="summary-item"><span className="summary-icon summary-icon-review"><Clock3 size={17} /></span><span className="summary-copy"><span>Needs your review</span><strong>{reviewCount} <small>invoices</small></strong></span></div>
            <div className="summary-divider" />
            <div className="summary-item"><span className="summary-icon summary-icon-open"><FileText size={17} /></span><span className="summary-copy"><span>Open invoice value</span><strong>{currency.format(openTotal)}</strong></span></div>
            <div className="summary-divider" />
            <div className="summary-item"><span className="summary-icon summary-icon-duplicate"><AlertCircle size={17} /></span><span className="summary-copy"><span>Potential duplicates</span><strong>{duplicateCount} <small>flagged</small></strong></span></div>
            <span className="summary-period">CURRENT WORK QUEUE</span>
          </section>

          {error && <div className="error-banner" role="alert"><AlertCircle size={17} /><span>{error}{invoices.length === 0 && " Check that the API and PostgreSQL database are running."}</span><button type="button" onClick={() => void loadInvoices()}>Try again</button><button type="button" className="dismiss-error" aria-label="Dismiss error" onClick={() => setError(null)}><X size={15} /></button></div>}

          <section className="workbench" aria-label="Invoices">
            <div className="invoice-list-panel">
              <div className="list-heading"><div><h2>Invoices</h2><span className="record-count">{filteredInvoices.length} records</span></div><button className="filter-button" type="button" aria-label="Filter invoices"><span>Filters</span><ChevronDown size={14} /></button></div>
              <div className="view-tabs" role="tablist" aria-label="Filter invoices by status">
                {views.map((view) => {
                  const count = view.id === "all" ? invoices.length : invoices.filter((invoice) => visibleInView(invoice, view.id)).length;
                  return <button key={view.id} className={`view-tab ${activeView === view.id ? "view-tab-active" : ""}`} type="button" role="tab" aria-selected={activeView === view.id} onClick={() => setActiveView(view.id)}><span>{view.label}</span><span className="tab-count">{count}</span></button>;
                })}
              </div>
              <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendor, invoice, project..." aria-label="Search invoices" /><kbd>/</kbd></label>

              <div className="invoice-columns" aria-hidden="true"><span>VENDOR / INVOICE</span><span>PROJECT</span><span>DUE DATE</span><span>AMOUNT</span><span>STATUS</span></div>
              <div className="invoice-rows" aria-live="polite">
                {loading ? <div className="list-state"><span className="loading-mark" /><span>Loading invoices</span></div> : filteredInvoices.length === 0 ? <div className="list-state empty-state"><Inbox size={23} /><strong>{invoices.length === 0 ? "No invoices available" : "No matching invoices"}</strong><span>{invoices.length === 0 ? "Connect the API and seed the database to start reviewing." : "Try a different search or status filter."}</span></div> : filteredInvoices.map((invoice) => (
                  <button type="button" key={invoice.id} className={`invoice-row ${selectedId === invoice.id ? "invoice-row-selected" : ""}`} onClick={() => setSelectedId(invoice.id)} aria-pressed={selectedId === invoice.id}>
                    <span className="vendor-cell"><span className={`vendor-avatar vendor-${invoice.vendorName.charCodeAt(0) % 5}`}>{invoice.vendorName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</span><span className="vendor-info"><strong>{invoice.vendorName}</strong><small>{invoice.invoiceNumber}{invoice.isDuplicate && <span className="duplicate-dot" title="Potential duplicate invoice" aria-label="Potential duplicate"> · DUPLICATE</span>}</small></span></span>
                    <span className="project-cell">{invoice.projectName}</span>
                    <span className="due-cell">{formatDate(invoice.dueDate)}</span>
                    <span className="amount-cell">{currency.format(Number(invoice.total))}</span>
                    <span className={`status-pill status-${invoice.status.toLocaleLowerCase().replaceAll("_", "-")}`}><span />{statusText(invoice.status)}</span>
                  </button>
                ))}
              </div>
              <div className="list-footer"><span>Showing {filteredInvoices.length} of {invoices.length} invoices</span><div className="pagination"><button className="icon-button" type="button" disabled aria-label="Previous page"><ArrowLeft size={15} /></button><span>1</span><button className="icon-button" type="button" disabled aria-label="Next page"><ArrowRight size={15} /></button></div></div>
            </div>

            <aside className="detail-panel" aria-label="Invoice details">
              {selectedInvoice ? <>
                <div className="detail-topline"><span>INVOICE DETAILS</span><button className="icon-button detail-more" type="button" aria-label="More invoice options"><span>···</span></button></div>
                <div className="detail-vendor"><span className={`vendor-avatar vendor-avatar-large vendor-${selectedInvoice.vendorName.charCodeAt(0) % 5}`}>{selectedInvoice.vendorName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</span><div><h2>{selectedInvoice.vendorName}</h2></div></div>
                <div className="detail-invoice-title"><div><span className="detail-label">INVOICE</span><strong>{selectedInvoice.invoiceNumber}</strong></div><span className={`status-pill status-${selectedInvoice.status.toLocaleLowerCase().replaceAll("_", "-")}`}><span />{statusText(selectedInvoice.status)}</span></div>
                {selectedInvoice.isDuplicate && <div className="duplicate-alert"><AlertCircle size={17} /><span><strong>Possible duplicate</strong><small>{selectedInvoice.duplicateOf ? `Matches invoice ${invoices.find((invoice) => invoice.id === selectedInvoice.duplicateOf)?.invoiceNumber ?? selectedInvoice.duplicateOf.slice(0, 8)}` : "Same vendor and invoice number found."}</small></span></div>}
                <div className="detail-meta-grid"><div><span className="detail-label">INVOICE DATE</span><strong>{formatDate(selectedInvoice.invoiceDate)}</strong></div><div><span className="detail-label">DUE DATE</span><strong>{formatDate(selectedInvoice.dueDate)}</strong></div><div className="meta-project"><span className="detail-label">PROJECT</span><strong>{selectedInvoice.projectName}</strong></div></div>
                <div className="line-items-section"><div className="section-title"><h3>Line items</h3><span>{selectedInvoice.lineItems.length} items</span></div><div className="line-item-head"><span>DESCRIPTION</span><span>QTY</span><span>AMOUNT</span></div>{selectedInvoice.lineItems.map((item) => <div className="line-item" key={item.id}><span><strong>{item.description}</strong><small>{currency.format(Number(item.unitPrice))} / unit</small></span><span>{Number(item.quantity).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span><strong>{currency.format(Number(item.amount))}</strong></div>)}</div>
                <div className="totals"><div><span>Subtotal</span><span>{currency.format(Number(selectedInvoice.subtotal))}</span></div><div><span>Tax</span><span>{currency.format(Number(selectedInvoice.tax))}</span></div><div className="total-row"><strong>Total due</strong><strong>{currency.format(Number(selectedInvoice.total))}</strong></div></div>
                {selectedInvoice.status === "NEEDS_REVIEW" ? <div className="decision-actions"><button className="reject-button" type="button" disabled={workingId === selectedInvoice.id} onClick={() => void updateStatus(selectedInvoice, "REJECTED")}><X size={16} /> Reject</button><button className="approve-button" type="button" disabled={workingId === selectedInvoice.id} onClick={() => void updateStatus(selectedInvoice, "APPROVED")}>{workingId === selectedInvoice.id ? <span className="button-spinner" /> : <Check size={16} />} Approve invoice</button></div> : <div className={`decision-note ${selectedInvoice.status === "APPROVED" ? "decision-approved" : ""}`}>{selectedInvoice.status === "APPROVED" ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}<span>{selectedInvoice.status === "APPROVED" ? "This invoice has been approved." : selectedInvoice.status === "REJECTED" ? "This invoice has been rejected." : "This invoice is still being processed."}</span></div>}
              </> : <div className="detail-empty"><FileText size={25} /><strong>Select an invoice</strong><span>Choose an invoice from the list to review its details.</span></div>}
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
