'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  FileText, 
  Calendar, 
  Filter, 
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from 'lucide-react';

interface AuditUser {
  id: string;
  name: string;
  email: string;
}

interface AuditLog {
  id: string;
  action: string;
  old_price: number | null;
  new_price: number | null;
  product_name: string | null;
  notes: string | null;
  created_at: string;
  user: AuditUser | null;
}

export default function AuditTrailPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // product name/sku search

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, searchQuery]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/audit', {
        params: {
          page,
          limit: 20,
          action: actionFilter || undefined,
          product_id: searchQuery || undefined, // handles SKU or product matching
        },
      });
      setLogs(res.data.logs);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to retrieve compliance audit logs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to style event action badges
  const getActionBadge = (action: string) => {
    let classes = 'bg-neutral-100 text-neutral-800';
    let text = action.replace(/_/g, ' ');

    if (action.includes('APPROVED') || action.includes('AUTO_EXECUTED') || action.includes('INVITED')) {
      classes = 'bg-emerald-50 border border-emerald-200 text-emerald-700';
    } else if (action.includes('REJECTED') || action.includes('FAILED')) {
      classes = 'bg-red-50 border border-red-200 text-red-700';
    } else if (action.includes('MODIFIED') || action.includes('ROLE_CHANGED')) {
      classes = 'bg-amber-50 border border-amber-200 text-amber-700';
    } else if (action.includes('SETTINGS') || action.includes('SIMULATION')) {
      classes = 'bg-blue-50 border border-blue-200 text-blue-700';
    }

    return (
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${classes}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="font-sans min-h-screen bg-neutral-50 p-6 md:p-8">
      
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.push('/')}
              className="p-2 bg-white rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Compliance Audit Trail</h1>
              <p className="text-xs font-medium text-neutral-400 mt-0.5">Chronological system transaction logs and configuration changes</p>
            </div>
          </div>
          
          {/* Navigation Tabs (Only visible to ADMINs) */}
          {user?.role === 'ADMIN' ? (
            <div className="flex bg-neutral-200/60 p-1 rounded-xl border border-neutral-200/30 self-start md:self-auto select-none">
              <button 
                onClick={() => router.push('/admin')}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span>Settings & Catalog</span>
              </button>
              <button 
                onClick={() => router.push('/admin/users')}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Users className="h-4 w-4" />
                <span>Team Members</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg text-sm font-bold text-neutral-900 shadow-sm transition-all">
                <FileText className="h-4 w-4" />
                <span>Audit Trail</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-bold text-neutral-700 shadow-sm transition-all"
            >
              <ClipboardList className="h-4 w-4" />
              <span>Back to Catalog</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* Error Toast */}
        {error && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium animate-pulse">
            {error}
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          
          {/* Controls filter row */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-4 border-b border-neutral-100 items-center">
            
            {/* Search query input */}
            <div className="relative w-full sm:flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-neutral-400" />
              </div>
              <input 
                type="text" 
                placeholder="Search audit trail by product SKU..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full p-2.5 pl-9 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
              />
            </div>

            {/* Filter action selector */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-neutral-400 shrink-0" />
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-48 p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none font-bold text-neutral-900"
              >
                <option value="">All system events</option>
                <option value="PRICE_AUTO_EXECUTED">AI Auto-executed price</option>
                <option value="PRICE_APPROVED">Manual Approved price</option>
                <option value="PRICE_MODIFIED">Manual Override price</option>
                <option value="PRICE_REJECTED">Rejection decisions</option>
                <option value="SETTINGS_UPDATED">Setting changes</option>
                <option value="USER_INVITED">Invited team members</option>
                <option value="USER_ROLE_CHANGED">User permissions delta</option>
                <option value="SIMULATION_RUN">Manual simulation ticks</option>
                <option value="STORE_UPDATE_FAILED">Storefront outage failures</option>
              </select>
            </div>
          </div>

          {/* Chronological events list */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading audit history...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
              No audit logs match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-2">Timestamp</th>
                    <th className="py-2.5 px-2">Action Event</th>
                    <th className="py-2.5 px-2">Related SKU</th>
                    <th className="py-2.5 px-2 text-center">Price Delta</th>
                    <th className="py-2.5 px-2">Trigger Actor</th>
                    <th className="py-2.5 px-2">Details Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3.5 px-2 text-neutral-400 font-medium whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(log.created_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="py-3.5 px-2 font-mono font-bold text-neutral-900 whitespace-nowrap">
                        {log.product_name || <span className="text-neutral-400 italic font-sans font-normal">—</span>}
                      </td>
                      <td className="py-3.5 px-2 text-center whitespace-nowrap font-medium">
                        {log.old_price !== null && log.new_price !== null ? (
                          <div className="flex items-center justify-center space-x-1.5 font-bold">
                            <span className="text-neutral-400 font-normal line-through">${log.old_price.toFixed(2)}</span>
                            <span className="text-neutral-400 font-normal">➡️</span>
                            <span className="text-neutral-900">${log.new_price.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-2">
                        {log.user ? (
                          <div>
                            <strong className="text-neutral-900 font-bold block">{log.user.name}</strong>
                            <span className="text-neutral-400 text-[10px] block -mt-0.5">{log.user.email}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-500 font-bold">System (AI Agent)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-neutral-500 max-w-xs font-normal leading-relaxed">
                        {log.notes || <span className="text-neutral-400 italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination footer block */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-neutral-100 text-xs">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <span className="text-neutral-400">Page <strong>{page}</strong> of {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
