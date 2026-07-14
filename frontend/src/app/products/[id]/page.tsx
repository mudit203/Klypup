'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: '500' }}>Restoring session...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <p style={{ fontSize: '1.125rem' }}>Loading product details and history timelines...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', marginBottom: '1.5rem', fontWeight: '600' }}
        >
          ← Back to Catalog
        </button>
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '4px' }}>
          {error || 'Product not found'}
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
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f9fafb', padding: '2rem', boxSizing: 'border-box' }}>
      
      {/* Back Navigation Row */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => router.push('/')}
          style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', fontWeight: '600', color: '#374151' }}
        >
          ← Back to Dashboard
        </button>

        <button
          onClick={() => router.push('/approval-queue')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
        >
          Approval Queue →
        </button>
      </div>

      {notification && (
        <div style={{
          backgroundColor: notification.type === 'success' ? '#d1fae5' : '#fee2e2',
          border: '1px solid ' + (notification.type === 'success' ? '#a7f3d0' : '#fca5a5'),
          color: notification.type === 'success' ? '#065f46' : '#b91c1c',
          padding: '1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem'
        }}>
          {notification.message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', alignItems: 'start' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* Left Panel Wrapper (Specs + AI Recommendation) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Left Panel: Specifications */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.75rem', marginBottom: '1.25rem', color: '#111' }}>Product Details</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Product Name</span>
                  <strong style={{ fontSize: '1.125rem', color: '#111827' }}>{product.name}</strong>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>SKU Code</span>
                  <code style={{ fontSize: '1rem', color: '#111827' }}>{product.sku}</code>
                </div>

                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Category</span>
                  <span style={{ color: '#111827' }}>{product.category}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Cost of Goods</span>
                    <strong style={{ color: '#111827' }}>${product.cost_of_goods.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Retail Price</span>
                    <strong style={{ color: '#4f46e5', fontSize: '1.125rem' }}>${product.current_price.toFixed(2)}</strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Calculated Profit Margin</span>
                  <strong style={{ color: marginPercentage < 15 ? '#b91c1c' : '#047857', fontSize: '1.125rem' }}>
                    {marginPercentage.toFixed(1)}% Gross Margin
                  </strong>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                    Profit: ${grossProfit.toFixed(2)} per unit
                  </span>
                </div>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Inventory Level</span>
                  <strong style={{ color: '#111827' }}>{product.stock_level} units</strong>
                  <span style={{ display: 'inline-block', marginLeft: '0.5rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: product.stock_status === 'in-stock' ? '#d1fae5' : '#fee2e2', color: product.stock_status === 'in-stock' ? '#065f46' : '#991b1b' }}>
                    {product.stock_status.toUpperCase()}
                  </span>
                </div>

                {product.latest_demand && (
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Current Demand Score</span>
                    <strong style={{ color: '#111827' }}>{product.latest_demand.demand_index} Index</strong>
                    <span style={{ display: 'inline-block', marginLeft: '0.5rem', fontSize: '0.875rem', color: product.latest_demand.trend === 'RISING' ? '#047857' : '#b91c1c', fontWeight: 'bold' }}>
                      ({product.latest_demand.trend})
                    </span>
                  </div>
                )}

                <button
                  onClick={runAiAnalysis}
                  disabled={isAnalyzing}
                  style={{
                    marginTop: '1.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    opacity: isAnalyzing ? 0.7 : 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => { if (!isAnalyzing) e.currentTarget.style.backgroundColor = '#4338ca'; }}
                  onMouseLeave={(e) => { if (!isAnalyzing) e.currentTarget.style.backgroundColor = '#4f46e5'; }}
                >
                  ⚡ Trigger AI Pricing Analysis
                </button>
              </div>
            </div>

            {/* AI Recommendation Summary panel */}
            {activeRec && (
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#111' }}>AI Pricing Recommendation</h2>
                  
                  {/* Status Badge */}
                  <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: activeRec.status === 'PENDING' ? '#fef3c7' : (activeRec.status === 'AUTO_EXECUTED' || activeRec.status === 'APPROVED' ? '#d1fae5' : '#fee2e2'),
                    color: activeRec.status === 'PENDING' ? '#92400e' : (activeRec.status === 'AUTO_EXECUTED' || activeRec.status === 'APPROVED' ? '#065f46' : '#991b1b')
                  }}>
                    {activeRec.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>Recommended Price</span>
                      <strong style={{ color: '#4f46e5', fontSize: '1.25rem' }}>${activeRec.recommended_price.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block' }}>AI Confidence</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <div style={{ width: '50px', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${activeRec.confidence_score}%`, backgroundColor: '#3b82f6', height: '100%' }} />
                        </div>
                        <strong style={{ fontSize: '0.9rem', color: '#374151' }}>{activeRec.confidence_score}%</strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Rationale Summary</span>
                    <p style={{ margin: 0, padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.4', fontStyle: 'italic' }}>
                      "{activeRec.rationale}"
                    </p>
                  </div>

                  {/* Collapsible 5-Agent Breakdown */}
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                    <button
                      onClick={() => setIsShowAgentDetails(!isShowAgentDetails)}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', padding: 0 }}
                    >
                      {isShowAgentDetails ? '▼ Hide Agent Reasoning Reports' : '▶ Show Agent Reasoning Reports'}
                    </button>

                    {isShowAgentDetails && activeRec.agent_outputs && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                        {activeRec.agent_outputs.map((agent: any) => (
                          <div key={agent.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <strong style={{ color: '#374151' }}>{agent.run_order}. {agent.agent_name.replace('_', ' ')}</strong>
                              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#059669' }}>COMPLETED</span>
                            </div>
                            <p style={{ margin: 0, color: '#6b7280', lineHeight: '1.3' }}>{agent.summary}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Human Analyst Decision Buttons (If Pending) */}
                  {activeRec.status === 'PENDING' && (user.role === 'ANALYST' || user.role === 'ADMIN') && (
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.75rem' }}>
                        Analyst Decision Queue Actions
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                        <button
                          onClick={handleApproveDetail}
                          style={{ padding: '0.5rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          Approve Price
                        </button>
                        <button
                          onClick={() => { setIsModifyingPrice(true); setOverridePrice(activeRec.recommended_price.toString()); }}
                          style={{ padding: '0.5rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          Modify Price
                        </button>
                        <button
                          onClick={() => { setIsRejectingRec(true); setRejectionReasonText(''); }}
                          style={{ padding: '0.5rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          Reject Suggest
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>

          {/* Right Panel: Recharts Timelines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Price Timeline Chart */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: '0 0 1.5rem 0', color: '#111' }}>Market Price Timeline (Last 30 Days)</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pricingChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Our Price" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                    {competitorKeys.map((compName, idx) => {
                      const colors = ['#ff9900', '#003b64', '#10b981', '#ef4444', '#8b5cf6'];
                      return (
                        <Line 
                          key={compName} 
                          type="monotone" 
                          dataKey={compName} 
                          stroke={colors[idx % colors.length]} 
                          strokeWidth={2} 
                          dot={{ r: 2 }} 
                          connectNulls 
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demand Timeline Chart */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: '0 0 1.5rem 0', color: '#111' }}>Demand Signal Index Timeline</h3>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={demandChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Demand Index" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Progress Loading Overlay Modal */}
      {isAnalyzing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 1.5rem 0', color: '#111827', textAlign: 'center' }}>
              AI pricing intelligence pipeline
            </h3>

            {/* List of Agents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
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
                let statusColor = '#9ca3af';
                let statusBg = '#f3f4f6';

                if (isCompleted) {
                  if (output.output?.error || output.error) {
                    statusText = 'Failed ❌';
                    statusColor = '#dc2626';
                    statusBg = '#fee2e2';
                  } else {
                    statusText = 'Completed ✅';
                    statusColor = '#059669';
                    statusBg = '#ecfdf5';
                  }
                } else {
                  const prevCompleted = index === 0 || !!progressLogs.find((p) => p.run_order === agent.order - 1);
                  if (prevCompleted && !analysisError) {
                    statusText = 'Running 🔄';
                    statusColor = '#2563eb';
                    statusBg = '#eff6ff';
                  }
                }

                return (
                  <div key={agent.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#1f2937', display: 'block' }}>{agent.title}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{agent.desc}</span>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      color: statusColor,
                      backgroundColor: statusBg
                    }}>
                      {statusText}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Error Message */}
            {analysisError && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <strong>Error running analysis:</strong> {analysisError}
              </div>
            )}

            {/* Outcome Display */}
            {analysisResult && (
              <div style={{ padding: '1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontWeight: 'bold' }}>Pipeline Result</h4>
                <p style={{ margin: '0 0 0.25rem 0', color: '#374151' }}>
                  Execution decision: <strong style={{ color: analysisResult.status === 'AUTO_EXECUTED' ? '#059669' : (analysisResult.status === 'FAILED' ? '#dc2626' : '#d97706') }}>
                    {analysisResult.status.toUpperCase()}
                  </strong>
                </p>
                <p style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
                  Recommended Price: <strong>${analysisResult.recommended_price.toFixed(2)}</strong> (Confidence: {analysisResult.confidence_score}%)
                </p>
                <p style={{ margin: 0, fontStyle: 'italic', color: '#4b5563', fontSize: '0.8rem' }}>
                  "{analysisResult.rationale}"
                </p>
              </div>
            )}

            {/* Close Overlay Trigger */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                disabled={!analysisResult && !analysisError}
                onClick={() => setIsAnalyzing(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: (!analysisResult && !analysisError) ? '#d1d5db' : '#374151',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: (!analysisResult && !analysisError) ? 'not-allowed' : 'pointer'
                }}
              >
                Close Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modify Price Modal Dialog */}
      {isModifyingPrice && activeRec && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleModifyDetailSubmit} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Override Recommended Price</h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              AI Suggestion: ${activeRec.recommended_price.toFixed(2)}
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Custom Retail Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsModifyingPrice(false)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', backgroundColor: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
              >
                Apply Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Recommendation Modal Dialog */}
      {isRejectingRec && activeRec && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleRejectDetailSubmit} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Reject Recommendation</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Rejection Reason (min 5 chars)</label>
              <textarea
                required
                rows={3}
                placeholder="Why are you rejecting this AI price suggestion?..."
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsRejectingRec(false)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', backgroundColor: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
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
