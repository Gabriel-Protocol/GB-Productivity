/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DailyRecord, UserConfig } from "../types";
import { saveDailyRecord, saveUserConfig } from "../lib/firebase";
import { 
  Download, 
  Upload, 
  FileText, 
  Table, 
  FileJson, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Sparkles, 
  RefreshCw 
} from "lucide-react";

interface ExportViewProps {
  userId: string;
  config: UserConfig;
  daysData: Record<string, DailyRecord>;
  onDataImported: (newConfig: UserConfig, newDaysData: Record<string, DailyRecord>) => void;
}

export default function ExportView({
  userId,
  config,
  daysData,
  onDataImported
}: ExportViewProps) {
  // Export Settings State
  const [includeProductive, setIncludeProductive] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [evaluationText, setEvaluationText] = useState("");

  // UI Status State
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // Helper: Retrieve month text in Indonesia
  const indonesianMonths = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // 1. Export as Spreadsheet (CSV)
  const handleExportCSV = () => {
    try {
      if (!includeProductive && !includeHabits) {
        setStatus({ type: "error", text: "Silakan pilih setidaknya satu tab data untuk diekspor!" });
        return;
      }

      let csvLines: string[] = [];

      // Add Metadata and Evaluation section
      csvLines.push("=== RIWAYAT PRODUKTIVITAS & HABITS ===");
      csvLines.push(`Disiapkan pada: ${new Date().toLocaleDateString("id-ID")} - ${new Date().toLocaleTimeString("id-ID")}`);
      csvLines.push("");

      if (evaluationText.trim()) {
        csvLines.push("=== EVALUASI DAN CATATAN ===");
        // Clean linebreaks for CSV cells
        const escapedEval = evaluationText.replace(/"/g, '""');
        csvLines.push(`"${escapedEval}"`);
        csvLines.push("");
      }

      // Headers row
      let headers = ["Tanggal"];
      if (includeProductive) {
        headers.push("Jam Produktif", "Indikator Produktivitas");
      }
      if (includeHabits) {
        headers.push("Jumlah Habits Selesai", "Daftar Kegiatan Selesai");
      }
      csvLines.push(headers.join(","));

      // Sort chronological dates
      const sortedKeys = Object.keys(daysData).sort();

      if (sortedKeys.length === 0) {
        // Fallback row if no logs exist
        csvLines.push("Belum ada data tercatat");
      } else {
        sortedKeys.forEach((dateKey) => {
          const record = daysData[dateKey];
          let row = [dateKey];

          if (includeProductive) {
            const hours = record.hours || 0;
            let statusLabel = "N/A";
            if (hours > 0) {
              if (hours <= config.thresholdVeryBad) statusLabel = "Sangat Jelek";
              else if (hours <= config.thresholdBad) statusLabel = "Jelek";
              else if (hours <= config.thresholdFair) statusLabel = "Cukup";
              else statusLabel = "Bagus";
            }
            row.push(String(hours), `"${statusLabel}"`);
          }

          if (includeHabits) {
            const items = record.completedHabits || [];
            const count = items.length;
            // Map items code to readable item labels
            const labels = items.map((ref) => {
              const parts = ref.split("::");
              return parts[1] || parts[0];
            });
            row.push(String(count), `"${labels.join("; ")}"`);
          }

          csvLines.push(row.join(","));
        });
      }

      // Compile CSV blob and trigger downloading action
      const csvContent = "\ufeff" + csvLines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `GB_Productivity_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus({ type: "success", text: "Download Spreadsheet (.CSV) berhasil dimulai!" });
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      console.error(e);
      setStatus({ type: "error", text: "Terjadi kesalahan sistem saat memproses CSV." });
    }
  };

  // 2. Export / Print PDF Summary Report
  const handlePrintPDF = () => {
    try {
      // Create a print block overlay
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setStatus({ type: "error", text: "Gagal membuka jendela cetak. Pastikan izin pop-up browser aktif!" });
        return;
      }

      // Pre-compile productivity stats
      let totalHours = 0;
      let loggedDays = 0;
      const sortedDates = Object.keys(daysData).sort();

      sortedDates.forEach(k => {
        if (daysData[k].hours && daysData[k].hours > 0) {
          totalHours += daysData[k].hours;
          loggedDays++;
        }
      });

      const avgHours = loggedDays > 0 ? (totalHours / loggedDays).toFixed(1) : "0.0";

      // Render print markup
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>GB - Productivity Report Summary</title>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 11px; text-transform: uppercase; tracking-wider; font-weight: bold; color: #0d9488; margin-top: 4px; }
            .meta { font-size: 12px; color: #64748b; margin-top: 10px; }
            .section { margin-bottom: 35px; }
            .section-title { font-size: 15px; font-weight: bold; color: #0d9488; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 15px; text-transform: uppercase; }
            .card { background: #f8fafc; border: 1px solid #f1f5f9; padding: 15px 20px; border-radius: 12px; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
            .stat-box { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 12px; text-align: center; }
            .stat-val { font-size: 20px; font-weight: 800; color: #0d9488; }
            .stat-lbl { font-size: 10px; text-transform: uppercase; color: #475569; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { text-align: left; padding: 10px; background: #f1f5f9; font-weight: bold; border-bottom: 1px solid #cbd5e1; }
            td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; }
            .badge-b { background: #10b981; color: white; }
            .badge-c { background: #0d9488; color: white; }
            .badge-j { background: #f59e0b; color: #1e293b; }
            .badge-sj { background: #f43f5e; color: white; }
            .eval-text { font-style: italic; white-space: pre-wrap; color: #334155; font-size: 13px; font-family: Georgia, serif; line-height: 1.6; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">GB - PRODUCTIVITY</h1>
            <div class="subtitle">WORKSPACE INDONESIA - LAPORAN EVALUASI</div>
            <div class="meta">
              Dicetak pada: ${new Date().toLocaleDateString("id-ID")} &bull; Sumber Database: Google Firebase Cloud
            </div>
          </div>

          ${evaluationText.trim() ? `
          <div class="section">
            <div class="section-title">Evaluasi Harian & Catatan Tambahan</div>
            <div class="card">
              <div class="eval-text">"${evaluationText}"</div>
            </div>
          </div>
          ` : ""}

          ${includeProductive ? `
          <div class="section">
            <div class="section-title">Metrik Jam Produktif harian</div>
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-val">${totalHours.toFixed(1)}</div>
                <div class="stat-lbl">Jam Produktif Diisi</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">${loggedDays} Hari</div>
                <div class="stat-lbl">Hari Terisi</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">${avgHours} jam/hari</div>
                <div class="stat-lbl">Rata-rata Harian</div>
              </div>
            </div>
          </div>
          ` : ""}

          <div class="section">
            <div class="section-title">Log Rincian Riwayat Harian</div>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  ${includeProductive ? `<th>Jam Produktif</th><th>Indikator</th>` : ""}
                  ${includeHabits ? `<th>Habits Selesai</th><th>Kegiatan Selesai</th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${sortedDates.length === 0 ? `
                  <tr><td colspan="5" style="text-align:center;">Belum ada catatan aktivitas harian yang ditemukan</td></tr>
                ` : sortedDates.map(dateKey => {
                  const r = daysData[dateKey];
                  const hrs = r.hours || 0;
                  
                  let badge = "";
                  if (hrs > 0) {
                    if (hrs <= config.thresholdVeryBad) badge = '<span class="badge badge-sj">Sangat Jelek</span>';
                    else if (hrs <= config.thresholdBad) badge = '<span class="badge badge-j">Jelek</span>';
                    else if (hrs <= config.thresholdFair) badge = '<span class="badge badge-c">Cukup</span>';
                    else badge = '<span class="badge badge-b">Bagus</span>';
                  }

                  const habitsComplete = r.completedHabits || [];
                  const count = habitsComplete.length;
                  const readableNames = habitsComplete.map(ref => ref.split("::")[1] || ref.split("::")[0]).join("; ");

                  return `
                    <tr>
                      <td style="font-weight:bold;">${dateKey}</td>
                      ${includeProductive ? `
                        <td>${hrs > 0 ? hrs + " j" : "-"}</td>
                        <td>${hrs > 0 ? badge : "-"}</td>
                      ` : ""}
                      ${includeHabits ? `
                        <td style="font-weight:bold; color: #0d9488;">${count > 0 ? count + " selesai" : "-"}</td>
                        <td style="color:#64748b; font-size:11px;">${readableNames || "-"}</td>
                      ` : ""}
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>

          <div style="text-align: center; margin-top: 50px;">
            <button onclick="window.print()" style="padding: 12px 24px; background: #0d9488; color: white; border: none; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 14px;">
              Cetak Laporan / Simpan PDF
            </button>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setStatus({ type: "success", text: "Preview cetak PDF dibuka!" });
      setTimeout(() => setStatus(null), 3500);
    } catch (e) {
      setStatus({ type: "error", text: "Gagal memproses ekspor PDF." });
    }
  };

  // 3. Export full raw JSON backup
  const handleExportJSON = () => {
    try {
      const fullBackup = {
        app: "gb-productivity",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        config: config,
        daysData: daysData
      };

      const jsonString = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `GB_Productivity_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus({ type: "success", text: "Ekspor seluruh cadangan (.JSON) berhasil diunduh!" });
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: "error", text: "Terjadi galat ketika mengekspor cadangan JSON." });
    }
  };

  // 4. Import / Upload raw JSON Backup and sync back to Firestore
  const handleImportJSONClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus(null);

    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Validation check
        if (!parsed.config || !parsed.daysData) {
          throw new Error("Struktur berkas cadangan JSON tidak valid! Berkas harus berisi objek 'config' dan 'daysData'.");
        }

        // Merge and restore each Firestore configuration
        await saveUserConfig(userId, parsed.config);

        // Upload days in batches to user firestore
        const keys = Object.keys(parsed.daysData);
        for (const dateKey of keys) {
          await saveDailyRecord(userId, dateKey, parsed.daysData[dateKey]);
        }

        setStatus({ type: "success", text: "Data cadangan sukses diimpor dan disinkronkan ke cloud! Memuat ulang halaman..." });
        
        // Notify parent state
        onDataImported(parsed.config, parsed.daysData);

        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err: any) {
        console.error("Gagal melakukan impor data:", err);
        setStatus({ type: "error", text: err.message || "Gagal mengurai file JSON. Pastikan file valid." });
      } finally {
        setImporting(false);
        // Clear input element
        e.target.value = "";
      }
    };

    fileReader.readAsText(file);
  };

  return (
    <div className="space-y-6" id="export-data-view">
      {status && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border flex gap-3 items-center ${
            status.type === "success"
              ? "bg-teal-50 border-teal-100 text-teal-800"
              : "bg-rose-50 border-rose-100 text-brand-wine"
          }`}
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{status.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COMPONENT: Export Form Controls */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileText className="w-5 h-5 text-brand-teal animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Ekspor Laporan & Cadangan</h3>
              <p className="text-[10px] text-slate-400">Pilih rentang data, tulis evaluasi, atau unduh cadangan harian</p>
            </div>
          </div>

          {/* Tab selection selectors */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
              1. Pilih Tab Data yang Diekspor:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIncludeProductive(!includeProductive)}
                className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 outline-none cursor-pointer ${
                  includeProductive
                    ? "border-brand-teal bg-brand-teal/5 text-brand-teal font-extrabold"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {includeProductive && <Check className="w-3.5 h-3.5" />}
                Jam Produktif
              </button>

              <button
                onClick={() => setIncludeHabits(!includeHabits)}
                className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 outline-none cursor-pointer ${
                  includeHabits
                    ? "border-brand-teal bg-brand-teal/5 text-brand-teal font-extrabold"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {includeHabits && <Check className="w-3.5 h-3.5" />}
                Habits Pelacak
              </button>
            </div>
          </div>

          {/* Custom Evaluation Text Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
              2. Tambahkan Teks Evaluasi (opsional):
            </label>
            <textarea
              placeholder="Tuliskan catatan evaluasi harian, refleksi mingguan, atau hambatan Anda di sini. Catatan ini akan disisipkan di atas baris tabel ketika dicetak atau diekspor ke Spreadsheet."
              value={evaluationText}
              onChange={(e) => setEvaluationText(e.target.value)}
              rows={5}
              className="w-full text-xs p-3 text-slate-700 placeholder-slate-400 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Formatted File Download Buttons */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
              3. Unduh Laporan:
            </label>
            <div className="space-y-2.5">
              {/* Spreadsheet CSV */}
              <button
                onClick={handleExportCSV}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 transition outline-none cursor-pointer shadow-sm"
              >
                <Table className="w-4 h-4" />
                <span>Unduh Laporan Spreadsheet (.CSV)</span>
              </button>

              {/* Print Printable Report */}
              <button
                onClick={handlePrintPDF}
                className="w-full py-3 px-4 bg-brand-wine hover:bg-brand-wine/90 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 transition outline-none cursor-pointer shadow-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Cetak Ringkasan Laporan & PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COMPONENT: JSON Backup & Safe Recovery */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileJson className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Full Backup Sistem & Restore (.JSON)</h3>
                <p className="text-[10px] text-slate-400">Pindahkan seluruh riwayat catatan dan pengaturan habits Anda secara manual ke perangkat lain</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export JSON backup button */}
              <div className="p-4 border border-indigo-50/60 bg-indigo-50/20 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-700">Ekspor File Cadangan</h4>
                <p className="text-[11px] text-slate-500 leading-normal">Unduh seluruh konfigurasi rules targets, dan log days data ke satu file text JSON.</p>
                <button
                  onClick={handleExportJSON}
                  className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Cadangkan Sekarang
                </button>
              </div>

              {/* Import recovery JSON backup form */}
              <div className="p-4 border border-slate-200/80 bg-slate-50/40 rounded-xl space-y-3 relative overflow-hidden">
                <h4 className="text-xs font-bold text-slate-700">Impor & Pulihkan Data</h4>
                <p className="text-[11px] text-slate-500 leading-normal">Pilih file backup (.JSON) untuk memulihkan seluruh data dan menyinkronkannya kembali ke cloud.</p>
                
                <div className="mt-1">
                  <label className="inline-flex items-center py-2 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-350 rounded-lg text-xs font-bold cursor-pointer transition gap-1.5 shadow-sm">
                    {importing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-teal" />
                        Memproses Impor...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-slate-450" />
                        Unggah File Cadangan (.json)
                      </>
                    )}
                    <input
                      type="file"
                      accept=".json"
                      disabled={importing}
                      onChange={handleImportJSONClick}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Quick interactive Preview Panel */}
          <div className="bg-slate-50/60 p-5 border border-slate-100 rounded-2xl space-y-3">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              Pratinjau Hasil Laporan Tercetak:
            </span>
            <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-inner max-h-[300px] overflow-y-auto space-y-3 relative text-[11px] text-slate-600">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center bg-slate-50/20 px-2 rounded">
                <span className="font-bold text-slate-700">GP - PRODUCTIVITY REPORT SUMMARY</span>
                <span className="text-[8px] font-mono text-slate-450">TAMPILAN DRAUGHT</span>
              </div>

              {evaluationText.trim() ? (
                <div className="p-2.5 bg-slate-50 rounded italic border-l-2 border-brand-teal">
                  "{evaluationText}"
                </div>
              ) : (
                <div className="p-2 text-slate-400 italic text-center">
                  (Tulis teks evaluasi di sebelah kiri untuk melihat pratinjau di sini)
                </div>
              )}

              <div className="space-y-1">
                <span className="font-bold text-slate-700 block">Riwayat Aktivitas Harian:</span>
                <div className="border border-slate-100 rounded overflow-hidden">
                  <div className="grid grid-cols-3 bg-slate-100/55 p-1.5 font-bold text-[10px] text-slate-500">
                    <div>Tanggal</div>
                    <div>Jam Produktif</div>
                    <div>Habits</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Object.keys(daysData).length === 0 ? (
                      <div className="p-2 text-center text-slate-400">Belum ada aktivitas terekam</div>
                    ) : (
                      Object.keys(daysData).slice(0, 3).map((k) => (
                        <div key={k} className="grid grid-cols-3 p-1.5 text-[10px]">
                          <div>{k}</div>
                          <div>{daysData[k].hours || 0}j</div>
                          <div>{daysData[k].completedHabits?.length || 0} selesai</div>
                        </div>
                      ))
                    )}
                    {Object.keys(daysData).length > 3 && (
                      <div className="p-1 text-center text-slate-400 text-[9px]">...dan {Object.keys(daysData).length - 3} baris lainnya</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
