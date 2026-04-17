import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet, Users, CloudRain, 
  ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon, 
  BarChart3, Calendar
} from 'lucide-react';

interface DashboardModuleProps {
  farmId: string;
  farmRains: any[];
  farmExpenses: any[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardModule({ farmId, farmRains, farmExpenses }: DashboardModuleProps) {
  const [incomes, setIncomes] = useState<any[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!farmId) return;
    setIsLoading(true);

    const incomesRef = collection(db, `farms/${farmId}/incomes`);
    const unsubIncomes = onSnapshot(incomesRef, (snapshot) => {
      setIncomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const animalsRef = collection(db, `farms/${farmId}/animals`);
    const unsubAnimals = onSnapshot(animalsRef, (snapshot) => {
      setAnimals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => {
      unsubIncomes();
      unsubAnimals();
    };
  }, [farmId]);

  // --- DATA PROCESSING ---

  const stats = useMemo(() => {
    const totalIncomes = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
    const totalExpenses = farmExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const balance = totalIncomes - totalExpenses;
    
    const activeAnimals = animals.filter(a => a.status === 'Activo').length;
    const totalRain = farmRains.reduce((sum, r) => sum + (r.mm || 0), 0);

    return { totalIncomes, totalExpenses, balance, activeAnimals, totalRain };
  }, [incomes, farmExpenses, farmRains, animals]);

  // Cash Flow Data (Monthly)
  const cashFlowData = useMemo(() => {
    const months: Record<string, { month: string, ingresos: number, gastos: number }> = {};
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleDateString('es-AR', { month: 'short' });
      months[key] = { month: name, ingresos: 0, gastos: 0 };
      last6Months.push(key);
    }

    incomes.forEach(inc => {
      if (!inc.date) return;
      const key = inc.date.substring(0, 7);
      if (months[key]) months[key].ingresos += inc.amount;
    });

    farmExpenses.forEach(exp => {
      if (!exp.date) return;
      const key = exp.date.substring(0, 7);
      if (months[key]) months[key].gastos += exp.amount;
    });

    return last6Months.map(key => months[key]);
  }, [incomes, farmExpenses]);

  // Expenses by Category
  const expenseByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    farmExpenses.forEach(exp => {
      categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [farmExpenses]);

  // Livestock by Category
  const animalsByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    animals.filter(a => a.status === 'Activo').forEach(a => {
      categories[a.category] = (categories[a.category] || 0) + 1;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [animals]);

  // Rainfall Data (Last 10 events)
  const rainData = useMemo(() => {
    return farmRains
      .slice(0, 10)
      .reverse()
      .map(r => {
        const d = r.date ? new Date(r.date) : new Date();
        return {
          date: isNaN(d.getTime()) ? '?' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
          mm: r.mm || 0
        };
      });
  }, [farmRains]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-stone-500 font-medium">Cargando tablero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-stone-900 tracking-tight">Panel de Control</h2>
          <p className="text-stone-500">Resumen general y métricas de rendimiento</p>
        </div>
        <div className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-2xl">
          <Calendar className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-bold text-stone-600">
            {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            {stats.balance >= 0 ? (
              <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <ArrowUpRight className="w-3 h-3 mr-1" /> Saludable
              </span>
            ) : (
              <span className="flex items-center text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <ArrowDownRight className="w-3 h-3 mr-1" /> Déficit
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-stone-400 uppercase tracking-wider">Balance Total</p>
          <p className={`text-2xl font-black mt-1 ${stats.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            $ {stats.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-stone-400 uppercase tracking-wider">Stock Ganadero</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{stats.activeAnimals} <span className="text-sm font-medium text-blue-400">cabezas</span></p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-stone-400 uppercase tracking-wider">Total Ingresos</p>
          <p className="text-2xl font-black text-amber-700 mt-1">$ {stats.totalIncomes.toLocaleString('es-AR')}</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-sky-100 rounded-2xl">
              <CloudRain className="w-6 h-6 text-sky-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-stone-400 uppercase tracking-wider">Lluvia Total</p>
          <p className="text-2xl font-black text-sky-900 mt-1">{stats.totalRain} <span className="text-sm font-medium text-sky-400">mm</span></p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cash Flow Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm h-[400px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-stone-100 rounded-xl">
              <Activity className="w-5 h-5 text-stone-600" />
            </div>
            <h3 className="text-lg font-black text-stone-800 tracking-tight">Flujo de Caja Mensual</h3>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(value) => `$${value/1000}k`} />
              <Tooltip 
                contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                cursor={{fill: '#f9fafb'}}
              />
              <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
              <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos" />
              <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Gastos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm h-[400px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-stone-100 rounded-xl">
              <PieChartIcon className="w-5 h-5 text-stone-600" />
            </div>
            <h3 className="text-lg font-black text-stone-800 tracking-tight">Distribución de Gastos</h3>
          </div>
          <div className="flex items-center h-[80%]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Rainfall */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm h-[400px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-stone-100 rounded-xl">
              <CloudRain className="w-5 h-5 text-stone-600" />
            </div>
            <h3 className="text-lg font-black text-stone-800 tracking-tight">Evolución de Lluvias (u8 eventos)</h3>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={rainData}>
              <defs>
                <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <Tooltip 
                contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
              />
              <Area type="monotone" dataKey="mm" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRain)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Livestock Composition */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm h-[400px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-stone-100 rounded-xl">
              <BarChart3 className="w-5 h-5 text-stone-600" />
            </div>
            <h3 className="text-lg font-black text-stone-800 tracking-tight">Composición de Hacienda</h3>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={animalsByCategory} layout="vertical" margin={{left: 20}}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontWeight: 'bold', fontSize: 12}} width={80} />
              <Tooltip 
                contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Animales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
