import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Users, CloudRain,
  ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon,
  BarChart3, Calendar, Droplets
} from 'lucide-react';

interface DashboardModuleProps {
  farmId: string;
  farmRains: any[];
  farmExpenses: any[];
}

const PALETTE = ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#8b5cf6', '#06b6d4'];

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
};

const tooltipStyle = {
  borderRadius: '1rem',
  border: 'none',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 600,
};

export default function DashboardModule({ farmId, farmRains, farmExpenses }: DashboardModuleProps) {
  const [incomes, setIncomes] = useState<any[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!farmId) return;
    setIsLoading(true);

    const unsubIncomes = onSnapshot(collection(db, `farms/${farmId}/incomes`), (snap) => {
      setIncomes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAnimals = onSnapshot(collection(db, `farms/${farmId}/animals`), (snap) => {
      setAnimals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => { unsubIncomes(); unsubAnimals(); };
  }, [farmId]);

  const stats = useMemo(() => {
    const totalIncomes = incomes.reduce((s, i) => s + (i.amount || 0), 0);
    const totalExpenses = farmExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const balance = totalIncomes - totalExpenses;
    const activeAnimals = animals.filter(a => a.status === 'Activo').length;
    const totalRain = farmRains.reduce((s, r) => s + (r.mm || 0), 0);
    return { totalIncomes, totalExpenses, balance, activeAnimals, totalRain };
  }, [incomes, farmExpenses, farmRains, animals]);

  const cashFlowData = useMemo(() => {
    const months: Record<string, { month: string; Ingresos: number; Gastos: number }> = {};
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleDateString('es-AR', { month: 'short' });
      months[key] = { month: name, Ingresos: 0, Gastos: 0 };
      keys.push(key);
    }
    incomes.forEach(i => { const k = (i.date || '').substring(0, 7); if (months[k]) months[k].Ingresos += i.amount || 0; });
    farmExpenses.forEach(e => { const k = (e.date || '').substring(0, 7); if (months[k]) months[k].Gastos += e.amount || 0; });
    return keys.map(k => months[k]);
  }, [incomes, farmExpenses]);

  const expenseByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    farmExpenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [farmExpenses]);

  const animalsByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    animals.filter(a => a.status === 'Activo').forEach(a => { cats[a.category] = (cats[a.category] || 0) + 1; });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [animals]);

  const rainData = useMemo(() =>
    farmRains.slice(0, 10).reverse().map(r => {
      const d = r.date ? new Date(r.date) : new Date();
      return { date: isNaN(d.getTime()) ? '?' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }), mm: r.mm || 0 };
    }),
  [farmRains]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-stone-500 font-medium">Cargando tablero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-3xl font-black text-stone-900 tracking-tight">Panel de Control</h2>
          <p className="text-stone-400 text-sm font-medium">Resumen general de tu establecimiento</p>
        </div>
        <div className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-2xl">
          <Calendar className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-bold text-stone-600">
            {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance */}
        <div className="col-span-2 lg:col-span-1 bg-white p-5 rounded-3xl border border-stone-200 shadow-sm hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-emerald-100 rounded-2xl">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            {stats.balance >= 0 ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
                <ArrowUpRight className="w-3 h-3" /> Saludable
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">
                <ArrowDownRight className="w-3 h-3" /> Déficit
              </span>
            )}
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Balance Total</p>
          <p className={`text-2xl font-black ${stats.balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatCurrency(stats.balance)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            $ {stats.balance.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
          </p>
        </div>

        {/* Ingresos */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm hover:shadow-lg transition-shadow">
          <div className="p-2.5 bg-emerald-100 rounded-2xl mb-3 w-fit">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total Ingresos</p>
          <p className="text-2xl font-black text-emerald-700">{formatCurrency(stats.totalIncomes)}</p>
          <p className="text-xs text-stone-400 mt-1">$ {stats.totalIncomes.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
        </div>

        {/* Gastos */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm hover:shadow-lg transition-shadow">
          <div className="p-2.5 bg-red-100 rounded-2xl mb-3 w-fit">
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total Gastos</p>
          <p className="text-2xl font-black text-red-600">{formatCurrency(stats.totalExpenses)}</p>
          <p className="text-xs text-stone-400 mt-1">$ {stats.totalExpenses.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
        </div>

        {/* Lluvia */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm hover:shadow-lg transition-shadow">
          <div className="p-2.5 bg-sky-100 rounded-2xl mb-3 w-fit">
            <CloudRain className="w-5 h-5 text-sky-500" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Lluvia Total</p>
          <p className="text-2xl font-black text-sky-700">{stats.totalRain.toFixed(0)} <span className="text-sm font-semibold text-sky-400">mm</span></p>
          <p className="text-xs text-stone-400 mt-1">{stats.activeAnimals} cabezas activas</p>
        </div>
      </div>

      {/* Comparativa visual ingresos vs gastos */}
      {(stats.totalIncomes > 0 || stats.totalExpenses > 0) && (
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Comparativa Ingresos vs Egresos</p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-emerald-700 w-20 text-right shrink-0">{formatCurrency(stats.totalIncomes)}</span>
            <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden flex">
              {stats.totalIncomes > 0 && (
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (stats.totalIncomes / Math.max(stats.totalIncomes, stats.totalExpenses)) * 100)}%` }}
                />
              )}
            </div>
            <span className="text-xs font-bold text-stone-400 w-16 shrink-0">Ingresos</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-bold text-red-600 w-20 text-right shrink-0">{formatCurrency(stats.totalExpenses)}</span>
            <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden flex">
              {stats.totalExpenses > 0 && (
                <div
                  className="h-full bg-red-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (stats.totalExpenses / Math.max(stats.totalIncomes, stats.totalExpenses)) * 100)}%` }}
                />
              )}
            </div>
            <span className="text-xs font-bold text-stone-400 w-16 shrink-0">Egresos</span>
          </div>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Cash Flow - wider */}
        <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-base font-black text-stone-800">Flujo de Caja Mensual</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cashFlowData} barGap={3} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={formatCurrency}
                width={52}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`, undefined]}
                cursor={{ fill: '#f8fafc', radius: 6 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '16px' }}
              />
              <Bar dataKey="Ingresos" fill="#10b981" radius={[6, 6, 2, 2]} />
              <Bar dataKey="Gastos" fill="#f43f5e" radius={[6, 6, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses Pie */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-amber-50 rounded-xl">
              <PieChartIcon className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-base font-black text-stone-800">Gastos por Rubro</h3>
          </div>
          {expenseByCategory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-stone-300">
              <PieChartIcon className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium text-stone-400">Sin gastos registrados</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="42%"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`, undefined]}
                />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rainfall */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 bg-sky-50 rounded-xl">
              <Droplets className="w-4 h-4 text-sky-500" />
            </div>
            <h3 className="text-base font-black text-stone-800">Evolución de Lluvias</h3>
          </div>
          {rainData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-300">
              <CloudRain className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium text-stone-400">Sin registros de lluvia</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rainData} margin={{ left: -10 }}>
                <defs>
                  <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" mm" width={50} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} mm`, 'Lluvia']}
                />
                <Area type="monotone" dataKey="mm" stroke="#3b82f6" strokeWidth={3} fill="url(#rainGrad)" dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hacienda */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 bg-blue-50 rounded-xl">
              <BarChart3 className="w-4 h-4 text-blue-500" />
            </div>
            <h3 className="text-base font-black text-stone-800">Composición de Hacienda</h3>
          </div>
          {animalsByCategory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-300">
              <Users className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium text-stone-400">Sin animales activos</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={animalsByCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontWeight: 700, fontSize: 12 }}
                  width={90}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} cabezas`, 'Stock']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Animales">
                  {animalsByCategory.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
