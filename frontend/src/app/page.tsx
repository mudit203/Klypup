'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Search, LogOut, Play, CheckCircle2, AlertCircle, ShoppingBag, ArrowUpDown, ChevronRight, ClipboardList, Settings } from 'lucide-react';

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

  // Market Simulation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
  }, [user, page, search, category, stockStatus, sortBy, sortOrder, refreshTrigger]);

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

  const handleSimulateMarketDay = async () => {
    setIsSimulating(true);
    setError(null);
    try {
      await api.post('/simulation/run?triggerAi=false');
      toast.success('Market day simulation executed successfully! Stock levels, competitor listings, and demand indexes have updated.');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to simulate market day.';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsSimulating(false);
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
            onClick={() => router.push('/approval-queue')}
            className="flex items-center space-x-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
          >
            <ClipboardList className="h-4 w-4" />
            <span>Approval Queue</span>
          </button>

          {user.role === 'ADMIN' && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center space-x-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              <span>Admin Panel</span>
            </button>
          )}

          {user.role === 'ADMIN' && (
            <button
              onClick={handleSimulateMarketDay}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-900/50 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              <span>{isSimulating ? 'Simulating...' : 'Simulate Market Day'}</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 rounded-xl bg-[#000000] hover:bg-neutral-900 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 ease-in-out cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Glassmorphic Container */}
      <main className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xl shadow-neutral-100/50 p-6 md:p-8">
        
        {/* Filters and Controls Row */}
        <div className="flex flex-col sm:flex-row gap-3.5 mb-6 items-center">
          {/* Search bar with inner glow */}
          <div className="relative w-full sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Search className="h-4 w-4 text-neutral-400" />
            </div>
            <input
              type="text"
              placeholder="Search SKU or product name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="block w-full rounded-xl border border-neutral-200/80 bg-neutral-50 py-2.5 pl-10 pr-4 text-neutral-900 placeholder-neutral-400 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.04)] focus:border-neutral-950 focus:bg-white focus:ring-1 focus:ring-neutral-950 text-sm transition-all duration-200 outline-none"
            />
          </div>

          {/* Ghost Select: Category */}
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="w-full sm:w-auto bg-transparent border border-neutral-200/80 hover:border-neutral-950 text-neutral-500 hover:text-neutral-900 py-2.5 px-4 pr-8 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out cursor-pointer outline-none"
          >
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Clothing">Clothing</option>
            <option value="Footwear">Footwear</option>
          </select>

          {/* Ghost Select: Stock Status */}
          <select
            value={stockStatus}
            onChange={(e) => { setStockStatus(e.target.value); setPage(1); }}
            className="w-full sm:w-auto bg-transparent border border-neutral-200/80 hover:border-neutral-950 text-neutral-500 hover:text-neutral-900 py-2.5 px-4 pr-8 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out cursor-pointer outline-none"
          >
            <option value="">All Stock Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock (≤20)</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-start space-x-2.5 rounded-xl bg-red-50/50 border border-red-200 p-4 text-xs text-red-700 mb-6 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{error}</div>
          </div>
        )}


        {/* Product Catalog Table */}
        {isLoading ? (
          <div className="py-24 text-center">
            <svg className="animate-spin h-6 w-6 text-neutral-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs font-semibold text-neutral-400">Loading pricing intelligence database...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/20 select-none">
            <ShoppingBag className="h-8 w-8 text-neutral-300 mx-auto mb-2.5" />
            <h3 className="text-sm font-bold text-neutral-800">No products monitored</h3>
            <p className="text-xs text-neutral-400 mt-1">Try resetting the search or category filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 md:-mx-8">
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-150">
                  <th 
                    onClick={() => handleSort('name')} 
                    className="py-3.5 px-6 cursor-pointer text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em] select-none hover:text-neutral-900 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Product Name</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('sku')} 
                    className="py-3.5 px-6 cursor-pointer text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em] select-none hover:text-neutral-900 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>SKU</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Category</th>
                  <th 
                    onClick={() => handleSort('cost_of_goods')} 
                    className="py-3.5 px-6 cursor-pointer text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em] select-none hover:text-neutral-900 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Cost</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('current_price')} 
                    className="py-3.5 px-6 cursor-pointer text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em] select-none hover:text-neutral-900 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Price</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('stock')} 
                    className="py-3.5 px-6 cursor-pointer text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em] select-none hover:text-neutral-900 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Stock Level</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th className="py-3.5 px-6 text-[12px] font-bold text-neutral-400 uppercase tracking-[0.05em]">Status</th>
                  <th className="py-3.5 px-6 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((product) => {
                  let badgeClass = 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
                  if (product.stock_status === 'low-stock') {
                    badgeClass = 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
                  } else if (product.stock_status === 'out-of-stock') {
                    badgeClass = 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
                  }

                  return (
                    <tr
                      key={product.id}
                      onClick={() => router.push(`/products/${product.id}`)}
                      className="group cursor-pointer hover:bg-neutral-50/50 transition-all duration-200 ease-in-out"
                    >
                      <td className="py-4 px-6 text-sm font-bold text-neutral-900 group-hover:text-black">
                        {product.name}
                      </td>
                      <td className="py-4 px-6 text-sm font-mono text-neutral-500">
                        {product.sku}
                      </td>
                      <td className="py-4 px-6 text-sm text-neutral-500 font-medium">
                        {product.category}
                      </td>
                      <td className="py-4 px-6 text-sm font-semibold text-neutral-800">
                        ${product.cost_of_goods.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-[#007AFF] hover:underline decoration-[1.5px] transition-colors">
                        ${product.current_price.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-sm text-neutral-700 font-medium">
                        {product.stock_level} units
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                          {product.stock_status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-neutral-300 group-hover:text-neutral-900 transition-colors">
                        <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
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
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-neutral-100 select-none">
            <span className="text-xs text-neutral-400 font-semibold">
              Showing Page <strong className="text-neutral-900">{pagination.page}</strong> of <strong className="text-neutral-900">{pagination.pages}</strong>
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-3.5 py-2 text-xs font-bold text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 ease-in-out shadow-sm"
              >
                Previous
              </button>
              <button
                disabled={page === pagination.pages}
                onClick={() => setPage(page + 1)}
                className="rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-3.5 py-2 text-xs font-bold text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 ease-in-out shadow-sm"
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
