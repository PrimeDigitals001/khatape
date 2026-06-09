import { useEffect, useState } from "react";
import { adminAPI } from "../services/adminAPI";
import { isModuleOn } from "../services/session";
import { importCustomers as validateBatch } from "../lib/bulkImport";

// Parse pasted CSV/TSV text → rows for the bulk-import lib.
// Expected columns: name, phone, opening balance (₹). A header row is skipped.
const parseRows = (text) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  lines.forEach((line, i) => {
    const cells = line.split(/[\t,]/).map((c) => c.trim());
    if (i === 0 && /name/i.test(cells[0] || "")) return; // skip header
    const [name, phone, opening] = cells;
    if (!name && !phone) return;
    const bal = opening ? parseFloat(opening) : 0;
    rows.push({
      name: name || "",
      phone: phone || "",
      openingBalancePaise: bal && bal > 0 ? Math.round(bal * 100) : 0,
    });
  });
  return rows;
};

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function BulkImport() {
  const [enabled, setEnabled] = useState(null);

  // import
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null); // result of validateBatch
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [importErr, setImportErr] = useState(null);

  // export
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState(null);

  useEffect(() => {
    isModuleOn("bulk_import").then(setEnabled).catch(() => setEnabled(false));
  }, []);

  const runPreview = () => {
    setImportMsg(null);
    setImportErr(null);
    const rows = parseRows(text);
    if (rows.length === 0) {
      setImportErr("Nothing to import — paste rows as: name, phone, opening balance");
      setPreview(null);
      return;
    }
    setPreview(validateBatch(rows));
  };

  const doImport = async () => {
    if (!preview || preview.validCount === 0) return;
    try {
      setImporting(true);
      setImportErr(null);
      const res = await adminAPI.importCustomers(preview.valid);
      setImportMsg(
        `Imported ${res.data.created} customer(s)` +
          (res.data.openingBalances ? `, ${res.data.openingBalances} with opening balance.` : ".") +
          " Assign RFID cards later from the Customers page (Edit → tap card)."
      );
      setText("");
      setPreview(null);
    } catch (e) {
      setImportErr(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const doExport = async () => {
    try {
      setExporting(true);
      setExportErr(null);
      const [custRes, balances] = await Promise.all([
        adminAPI.getCustomers(1, 1000000, ""),
        adminAPI.getTenantBalances(),
      ]);
      const customers = custRes.data.customers;
      const header = ["Customer ID", "Name", "Phone", "RFID", "Due (Rs)"];
      const lines = [header.map(csvCell).join(",")];
      customers.forEach((c) => {
        const due = balances[c.id]?.due || 0;
        lines.push([c.customerId, c.name, c.phone || "", c.rfid || "", due].map(csvCell).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (enabled === false) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-black mb-2">Import / Export is off for this shop</h2>
          <p className="text-sm text-gray-500">
            Enable the <span className="font-medium">Bulk customer import</span> module from the operator console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 overflow-y-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-1">Import / Export</h1>
      <p className="text-xs text-gray-500 mb-6">Migrate an existing customer list in, or back your data out.</p>

      <div className="max-w-2xl space-y-6">
        {/* Import */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-black mb-1">Import customers</h2>
          <p className="text-xs text-gray-500 mb-3">
            Paste rows from Excel/Sheets — <code>name, phone, opening balance (₹)</code>, one per line.
            RFID is <b>not</b> imported; assign cards later by tapping (Customers → Edit).
          </p>

          {importMsg && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{importMsg}</div>}
          {importErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{importErr}</div>}

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setPreview(null); }}
            rows={7}
            placeholder={"Ramesh Patel, 9812345678, 250\nSita Sharma, 9898989898, 0\nMohan, 9700000000, 1200"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
          />

          <div className="flex items-center gap-3 mt-3">
            <button onClick={runPreview} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Check rows
            </button>
            {preview && (
              <span className="text-sm text-gray-600">
                <b className="text-green-700">{preview.validCount}</b> valid ·{" "}
                <b className={preview.invalidCount ? "text-red-600" : "text-gray-500"}>{preview.invalidCount}</b> invalid
              </span>
            )}
          </div>

          {/* invalid reasons */}
          {preview && preview.invalidCount > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto bg-red-50/50 border border-red-100 rounded-lg p-3 text-xs text-red-700 space-y-1">
              {preview.invalid.slice(0, 20).map((iv) => (
                <div key={iv.index}>
                  Row {iv.index + 1} ({iv.row.name || "—"}): {iv.errors.join(", ")}
                </div>
              ))}
              {preview.invalidCount > 20 && <div>…and {preview.invalidCount - 20} more</div>}
            </div>
          )}

          {preview && preview.validCount > 0 && (
            <button
              onClick={doImport}
              disabled={importing}
              className="mt-4 bg-[#E54A4A] hover:bg-[#d63939] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${preview.validCount} customer(s)`}
            </button>
          )}
        </div>

        {/* Export */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-black mb-1">Export customers</h2>
          <p className="text-xs text-gray-500 mb-3">
            Download every customer with their current due as a CSV (backup / your data, no lock-in).
          </p>
          {exportErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{exportErr}</div>}
          <button
            onClick={doExport}
            disabled={exporting}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? "Preparing…" : "Download customers CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}
