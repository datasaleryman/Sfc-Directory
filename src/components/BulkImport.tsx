import React, { useState } from 'react';
import { FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, ArrowLeftRight, HelpCircle, Save, Undo2 } from 'lucide-react';
import { ParseResult, BulkPreviewResponse } from '../types.js';

interface BulkImportProps {
  authToken: string;
  onImportComplete: () => void;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export const BulkImport: React.FC<BulkImportProps> = ({
  authToken,
  onImportComplete,
  onCancel,
  showToast
}) => {
  const [inputText, setInputText] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<BulkPreviewResponse | null>(null);
  
  // Save States
  const [importOption, setImportOption] = useState<'skip_invalid' | 'replace_duplicate' | 'save_all'>('skip_invalid');
  const [savingRecords, setSavingRecords] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    saved: number;
    replaced: number;
    skipped: number;
  } | null>(null);

  // Trigger Bulk Preview Parsing
  const handleGeneratePreview = async () => {
    if (!inputText.trim()) {
      showToast('Please paste or write some contact records first.', 'warning');
      return;
    }

    setLoadingPreview(true);
    setPreviewData(null);
    setImportSummary(null);

    try {
      const res = await fetch('/api/contacts/bulk-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ text: inputText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze bulk list.');
      }

      setPreviewData(data);
      showToast('Successfully analyzed bulk list and generated a live preview.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Commit Bulk Save to Database
  const handleCommitImport = async () => {
    if (!previewData || previewData.results.length === 0) {
      showToast('No preview records available to import.', 'warning');
      return;
    }

    setSavingRecords(true);
    try {
      const res = await fetch('/api/contacts/bulk-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          items: previewData.results,
          option: importOption
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete bulk import.');
      }

      setImportSummary(data);
      showToast(`Bulk Entry Complete! Saved ${data.saved} contact records.`, 'success');
      setInputText(''); // Reset text box on successful import
      onImportComplete(); // Trigger stats reload on dashboard
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingRecords(false);
    }
  };

  const handleReset = () => {
    setPreviewData(null);
    setImportSummary(null);
    setInputText('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-base sm:text-lg font-display">
              Bulk Entry Import Module
            </h4>
            <p className="text-xs text-slate-500">
              Paste delimited lists copied from text documents, CSVs, or spreadsheet cells.
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="w-full sm:w-auto text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 transition-all cursor-pointer text-center"
        >
          Back to Dashboard
        </button>
      </div>

      {!previewData && !importSummary && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-100 p-3.5 sm:p-4 rounded-xl space-y-2">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
              Supported Text Formats & Required Fields
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              We automatically detect <strong>Pipe-separated</strong>, <strong>Comma-separated (CSV)</strong>, and <strong>Tab-separated (Excel copies)</strong> formats. One contact per line. 
              Only the <strong>Full Name</strong> is required; Barangay, Purok, and Contact Number are fully optional. If Barangay is omitted, it defaults to <strong>Barangay Central</strong>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-150">
              <div>
                <p className="font-semibold text-indigo-600 mb-0.5">Pipe-Separated:</p>
                <code>Name | [Barangay] [| Purok] [| Number]</code>
                <code className="block text-[10px] text-slate-400 mt-1">e.g. Juan Dela Cruz | Brgy 1 | |<br/>e.g. Clara Smith (Simple Name only)</code>
              </div>
              <div>
                <p className="font-semibold text-emerald-600 mb-0.5">Comma-Separated (CSV):</p>
                <code>Name,[Barangay],[Purok],[Number]</code>
                <code className="block text-[10px] text-slate-400 mt-1">e.g. Maria Santos,Brgy 2,,<br/>e.g. Johnny Doe (Single cell value)</code>
              </div>
              <div>
                <p className="font-semibold text-amber-600 mb-0.5">Excel Tabs (Tabbed):</p>
                <code>Name[Tab][Barangay][Tab][Purok][Tab][Number]</code>
                <code className="block text-[10px] text-slate-400 mt-1">e.g. Pedro Reyes[Tab]Brgy 3[Tab][Tab]<br/>e.g. Copy-pasted Excel columns</code>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Paste Delimited Contact Records Below
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="w-full p-3.5 sm:p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl transition-all text-slate-800 text-sm font-mono outline-none placeholder:text-slate-400 leading-relaxed"
              placeholder="Example:&#10;Juan Dela Cruz | Barangay San Jose | Purok 4 | 09171234567&#10;Maria Santos | Barangay Pag-asa&#10;Pedro Reyes (Omitted Barangay will default to Barangay Central)&#10;Lina Gomez | | Purok 2"
              disabled={loadingPreview}
            />
          </div>

          <button
            onClick={handleGeneratePreview}
            disabled={loadingPreview}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            {loadingPreview ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Formats...
              </>
            ) : (
              'Analyze and Generate Preview'
            )}
          </button>
        </div>
      )}

      {/* Preview Section */}
      {previewData && !importSummary && (
        <div className="space-y-5 sm:space-y-6">
          {/* Analysis Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
            <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Detected Delimiter</span>
              <span className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5 sm:mt-1 block">{previewData.detectedSeparator}</span>
            </div>
            <div className="bg-blue-50/50 p-2.5 sm:p-3 rounded-xl border border-blue-100 text-center">
              <span className="block text-[10px] font-bold text-blue-500 uppercase">Total Loaded</span>
              <span className="text-sm sm:text-base font-bold text-blue-700 mt-0.5 sm:mt-1 block">{previewData.summary.total}</span>
            </div>
            <div className="bg-emerald-50/50 p-2.5 sm:p-3 rounded-xl border border-emerald-100 text-center">
              <span className="block text-[10px] font-bold text-emerald-500 uppercase">✓ Valid Records</span>
              <span className="text-sm sm:text-base font-bold text-emerald-700 mt-0.5 sm:mt-1 block">{previewData.summary.valid}</span>
            </div>
            <div className="bg-amber-50/50 p-2.5 sm:p-3 rounded-xl border border-amber-100 text-center">
              <span className="block text-[10px] font-bold text-amber-500 uppercase">⚠ Duplicates</span>
              <span className="text-sm sm:text-base font-bold text-amber-700 mt-0.5 sm:mt-1 block">{previewData.summary.duplicate}</span>
            </div>
            <div className="bg-rose-50/50 p-2.5 sm:p-3 rounded-xl border border-rose-100 text-center col-span-2 sm:col-span-1">
              <span className="block text-[10px] font-bold text-rose-500 uppercase">✖ Invalids</span>
              <span className="text-sm sm:text-base font-bold text-rose-700 mt-0.5 sm:mt-1 block">{previewData.summary.invalid}</span>
            </div>
          </div>

          {/* Import Behavior Action Selection */}
          <div className="bg-slate-50 border border-slate-150 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <h5 className="font-bold text-slate-700 text-xs sm:text-sm">Choose Import Conflict Behavior</h5>
              <p className="text-xs text-slate-500">Configure how duplicates and invalids are managed.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setImportOption('skip_invalid')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                  importOption === 'skip_invalid'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Skip Invalid & Duplicates
              </button>
              <button
                type="button"
                onClick={() => setImportOption('replace_duplicate')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                  importOption === 'replace_duplicate'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Replace Barangay/Purok
              </button>
              <button
                type="button"
                onClick={() => setImportOption('save_all')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                  importOption === 'save_all'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Force Save All Valid
              </button>
            </div>
          </div>

          {/* Preview Table Container */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            {/* Desktop Table View */}
            <div className="hidden md:block max-h-[300px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Status</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Barangay</th>
                    <th className="py-3 px-4">Purok</th>
                    <th className="py-3 px-4">Contact Number</th>
                    <th className="py-3 px-4">Notes / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {(previewData.results || []).map((item, index) => {
                    const icon = {
                      valid: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                      duplicate: <AlertTriangle className="w-4 h-4 text-amber-500" />,
                      invalid: <XCircle className="w-4 h-4 text-rose-500" />
                    }[item.status];

                    const rowBg = {
                      valid: 'hover:bg-slate-50/50',
                      duplicate: 'bg-amber-50/10 hover:bg-amber-50/25',
                      invalid: 'bg-rose-50/10 hover:bg-rose-50/25'
                    }[item.status];

                    return (
                      <tr key={index} className={`transition-colors ${rowBg}`}>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex justify-center">{icon}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {item.full_name || <span className="text-slate-400 italic font-normal">Blank</span>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {item.barangay || <span className="text-slate-400 italic font-normal">Blank</span>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {item.purok || <span className="text-slate-300 font-light italic">None</span>}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                          {item.contact_number || <span className="text-slate-400 italic">Blank</span>}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {item.status === 'valid' ? (
                            <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">Ready to Save</span>
                          ) : item.status === 'duplicate' ? (
                            <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full">{item.reason}</span>
                          ) : (
                            <span className="text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded-full">{item.reason}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards List View */}
            <div className="block md:hidden max-h-[350px] overflow-y-auto divide-y divide-slate-100">
              {(previewData.results || []).map((item, index) => {
                const icon = {
                  valid: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
                  duplicate: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
                  invalid: <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                }[item.status];

                const cardBg = {
                  valid: 'bg-white',
                  duplicate: 'bg-amber-50/20',
                  invalid: 'bg-rose-50/20'
                }[item.status];

                return (
                  <div key={index} className={`p-3.5 space-y-2 ${cardBg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {icon}
                        <span className="font-bold text-slate-800 text-sm truncate">
                          {item.full_name || <span className="text-slate-400 italic font-normal">Blank Name</span>}
                        </span>
                      </div>
                      <div className="shrink-0">
                        {item.status === 'valid' ? (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Ready</span>
                        ) : item.status === 'duplicate' ? (
                          <span className="text-[10px] text-amber-800 font-bold bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">Duplicate</span>
                        ) : (
                          <span className="text-[10px] text-rose-800 font-bold bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">Invalid</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Barangay</span>
                        <span className="font-semibold text-slate-700 truncate block">{item.barangay || 'Default (Central)'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Purok</span>
                        <span className="font-semibold text-slate-700 truncate block">{item.purok || '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100/80">
                      <span className="font-mono text-[11px] text-slate-500">{item.contact_number || 'No contact #'}</span>
                      {item.reason && <span className="text-[11px] text-slate-500 italic truncate max-w-[180px]">{item.reason}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={handleCommitImport}
              disabled={savingRecords}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              {savingRecords ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Directory Records...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Commit & Save {previewData.summary.valid} Records
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              disabled={savingRecords}
              className="w-full sm:w-auto px-5 py-3 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Undo2 className="w-4 h-4" />
              Reset Parser
            </button>
          </div>
        </div>
      )}

      {/* Import Success Summary Screen */}
      {importSummary && (
        <div className="bg-slate-50 border border-emerald-200 p-5 sm:p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-5 sm:space-y-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-600 shadow-xs">
            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h4 className="font-bold text-slate-800 text-lg sm:text-xl font-display">
              Bulk Import Completed Successfully
            </h4>
            <p className="text-xs sm:text-sm text-slate-500">
              Your bulk delimited records have been successfully parsed, sanitized, capitalized, and stored in the database.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 w-full max-w-xl shadow-xs text-center">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Delivered Rows</span>
              <span className="text-base sm:text-lg font-bold text-slate-700 block mt-1">{importSummary.total}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-emerald-500 uppercase">Saved to DB</span>
              <span className="text-base sm:text-lg font-bold text-emerald-700 block mt-1">{importSummary.saved}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-blue-500 uppercase">Replaced Dups</span>
              <span className="text-base sm:text-lg font-bold text-blue-700 block mt-1">{importSummary.replaced}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Skipped Rows</span>
              <span className="text-base sm:text-lg font-bold text-slate-500 block mt-1">{importSummary.skipped}</span>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            Import More Contacts
          </button>
        </div>
      )}
    </div>
  );
};
