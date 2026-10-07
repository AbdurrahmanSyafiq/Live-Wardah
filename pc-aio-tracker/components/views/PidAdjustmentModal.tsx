import React, { useState } from 'react';
import { formatIDR } from '@/lib/formatters';

export interface AdjustmentLogItem {
  id: string;
  date: string;
  pid: string;
  skuName: string;
  metric: string;
  adjustment: string;
  status: 'Pending' | 'Adjusted' | string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

interface AddAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    date: string;
    pid: string;
    skuName: string;
    metric: string;
    value?: number;
  };
  onSubmit: (data: {
    date: string;
    pid: string;
    skuName: string;
    metric: string;
    adjustment: string;
    userName: string;
  }) => Promise<void>;
  isDarkMode: boolean;
}

export function AddAdjustmentModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  isDarkMode
}: AddAdjustmentModalProps) {
  const [date, setDate] = useState(initialData?.date || '');
  const [pid, setPid] = useState(initialData?.pid || '');
  const [skuName, setSkuName] = useState(initialData?.skuName || '');
  const [metric, setMetric] = useState(initialData?.metric || 'Spend');
  const [adjustment, setAdjustment] = useState('');
  const [userName, setUserName] = useState('samuelgeorgiofc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (initialData) {
      setDate(initialData.date || '');
      setPid(initialData.pid || '');
      setSkuName(initialData.skuName || '');
      setMetric(initialData.metric || 'Spend');
    }
  }, [initialData, isOpen]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustment.trim()) {
      setError('Please provide adjustment notes.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        date,
        pid,
        skuName,
        metric,
        adjustment,
        userName: userName.trim() || 'User'
      });
      setAdjustment('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border ${
          isDarkMode ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-[#131d33]' : 'border-slate-100 bg-slate-50'}`}>
          <div>
            <h3 className="text-base font-bold">Add Performance Adjustment</h3>
            <p className="text-xs text-slate-400">Record operational notes and adjustment logs in Google Sheets.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={`w-full py-2 px-3 rounded-xl font-semibold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Metric</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className={`w-full py-2 px-3 rounded-xl font-semibold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="Spend">Spend</option>
                <option value="Ads GMV">Ads GMV</option>
                <option value="Sales">Sales</option>
                <option value="ROAS">ROAS</option>
                <option value="CIR">CIR</option>
                <option value="General">General / Strategy</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product ID (PID)</label>
            <input
              type="text"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              required
              className={`w-full py-2 px-3 rounded-xl font-mono border outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">SKU Name</label>
            <input
              type="text"
              value={skuName}
              onChange={(e) => setSkuName(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl font-semibold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Adjustment Notes / Action Plan
            </label>
            <textarea
              rows={4}
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="e.g. Budget increased by 20% due to ROAS > 10x; SKU ranking pushed to top 3."
              required
              className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Submitted By</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              className={`w-full py-2 px-3 rounded-xl font-semibold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving to Sheet...
                </>
              ) : (
                'Save Adjustment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdjustmentLogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AdjustmentLogItem[];
  onUpdateStatus: (id: string, newStatus: 'Pending' | 'Adjusted', userName: string) => Promise<void>;
  isDarkMode: boolean;
}

export function AdjustmentLogsDrawer({
  isOpen,
  onClose,
  logs,
  onUpdateStatus,
  isDarkMode
}: AdjustmentLogsDrawerProps) {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredLogs = logs.filter(log => {
    if (filterStatus !== 'All' && log.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.pid.toLowerCase().includes(q) ||
        log.skuName.toLowerCase().includes(q) ||
        log.adjustment.toLowerCase().includes(q) ||
        log.metric.toLowerCase().includes(q) ||
        log.createdBy.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleToggleStatus = async (item: AdjustmentLogItem) => {
    const targetStatus = item.status === 'Adjusted' ? 'Pending' : 'Adjusted';
    setUpdatingId(item.id);
    try {
      await onUpdateStatus(item.id, targetStatus as any, 'samuelgeorgiofc');
    } catch (err) {
      alert('Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
          isDarkMode ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-[#131d33]' : 'border-slate-100 bg-slate-50'}`}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Adjustment Logs</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {logs.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Operational track records stored in sheet &apos;Adjustment Logs&apos;. Update status to collaborate seamlessly.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Filters */}
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${isDarkMode ? 'border-slate-800 bg-[#0c1222]' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-2">
            {(['All', 'Pending', 'Adjusted'] as string[]).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterStatus === st
                    ? st === 'Adjusted'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : st === 'Pending'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : isDarkMode
                    ? 'bg-[#1e293b] text-slate-400 hover:text-slate-200'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Search by PID, SKU, note, author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full py-1.5 px-3 pl-8 rounded-xl text-xs border outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
            <svg className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-sm font-semibold">No adjustments found matching filter.</p>
            </div>
          ) : (
            <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-[#1e293b] text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                  <tr>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">PID & SKU</th>
                    <th className="py-3 px-3">Metric</th>
                    <th className="py-3 px-3">Adjustment Notes</th>
                    <th className="py-3 px-3">Logged By</th>
                    <th className="py-3 px-3">Last Updated</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {filteredLogs.map((log) => {
                    const isAdjusted = log.status === 'Adjusted';
                    const isUpdating = updatingId === log.id;
                    return (
                      <tr key={log.id} className={isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isAdjusted
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {log.status || 'Pending'}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-300 whitespace-nowrap">
                          {log.date}
                        </td>

                        <td className="py-3 px-3 max-w-[200px]">
                          <div className="font-mono text-[11px] text-slate-400">{log.pid}</div>
                          <div className="font-semibold text-slate-200 truncate" title={log.skuName}>
                            {log.skuName}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-bold text-indigo-400 whitespace-nowrap">
                          {log.metric}
                        </td>

                        <td className="py-3 px-3 max-w-[260px]">
                          <p className="text-slate-300 leading-snug break-words">
                            {log.adjustment}
                          </p>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          <div>{log.createdBy}</div>
                          <div className="text-[10px] text-slate-500">
                            {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ''}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          {log.updatedAt ? (
                            <>
                              <div>{log.updatedBy || 'Updated'}</div>
                              <div className="text-[10px] text-slate-500">
                                {new Date(log.updatedAt).toLocaleString()}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(log)}
                            disabled={isUpdating}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 mx-auto ${
                              isAdjusted
                                ? 'bg-slate-700/50 hover:bg-amber-600/30 text-slate-300 hover:text-amber-300 border border-slate-600'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                            }`}
                          >
                            {isUpdating ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : isAdjusted ? (
                              'Revert to Pending'
                            ) : (
                              'Mark Adjusted ✓'
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-[#0c1222]' : 'border-slate-100 bg-slate-50'}`}>
          <div className="text-xs text-slate-400">
            Changes are saved live to <span className="font-mono text-indigo-400">Adjustment Logs</span> sheet in Google Spreadsheet.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

