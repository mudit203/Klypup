'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, ClipboardList, Play, CheckCircle2, AlertCircle, ShieldAlert, ChevronDown, Activity, Sparkles, TrendingUp, X } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ProductDetails {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost_of_goods: number;
  current_price: number;
  stock_level: number;
  stock_status: 'in-stock' | 'low-stock' | 'out-of-stock';
  latest_demand: {
    demand_index: number;
    trend: string;
    updated_at: string;
  } | null;
  recent_competitors: Array<{
    competitor: string;
    price: number;
    event_type: string;
    recorded_at: string;
  }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id: productId } = use(params);
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if session is missing
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [pricingChartData, setPricingChartData] = useState<any[]>([]);
  const [demandChartData, setDemandChartData] = useState<any[]>([]);
  const [activeRec, setActiveRec] = useState<any | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Orchestrator States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Action Modals & Notification state
  const [isShowAgentDetails, setIsShowAgentDetails] = useState(false);
  const [isModifyingPrice, setIsModifyingPrice] = useState(false);
  const [overridePrice, setOverridePrice] = useState('');
  const [isRejectingRec, setIsRejectingRec] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Main data load function (fetches details, charts, and latest AI recommendation)
  const fetchProductData = async () => {
    if (!user || !productId) return;
    try {
      const [prodRes, historyRes, competitorRes, demandRes, latestRecRes] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get(`/products/${productId}/price-history`),
        api.get(`/products/${productId}/competitor-prices`),
        api.get(`/products/${productId}/demand-signals`),
        api.get(`/ai-analysis/${productId}/latest`)
      ]);

      setProduct(prodRes.data.product);
      setActiveRec(latestRecRes.data.recommendation);

      // Merge Pricing Timeline (Our Price history + Competitor prices history) by date
      const dataByDate: { [key: string]: any } = {};

      // 1. Load our price timeline
      historyRes.data.history.forEach((h: any) => {
        const dateStr = new Date(h.changed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!dataByDate[dateStr]) dataByDate[dateStr] = { date: dateStr };
        dataByDate[dateStr]['Our Price'] = h.price;
      });

      // 2. Load competitor price timeline
      competitorRes.data.competitorHistory.forEach((c: any) => {
        const dateStr = new Date(c.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!dataByDate[dateStr]) dataByDate[dateStr] = { date: dateStr };
        dataByDate[dateStr][c.competitor] = c.price;
      });

      // Convert the object to an array and sort it chronologically
      const pricingArray = Object.values(dataByDate);
      setPricingChartData(pricingArray);

      // Load Demand Timeline
      const demandArray = demandRes.data.demandHistory.map((d: any) => ({
        date: new Date(d.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        'Demand Index': d.demand_index,
      }));
      setDemandChartData(demandArray);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load product details');
    }
  };

  useEffect(() => {
    if (!user || !productId) return;
    
    const initialLoad = async () => {
      setIsLoading(true);
      setError(null);
      await fetchProductData();
      setIsLoading(false);
    };

    initialLoad();
  }, [user, productId]);

  // AI Pipeline Trigger
  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    setProgressLogs([]);
    setAnalysisError(null);
    setAnalysisResult(null);
    setNotification(null);

    // 1. Start parallel database polling for agent checkmarks
    const intervalId = setInterval(async () => {
      try {
        const progressRes = await api.get(`/ai-analysis/${productId}/latest`);
        if (progressRes.data.recommendation && progressRes.data.recommendation.agent_outputs) {
          setProgressLogs(progressRes.data.recommendation.agent_outputs);
        }
      } catch (pollErr) {
        console.error('Polling progress failed:', pollErr);
      }
    }, 600);

    try {
      // 2. Post trigger
      const runRes = await api.post(`/ai-analysis/${productId}/run`);
      clearInterval(intervalId);

      // Check for success output logs
      const finalRes = await api.get(`/ai-analysis/${productId}/latest`);
      if (finalRes.data.recommendation) {
        setAnalysisResult(finalRes.data.recommendation);
        setProgressLogs(finalRes.data.recommendation.agent_outputs || []);
      } else {
        setAnalysisResult(runRes.data.recommendation);
      }

      // Re-fetch graphs and price figures
      await fetchProductData();
    } catch (err: any) {
      clearInterval(intervalId);
      setAnalysisError(
        err.response?.data?.message || err.response?.data?.error || 'Pricing analysis run encountered an error.'
      );
    } finally {
      clearInterval(intervalId);
    }
  };

  // Human Action 1: Approve Recommendation
  const handleApproveDetail = async () => {
    if (!activeRec) return;
    setNotification(null);
    try {
      await api.post(`/recommendations/${activeRec.id}/approve`);
      setNotification({ type: 'success', message: 'Price recommendation approved and storefront updated.' });
      await fetchProductData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.error || 'Failed to approve recommendation.' });
    }
  };

  // Human Action 2: Modify Price Recommendation
  const handleModifyDetailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRec) return;
    
    const priceNum = parseFloat(overridePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid price.' });
      return;
    }

    setNotification(null);
    setIsModifyingPrice(false);
    setOverridePrice('');

    try {
      await api.post(`/recommendations/${activeRec.id}/modify`, {
        new_price: priceNum
      });
      setNotification({ type: 'success', message: `Price modified and applied at $${priceNum.toFixed(2)}.` });
      await fetchProductData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.error || 'Failed to override price.' });
    }
  };

  // Human Action 3: Reject Price Recommendation
  const handleRejectDetailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRec) return;

    if (rejectionReasonText.trim().length < 5) {
      setNotification({ type: 'error', message: 'Please provide a reason with at least 5 characters.' });
      return;
    }

    setNotification(null);
    setIsRejectingRec(false);
    setRejectionReasonText('');

    try {
      await api.post(`/recommendations/${activeRec.id}/reject`, {
        reason: rejectionReasonText
      });
      setNotification({ type: 'success', message: 'Price recommendation rejected.' });
      await fetchProductData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.error || 'Failed to reject recommendation.' });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F9FAFB]">
        <p className="text-base font-semibold text-neutral-600 animate-pulse">Restoring session...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F9FAFB]">
        <div className="text-center">
          <svg className="animate-spin h-6 w-6 text-neutral-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-xs font-semibold text-neutral-400">Loading product metrics and history timelines...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="relative min-h-screen bg-[#F9FAFB] p-6 md:p-8 lg:p-12 font-sans">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:20px_20px] opacity-[0.18] pointer-events-none -z-10" />
        <div className="mx-auto max-w-2xl space-y-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-start space-x-2.5 rounded-xl bg-red-50/50 border border-red-200 p-4 text-xs text-red-700 font-semibold shadow-sm">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error || 'Product not found'}</span>
          </div>
        </div>
      </div>
    );
  }

  const grossProfit = product.current_price - product.cost_of_goods;
  const marginPercentage = (grossProfit / product.current_price) * 100;

  // Extract unique competitor names dynamically from the chart data array
  const competitorKeys = Array.from(
    new Set(
      pricingChartData.flatMap(d => Object.keys(d).filter(k => k !== 'date' && k !== 'Our Price'))
    )
  );

  return (
    <div className="relative min-h-screen bg-[#F9FAFB] p-6 md:p-8 lg:p-12 font-sans overflow-x-hidden">
      {/* 20px faint background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:20px_20px] opacity-[0.18] pointer-events-none -z-10" />

      {/* Back Navigation Row */}
      <div className="flex justify-between items-center mb-8 select-none">
        <button
          onClick={() => router.push('/')}
          className="flex items-center space-x-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>

        <button
          onClick={() => router.push('/approval-queue')}
          className="flex items-center space-x-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
        >
          <ClipboardList className="h-4 w-4 text-neutral-700" />
          <span>Approval Queue</span>
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`flex items-start space-x-2.5 rounded-xl border p-4 text-xs mb-8 animate-in fade-in duration-200 ${
          notification.type === 'success' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' : 'bg-red-50/50 border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="font-semibold">{notification.message}</div>
        </div>
      )}

      {/* Grid Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Specs + AI Recommendation (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* Specifications Card */}
          <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xl shadow-neutral-100/50 p-6 md:p-8">
            <h2 className="text-[12px] font-bold text-neutral-400 tracking-[0.05em] uppercase border-b border-neutral-100 pb-3 mb-5 select-none">
              Product Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Product Name</span>
                <span className="text-base font-bold text-neutral-900 leading-snug">{product.name}</span>
              </div>
              
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">SKU Code</span>
                <span className="text-xs font-mono text-neutral-600 bg-neutral-50 border border-neutral-200/50 px-2 py-0.5 rounded-md">
                  {product.sku}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Category</span>
                <span className="text-sm text-neutral-800 font-semibold">{product.category}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Cost of Goods</span>
                  <span className="text-sm font-bold text-neutral-800">${product.cost_of_goods.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Retail Price</span>
                  <span className="text-sm font-extrabold text-[#007AFF] hover:underline cursor-pointer transition-colors" onClick={() => setIsModifyingPrice(true)}>
                    ${product.current_price.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Gross Profit Margin</span>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    marginPercentage < 15 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                    {marginPercentage.toFixed(1)}% Margin
                  </span>
                  <span className="text-xs text-neutral-400 font-medium">
                    (Profit: ${grossProfit.toFixed(2)} / unit)
                  </span>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">Inventory Level</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-neutral-800">{product.stock_level} units</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                    product.stock_status === 'in-stock' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : (product.stock_status === 'low-stock' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100')
                  }`}>
                    {product.stock_status.replace('-', ' ')}
                  </span>
                </div>
              </div>

              {product.latest_demand && (
                <div className="border-t border-neutral-100 pt-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Demand Index</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-neutral-800">{product.latest_demand.demand_index} Index</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                      product.latest_demand.trend === 'RISING' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {product.latest_demand.trend}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={runAiAnalysis}
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center space-x-2 mt-6 rounded-xl bg-black hover:bg-neutral-900 disabled:bg-neutral-900/50 text-white py-3 px-4 text-xs font-bold shadow-md transition-all duration-200 ease-in-out cursor-pointer disabled:cursor-not-allowed select-none"
              >
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Trigger AI Pricing Analysis</span>
              </button>
            </div>
          </section>

          {/* AI Recommendation Card */}
          {activeRec && (
            <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xl shadow-neutral-100/50 p-6 md:p-8">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-3 mb-5 select-none">
                <h2 className="text-[12px] font-bold text-neutral-400 tracking-[0.05em] uppercase">
                  AI Recommendation
                </h2>
                
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border tracking-wider ${
                  activeRec.status === 'PENDING' 
                    ? 'bg-amber-50 text-amber-700 border-amber-200/50' 
                    : (activeRec.status === 'AUTO_EXECUTED' || activeRec.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : 'bg-red-50 text-red-700 border-red-200/50')
                }`}>
                  {activeRec.status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Recommended Price</span>
                    <strong className="text-xl font-bold text-[#007AFF]">${activeRec.recommended_price.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">AI Confidence</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="w-16 bg-neutral-100 rounded-full h-1.5 overflow-hidden border border-neutral-200/50">
                        <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${activeRec.confidence_score}%` }} />
                      </div>
                      <strong className="text-xs font-bold text-neutral-700">{activeRec.confidence_score}%</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Rationale</span>
                  <p className="bg-neutral-50/50 border border-neutral-200/60 rounded-xl p-3.5 text-xs text-neutral-600 italic leading-relaxed">
                    "{activeRec.rationale}"
                  </p>
                </div>

                {/* Collapsible Agent Reasoning Breakdown */}
                <div className="border-t border-neutral-100 pt-4">
                  <button
                    onClick={() => setIsShowAgentDetails(!isShowAgentDetails)}
                    className="w-full flex items-center justify-between text-xs font-bold text-neutral-800 hover:text-neutral-950 transition-colors select-none cursor-pointer"
                  >
                    <span>Agent Analysis Reports</span>
                    <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${isShowAgentDetails ? 'rotate-180' : ''}`} />
                  </button>

                  {isShowAgentDetails && activeRec.agent_outputs && (
                    <div className="space-y-3 mt-4 animate-in fade-in duration-200">
                      {activeRec.agent_outputs.map((agent: any) => (
                        <div key={agent.id} className="p-3 border border-neutral-200/60 rounded-xl bg-neutral-50/20 text-xs shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <strong className="text-neutral-850 font-bold">{agent.run_order}. {agent.agent_name.replace('_', ' ')}</strong>
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100/50">COMPLETED</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 leading-normal">{agent.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Human Analyst Decision Buttons (If Pending) */}
                {activeRec.status === 'PENDING' && (user.role === 'ANALYST' || user.role === 'ADMIN') && (
                  <div className="border-t border-neutral-100 pt-5 mt-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-3 select-none">
                      Analyst Queue Actions
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={handleApproveDetail}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 text-[11px] font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setIsModifyingPrice(true); setOverridePrice(activeRec.recommended_price.toString()); }}
                        className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white py-2.5 px-3 text-[11px] font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
                      >
                        Modify
                      </button>
                      <button
                        onClick={() => { setIsRejectingRec(true); setRejectionReasonText(''); }}
                        className="rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 px-3 text-[11px] font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </section>
          )}

        </div>

        {/* Right Column: Recharts Timelines (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* Price Timeline Chart */}
          <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xl shadow-neutral-100/50 p-6 md:p-8">
            <h3 className="text-[12px] font-bold text-neutral-400 tracking-[0.05em] uppercase border-b border-neutral-100 pb-3 mb-6 select-none">
              Market Price Timeline (Last 30 Days)
            </h3>
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pricingChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toFixed(2)}`]} 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Line type="monotone" dataKey="Our Price" stroke="#000000" strokeWidth={3} dot={{ r: 3, fill: '#000000' }} activeDot={{ r: 5 }} connectNulls />
                  {competitorKeys.map((compName, idx) => {
                    const colors = ['#F59E0B', '#64748B', '#10B981', '#EF4444', '#a8a29e'];
                    return (
                      <Line 
                        key={compName} 
                        type="monotone" 
                        dataKey={compName} 
                        stroke={colors[idx % colors.length]} 
                        strokeWidth={1.8} 
                        dot={{ r: 2 }} 
                        connectNulls 
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Demand Timeline Chart */}
          <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xl shadow-neutral-100/50 p-6 md:p-8">
            <h3 className="text-[12px] font-bold text-neutral-400 tracking-[0.05em] uppercase border-b border-neutral-100 pb-3 mb-6 select-none">
              Demand Signal Index Timeline
            </h3>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demandChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Line type="monotone" dataKey="Demand Index" stroke="#007AFF" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>

      </div>

      {/* Progress Loading Overlay Modal */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-white shadow-2xl p-6 md:p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-neutral-900 text-center mb-6 select-none">
              AI Pricing Analysis Orchestrator
            </h3>

            {/* List of Agents */}
            <div className="space-y-3.5 mb-6">
              {[
                { name: 'MARKET_INTELLIGENCE', title: 'Market Intelligence Agent', desc: 'Analyzes competitor prices', order: 1 },
                { name: 'DEMAND_FORECASTING', title: 'Demand Forecasting Agent', desc: 'Evaluates traffic interest logs', order: 2 },
                { name: 'INVENTORY_COST', title: 'Inventory & Cost Agent', desc: 'Calculates cost boundaries', order: 3 },
                { name: 'PRICING_STRATEGY', title: 'Pricing Strategy Agent', desc: 'Determines new pricing', order: 4 },
                { name: 'EXECUTION_COMPLIANCE', title: 'Execution Compliance Agent', desc: 'Enforces margin floor rules', order: 5 }
              ].map((agent, index) => {
                const output = progressLogs.find((p) => p.agent_name === agent.name);
                const isCompleted = !!output;
                
                let statusText = 'Queued';
                let statusClass = 'bg-neutral-50 text-neutral-400 border-neutral-200/50';

                if (isCompleted) {
                  if (output.output?.error || output.error) {
                    statusText = 'Failed';
                    statusClass = 'bg-red-50 text-red-600 border-red-100';
                  } else {
                    statusText = 'Completed';
                    statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  }
                } else {
                  const prevCompleted = index === 0 || !!progressLogs.find((p) => p.run_order === agent.order - 1);
                  if (prevCompleted && !analysisError) {
                    statusText = 'Running';
                    statusClass = 'bg-blue-50 text-blue-700 border-blue-100';
                  }
                }

                return (
                  <div key={agent.name} className="flex justify-between items-center p-3 rounded-xl border border-neutral-200/60 bg-neutral-50/20 shadow-sm">
                    <div>
                      <strong className="text-xs font-bold text-neutral-800 block">{agent.title}</strong>
                      <span className="text-[10px] text-neutral-400">{agent.desc}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Error Message */}
            {analysisError && (
              <div className="flex items-start space-x-2 rounded-xl bg-red-50/50 border border-red-200 p-3.5 text-xs text-red-750 mb-6 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Error running analysis:</strong> {analysisError}
                </div>
              </div>
            )}

            {/* Outcome Display */}
            {analysisResult && (
              <div className="bg-neutral-50/50 border border-neutral-250/60 rounded-xl p-4 text-xs mb-6 animate-in fade-in duration-200">
                <div className="flex items-center space-x-1.5 mb-2.5">
                  <Sparkles className="h-4 w-4 text-[#007AFF]" />
                  <h4 className="text-xs font-bold text-neutral-900">Pipeline Result</h4>
                </div>
                <div className="space-y-1 text-neutral-700">
                  <p>
                    Execution: <strong className={analysisResult.status === 'AUTO_EXECUTED' ? 'text-emerald-700' : 'text-amber-700'}>
                      {analysisResult.status.replace('_', ' ')}
                    </strong>
                  </p>
                  <p>
                    Recommended Price: <strong>${analysisResult.recommended_price.toFixed(2)}</strong> (Confidence: {analysisResult.confidence_score}%)
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-neutral-500 italic border-l-2 border-neutral-300 pl-2">
                    "{analysisResult.rationale}"
                  </p>
                </div>
              </div>
            )}

            {/* Close Overlay Trigger */}
            <div className="flex justify-center select-none">
              <button
                disabled={!analysisResult && !analysisError}
                onClick={() => setIsAnalyzing(false)}
                className={`rounded-xl px-6 py-2.5 text-xs font-bold shadow-md transition-all duration-200 ease-in-out cursor-pointer ${
                  (!analysisResult && !analysisError) 
                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200/50' 
                    : 'bg-black hover:bg-neutral-900 text-white'
                }`}
              >
                Close Pipeline
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modify Price Modal Dialog */}
      {isModifyingPrice && activeRec && (
        <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleModifyDetailSubmit} className="bg-white rounded-2xl border border-white shadow-2xl p-6 md:p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-neutral-900 mb-1 select-none">Override Recommended Price</h3>
            <p className="text-xs text-neutral-400 mb-5 select-none">
              AI Suggestion: ${activeRec.recommended_price.toFixed(2)}
            </p>
            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider block">Custom Retail Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 text-sm text-neutral-900 focus:bg-white focus:border-neutral-950 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.04)] outline-none transition-all duration-200"
              />
            </div>
            <div className="flex space-x-2.5 justify-end select-none">
              <button
                type="button"
                onClick={() => setIsModifyingPrice(false)}
                className="rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-4 py-2.5 text-xs font-bold text-neutral-700 shadow-sm transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#007AFF] hover:bg-[#0062cc] text-white px-4 py-2.5 text-xs font-bold shadow-md transition-all duration-200 cursor-pointer"
              >
                Apply Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Recommendation Modal Dialog */}
      {isRejectingRec && activeRec && (
        <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRejectDetailSubmit} className="bg-white rounded-2xl border border-white shadow-2xl p-6 md:p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-neutral-900 mb-4 select-none">Reject Recommendation</h3>
            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider block">Rejection Reason (min 5 chars)</label>
              <textarea
                required
                rows={3}
                placeholder="Why are you rejecting this AI price suggestion?..."
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 text-xs text-neutral-900 focus:bg-white focus:border-neutral-950 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.04)] outline-none transition-all duration-200 resize-none font-sans"
              />
            </div>
            <div className="flex space-x-2.5 justify-end select-none">
              <button
                type="button"
                onClick={() => setIsRejectingRec(false)}
                className="rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-4 py-2.5 text-xs font-bold text-neutral-700 shadow-sm transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-bold shadow-md transition-all duration-200 cursor-pointer"
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
