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
  current_price: number;
  stock_level: number;
  stock_status: 'in-stock' | 'low-stock' | 'out-of-stock';
  updated_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch products catalog
  useEffect(() => {
    if (!user) return;

    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get('/products', {
          params: {
            page,
            search: search || undefined,
            category: category || undefined,
            stockStatus: stockStatus || undefined,
            sortBy,
            sortOrder,
          },
        });
        setProducts(res.data.products);
        setPagination(res.data.pagination);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 300); // 300ms debounce for search input

    return () => clearTimeout(delayDebounceFn);
  }, [user, page, search, category, stockStatus, sortBy, sortOrder]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
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
      
      {/* Top Header Panel */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '1rem 2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#111' }}>Klypup Pricing Intelligence</h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Logged in as: <strong>{user.name}</strong> ({user.role}) | tenant: <code>{user.orgId}</code>
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
        >
          Sign Out
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '2rem' }}>
        
        {/* Filters and Controls Row */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          
          <input
            type="text"
            placeholder="Search SKU or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', flex: '1', minWidth: '200px' }}
          />

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', minWidth: '150px' }}
          >
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Clothing">Clothing</option>
            <option value="Footwear">Footwear</option>
          </select>

          <select
            value={stockStatus}
            onChange={(e) => { setStockStatus(e.target.value); setPage(1); }}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', minWidth: '150px' }}
          >
            <option value="">All Stock Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock (≤20)</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>

        </div>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Product Catalog Table */}
        {isLoading ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: '#6b7280' }}>
            <p>Loading product catalog data...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: '6px' }}>
            <p style={{ fontSize: '1.125rem', fontWeight: '500', margin: 0 }}>No products found</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Try clearing filters or search parameters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th onClick={() => handleSort('name')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
                    Product Name {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('sku')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
                    SKU {sortBy === 'sku' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Category</th>
                  <th onClick={() => handleSort('cost_of_goods')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
                    Cost {sortBy === 'cost_of_goods' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('current_price')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
                    Price {sortBy === 'current_price' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('stock')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
                    Stock Level {sortBy === 'stock' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: '600' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  let badgeBg = '#d1fae5';
                  let badgeColor = '#065f46';
                  if (product.stock_status === 'low-stock') {
                    badgeBg = '#fef3c7';
                    badgeColor = '#92400e';
                  } else if (product.stock_status === 'out-of-stock') {
                    badgeBg = '#fee2e2';
                    badgeColor = '#991b1b';
                  }

                  return (
                    <tr
                      key={product.id}
                      onClick={() => router.push(`/products/${product.id}`)}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '1rem', fontWeight: '500', color: '#111827' }}>{product.name}</td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}><code>{product.sku}</code></td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}>{product.category}</td>
                      <td style={{ padding: '1rem', color: '#111827' }}>${product.cost_of_goods.toFixed(2)}</td>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#4f46e5' }}>${product.current_price.toFixed(2)}</td>
                      <td style={{ padding: '1rem', color: '#111827' }}>{product.stock_level} units</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: badgeBg, color: badgeColor }}>
                          {product.stock_status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Row */}
        {pagination && pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                disabled={page === pagination.pages}
                onClick={() => setPage(page + 1)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#fff', cursor: page === pagination.pages ? 'not-allowed' : 'pointer', opacity: page === pagination.pages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
