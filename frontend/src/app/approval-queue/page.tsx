'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

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
      const res = await api.post(`/recommendations/${rec.id}/approve`);
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
      const res = await api.post(`/recommendations/${rec.id}/modify`, {
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
      const res = await api.post(`/recommendations/${rec.id}/reject`, {
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: '500' }}>Restoring session...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f9fafb', padding: '2rem', boxSizing: 'border-box' }}>
      
      {/* Back Header panel */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '1rem 2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#111' }}>Pending Approval Queue</h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Review dynamic pricing recommendations scoped to: <strong>{user.orgId}</strong>
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
        >
          ← Back to Catalog
        </button>
      </header>

      {/* Main Container */}
      <main style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '2rem' }}>
        
        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{ backgroundColor: '#d1fae5', border: '1px solid #a7f3d0', color: '#065f46', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: '#6b7280' }}>
            <p>Loading pending pricing approvals...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: '6px' }}>
            <p style={{ fontSize: '1.125rem', fontWeight: '500', margin: 0 }}>No recommendations pending review</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
              All recommendations have been auto-executed, blocked, or processed by analysts.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Product Details</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Current Price</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>AI Recommended</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Delta</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>AI Confidence</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Trigger</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Age</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => {
                  const priceDiff = rec.recommended_price - rec.current_price;
                  const percentDiff = (priceDiff / rec.current_price) * 100;
                  const isIncrease = priceDiff > 0;
                  
                  return (
                    <tr
                      key={rec.id}
                      style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ display: 'block', color: '#111827', cursor: 'pointer' }} onClick={() => router.push(`/products/${rec.product_id}`)}>
                          {rec.product.name}
                        </strong>
                        <code style={{ fontSize: '0.8rem', color: '#6b7280' }}>{rec.product.sku}</code>
                      </td>
                      <td style={{ padding: '1rem', color: '#111827' }}>${rec.current_price.toFixed(2)}</td>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#4f46e5' }}>${rec.recommended_price.toFixed(2)}</td>
                      <td style={{ padding: '1rem', color: isIncrease ? '#047857' : '#b91c1c', fontWeight: '500' }}>
                        {isIncrease ? '▲' : '▼'} ${Math.abs(priceDiff).toFixed(2)} ({percentDiff.toFixed(1)}%)
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '60px', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                            <div style={{ width: `${rec.confidence_score}%`, backgroundColor: '#3b82f6', height: '100%' }} />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>{rec.confidence_score}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#eff6ff', color: '#1e40af' }}>
                          {rec.trigger}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#4b5563', fontSize: '0.875rem' }}>
                        {new Date(rec.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleApprove(rec)}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setActiveModifyRec(rec); setCustomPrice(rec.recommended_price.toString()); }}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                          >
                            Modify
                          </button>
                          <button
                            onClick={() => { setActiveRejectRec(rec); setRejectReason(''); }}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleModifySubmit} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Override Recommended Price</h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Product: <strong>{activeModifyRec.product.name}</strong><br />
              AI Suggestion: ${activeModifyRec.recommended_price.toFixed(2)}
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Custom Retail Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveModifyRec(null)}
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
      {activeRejectRec && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleRejectSubmit} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>Reject Recommendation</h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Product: <strong>{activeRejectRec.product.name}</strong>
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Rejection Reason (min 5 chars)</label>
              <textarea
                required
                rows={3}
                placeholder="Why are you rejecting this AI price suggestion?..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveRejectRec(null)}
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
