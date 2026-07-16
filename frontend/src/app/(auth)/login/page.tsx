'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LoginSchema } from '@klypup/shared';
import { Mail, Lock, Eye, EyeOff, TrendingUp, Play, ShieldAlert, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setValidationErrors({});

    const formData = { email, password };
    const parseResult = LoginSchema.safeParse(formData);

    if (!parseResult.success) {
      const fieldErrors: { [key: string]: string } = {};
      parseResult.error.errors.forEach((err) => {
        const fieldName = err.path[0] as string;
        fieldErrors[fieldName] = err.message;
      });
      setValidationErrors(fieldErrors);
      setIsLoading(false);
      return;
    }

    try {
      await login(parseResult.data);
      router.push('/');
    } catch (err: any) {
      setError(err.error || err.message || 'Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12 bg-white">
      {/* Left panel: Decorative / Marketing Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 flex-col justify-between p-12 bg-neutral-50 border-r border-neutral-100 relative overflow-hidden">
        {/* Subtle grid lines background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] opacity-25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Branding header */}
        <div className="flex items-center space-x-3 z-10 select-none">
          <div className="w-9 h-9 rounded-xl bg-neutral-950 flex items-center justify-center shadow-md">
            <span className="text-white font-black text-base tracking-wider font-mono">K</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-neutral-950">KLYPUP</h1>
            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest -mt-0.5">Pricing Intelligence</p>
          </div>
        </div>

        {/* Center illustration: Interactive Pricing Widgets */}
        <div className="flex flex-col justify-center items-center py-12 relative z-10 w-full max-w-sm mx-auto select-none">
          {/* Subtle glow effect behind widgets */}
          <div className="absolute w-64 h-64 bg-neutral-200/50 rounded-full blur-3xl -z-10" />

          {/* Widget 1: Monitored Products Card */}
          <div className="bg-white/90 backdrop-blur-md shadow-sm border border-neutral-200/60 rounded-2xl p-5 w-72 self-start transform -rotate-1 hover:rotate-0 hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">MONITORED PRODUCTS</span>
                <span className="text-3xl font-extrabold tracking-tight text-neutral-950 block">1,248</span>
              </div>
              <div className="bg-neutral-50 border border-neutral-200/60 p-2 rounded-xl text-neutral-800 shadow-sm">
                <TrendingUp className="h-5 w-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-2 text-xs font-semibold text-emerald-600">
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100">+12.4%</span>
              <span className="text-neutral-400 font-normal">vs last week</span>
            </div>
          </div>

          {/* Widget 2: Donut Chart Card */}
          <div className="bg-white/90 backdrop-blur-md shadow-md border border-neutral-200/60 rounded-2xl p-5 w-64 self-end -mt-6 mr-4 z-20 transform rotate-2 hover:rotate-0 hover:scale-[1.02] transition-all duration-300">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-3">AUTO-RUN ACCURACY</span>
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    className="stroke-neutral-100"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    className="stroke-neutral-950"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray="169.6"
                    strokeDashoffset="27.1"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-sm font-extrabold text-neutral-950 leading-none">84%</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
                  <span className="text-[11px] font-bold text-neutral-800">Auto-executed</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                  <span className="text-[11px] font-medium text-neutral-400">Analyst Review</span>
                </div>
              </div>
            </div>
          </div>

          {/* Widget 3: Action Trigger Card */}
          <div className="bg-white/70 backdrop-blur-sm border-2 border-dashed border-neutral-200 rounded-2xl p-4 w-72 self-start mt-4 hover:border-neutral-400 hover:bg-white/90 transition-all duration-300 group cursor-pointer">
            <div className="flex items-center space-x-3.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-200 group-hover:bg-neutral-950 group-hover:border-neutral-950 group-hover:text-white transition-all text-neutral-700 shadow-sm">
                <Play className="h-4 w-4 fill-current ml-0.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-800 group-hover:text-neutral-950 transition-colors">Simulate Market Day</h4>
                <p className="text-[10px] text-neutral-400 mt-0.5">Generate competitor updates</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 flex items-center justify-between text-[11px] text-neutral-400 font-medium select-none">
          <span>© {new Date().getFullYear()} Klypup.</span>
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI pricing monitoring online</span>
          </span>
        </div>
      </div>

      {/* Right panel: Login Form */}
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center px-6 py-12 md:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">Welcome back</h2>
            <p className="text-sm text-neutral-500">
              Start optimizing your product pricing faster and better.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start space-x-2.5 rounded-xl bg-red-50/50 border border-red-200 p-3.5 text-xs text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
              <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className={`block w-full rounded-xl border ${
                    validationErrors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-neutral-200 focus:ring-neutral-950 focus:border-neutral-950'
                  } bg-neutral-50/50 py-3 pl-10 pr-4 text-neutral-900 placeholder-neutral-400 focus:bg-white focus:ring-1 sm:text-sm transition-all outline-none`}
                  placeholder="you@company.com"
                  required
                />
              </div>
              {validationErrors.email && (
                <p className="text-xs font-medium text-red-600 pl-1">{validationErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Password
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Password reset has not been configured in this environment.');
                  }}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-950 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={`block w-full rounded-xl border ${
                    validationErrors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-neutral-200 focus:ring-neutral-950 focus:border-neutral-950'
                  } bg-neutral-50/50 py-3 pl-10 pr-10 text-neutral-900 placeholder-neutral-400 focus:bg-white focus:ring-1 sm:text-sm transition-all outline-none`}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-xs font-medium text-red-600 pl-1">{validationErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center rounded-xl bg-neutral-950 py-3.5 px-4 text-sm font-bold text-white shadow-sm hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Logging in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 group">
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              )}
            </button>
          </form>

          {/* Or Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-neutral-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase select-none">
              <span className="bg-white px-3.5 text-neutral-400 font-bold tracking-wider">or</span>
            </div>
          </div>

          {/* Footer prompt */}
          <p className="text-center text-sm text-neutral-500">
            Don't have an account?{' '}
            <a href="/signup" className="font-bold text-neutral-950 hover:underline underline-offset-4 transition-colors">
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
