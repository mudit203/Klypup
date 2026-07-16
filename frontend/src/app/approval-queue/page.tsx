'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { ArrowLeft, CheckCircle2, AlertCircle, ClipboardList, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost_of_goods: number;
}

interface Recommendation {
  id: string;
  product_id: string;
  current_price: number;
  recommended_price: number;
  confidence_score: number;
  status: string;
  trigger: string;
  rationale: string;
  created_at: string;
  product: Product;
}

export default function ApprovalQueuePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if session is missing
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [activeModifyRec, setActiveModifyRec] = useState<Recommendation | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  const [activeRejectRec, setActiveRejectRec] = useState<Recommendation | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch pending list
  const fetchPendingQueue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/recommendations', {
        params: { status: 'PENDING' }
      });
      setRecommendations(res.data.recommendations);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load approval queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPendingQueue();
    }
  }, [user]);

  // Action 1: Approve Recommendation (Optimistic Update)
  const handleApprove = async (rec: Recommendation) => {
    const originalList = [...recommendations];
    setError(null);
    setSuccessMessage(null);

    // Optimistic UI update: remove row immediately
    setRecommendations(prev => prev.filter(r => r.id !== rec.id));

    try {
      await api.post(`/recommendations/${rec.id}/approve`);
      setSuccessMessage(`Approved recommendation for ${rec.product.name} at $${rec.recommended_price.toFixed(2)}.`);
    } catch (err: any) {
      // Revert on error
      setRecommendations(originalList);
      setError(err.response?.data?.error || 'Failed to approve recommendation.');
    }
  };

  // Action 2: Modify Recommendation
  const handleModifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModifyRec) return;

    const priceNum = parseFloat(customPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid positive number for the overridden price');
      return;
    }

    const rec = activeModifyRec;
    const originalList = [...recommendations];
    setError(null);
    setSuccessMessage(null);
    
    // Close modal & optimistic remove
    setActiveModifyRec(null);
    setCustomPrice('');
    setRecommendations(prev => prev.filter(r => r.id !== rec.id));

    try {
      await api.post(`/recommendations/${rec.id}/modify`, {
        new_price: priceNum
      });
      setSuccessMessage(`Price for ${rec.product.name} modified and set to $${priceNum.toFixed(2)}.`);
    } catch (err: any) {
      setRecommendations(originalList);
      setError(err.response?.data?.error || 'Failed to modify price recommendation.');
    }
  };

  // Action 3: Reject Recommendation
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRejectRec) return;

    if (rejectReason.trim().length < 5) {
      setError('Please provide a rejection reason (minimum 5 characters)');
      return;
    }

    const rec = activeRejectRec;
    const originalList = [...recommendations];
    setError(null);
    setSuccessMessage(null);

    // Close modal & optimistic remove
    setActiveRejectRec(null);
    setRejectReason('');
    setRecommendations(prev => prev.filter(r => r.id !== rec.id));

    try {
      await api.post(`/recommendations/${rec.id}/reject`, {
        reason: rejectReason
      });
      setSuccessMessage(`Rejected pricing recommendation for ${rec.product.name}.`);
    } catch (err: any) {
      setRecommendations(originalList);
      setError(err.response?.data?.error || 'Failed to reject recommendation.');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F9FAFB]">
        <p className="text-base font-semibold text-neutral-600 animate-pulse">Restoring session...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F9FAFB] p-6 md:p-8 lg:p-12 font-sans overflow-x-hidden">
      {/* 20px faint background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:20px_20px] opacity-[0.18] pointer-events-none -z-10" />
      
      {/* Top Header Panel */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 select-none">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#000000] flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm tracking-wider font-mono">K</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#000000] uppercase">Klypup</h1>
          </div>
          <p className="mt-1 text-xs text-neutral-400 font-semibold tracking-wide">
            Tenant ID: <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-700">{user.orgId}</code> • Authenticated as: <span className="text-neutral-700">{user.name}</span> ({user.role.toLowerCase()})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Catalog</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Glassmorphic Container */}
      <main className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xl shadow-neutral-100/50 p-6 md:p-8">
        
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Pending Approval Queue</h2>
            <p className="text-xs text-neutral-400 font-semibold mt-0.5">Review dynamic pricing recommendations before they are published.</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
            {recommendations.length} Pending Approval
          </span>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-start space-x-2.5 rounded-xl bg-red-50/50 border border-red-200 p-4 text-xs text-red-700 mb-6 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{error}</div>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start space-x-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 p-4 text-xs text-emerald-800 mb-6 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{successMessage}</div>
          </div>
        )}

        {/* Recommendations Table / Grid */}
        {isLoading ? (
          <div className="py-24 text-center">
            <svg className="animate-spin h-6 w-6 text-neutral-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs font-semibold text-neutral-400">Loading pending pricing approvals...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/20 select-none">
            <ClipboardList className="h-8 w-8 text-neutral-300 mx-auto mb-2.5" />
            <h3 className="text-sm font-bold text-neutral-800">No recommendations pending review</h3>
            <p className="text-xs text-neutral-400 mt-1">All recommendations have been auto-executed, blocked, or processed by analysts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 md:-mx-8">
            <table className="w-full border-collapse text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-neutral-150">
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Product Details</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Current Price</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">AI Recommended</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Delta</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">AI Confidence</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Trigger</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Age</th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {recommendations.map((rec) => {
                  const priceDiff = rec.recommended_price - rec.current_price;
                  const percentDiff = (priceDiff / rec.current_price) * 100;
                  const isIncrease = priceDiff > 0;

                  return (
                    <tr
                      key={rec.id}
                      className="group hover:bg-neutral-50/50 transition-all duration-200 ease-in-out"
                    >
                      <td className="py-4 px-6 text-sm font-bold text-neutral-900">
                        <span 
                          onClick={() => router.push(`/products/${rec.product_id}`)}
                          className="hover:underline cursor-pointer text-neutral-900 hover:text-black font-bold block"
                        >
                          {rec.product.name}
                        </span>
                        <code className="text-[11px] font-mono text-neutral-400 font-normal">{rec.product.sku}</code>
                      </td>
                      <td className="py-4 px-6 text-sm font-semibold text-neutral-700">
                        ${rec.current_price.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-[#007AFF]">
                        ${rec.recommended_price.toFixed(2)}
                      </td>
                      <td className={`py-4 px-6 text-sm font-semibold ${isIncrease ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIncrease ? '▲' : '▼'} ${Math.abs(priceDiff).toFixed(2)} ({percentDiff.toFixed(1)}%)
                      </td>
                      <td className="py-4 px-6 text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-neutral-100 rounded-full h-1.5 overflow-hidden border border-neutral-200/50">
                            <div 
                              style={{ width: `${rec.confidence_score}%` }} 
                              className={`h-full ${
                                rec.confidence_score >= 80 
                                  ? 'bg-emerald-500' 
                                  : rec.confidence_score >= 50 
                                  ? 'bg-blue-500' 
                                  : 'bg-amber-500'
                              }`} 
                            />
                          </div>
                          <span className="text-xs font-bold text-neutral-700">{rec.confidence_score}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] bg-neutral-100 text-neutral-800 border border-neutral-200">
                          {rec.trigger.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-neutral-400 font-medium">
                        {new Date(rec.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleApprove(rec)}
                            className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setActiveModifyRec(rec); setCustomPrice(rec.recommended_price.toString()); }}
                            className="flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
                          >
                            Modify
                          </button>
                          <button
                            onClick={() => { setActiveRejectRec(rec); setRejectReason(''); }}
                            className="flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* Modify Price Modal Dialog */}
      {activeModifyRec && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleModifySubmit} 
            className="bg-white rounded-2xl border border-neutral-200/60 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 animate-out fade-out"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900">Override Recommended Price</h3>
              <button 
                type="button" 
                onClick={() => setActiveModifyRec(null)} 
                className="text-neutral-400 hover:text-neutral-900 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3 mb-5">
              <p className="text-xs text-neutral-500 font-medium">
                Product: <strong className="text-neutral-800">{activeModifyRec.product.name}</strong>
              </p>
              <p className="text-xs text-neutral-500 font-medium">
                AI Suggestion: <strong className="text-neutral-800">${activeModifyRec.recommended_price.toFixed(2)}</strong>
              </p>
              
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">Custom Retail Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="block w-full rounded-xl border border-neutral-200/80 bg-neutral-50 py-2.5 px-3.5 text-neutral-900 placeholder-neutral-400 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.04)] focus:border-neutral-950 focus:bg-white focus:ring-1 focus:ring-neutral-950 text-sm transition-all duration-200 outline-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setActiveModifyRec(null)}
                className="rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer"
              >
                Apply Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Recommendation Modal Dialog */}
      {activeRejectRec && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleRejectSubmit} 
            className="bg-white rounded-2xl border border-neutral-200/60 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 animate-out fade-out"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900">Reject Recommendation</h3>
              <button 
                type="button" 
                onClick={() => setActiveRejectRec(null)} 
                className="text-neutral-400 hover:text-neutral-900 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3 mb-5">
              <p className="text-xs text-neutral-500 font-medium">
                Product: <strong className="text-neutral-800">{activeRejectRec.product.name}</strong>
              </p>
              
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">Rejection Reason (min 5 characters)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Why are you rejecting this AI price suggestion?..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="block w-full rounded-xl border border-neutral-200/80 bg-neutral-50 py-2.5 px-3.5 text-neutral-900 placeholder-neutral-400 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.04)] focus:border-neutral-950 focus:bg-white focus:ring-1 focus:ring-neutral-950 text-sm transition-all duration-200 outline-none resize-none font-sans"
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setActiveRejectRec(null)}
                className="rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer"
              >
                Reject Suggestion
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
