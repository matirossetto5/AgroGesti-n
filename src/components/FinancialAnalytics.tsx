import React, { useMemo } from 'react';
import { analyticsService, FinancialMetrics } from '../services';
import { TrendingUp, TrendingDown, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface FinancialAnalyticsProps {
  incomes: any[];
  expenses: any[];
  investmentAmount?: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function FinancialAnalytics({ incomes, expenses, investmentAmount = 0 }: FinancialAnalyticsProps) {
  const totalIncome = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
  const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const metrics = useMemo(() => {
    return analyticsService.calculateMetrics(totalIncome, totalExpense, investmentAmount);
  }, [totalIncome, totalExpense, investmentAmount]);

  const monthlyData = useMemo(() => {
    return analyticsService.compareMonths(incomes, expenses, 6);
  }, [incomes, expenses]);

  const expenseCategories = useMemo(() => {
    return analyticsService.categorizeExpenses(expenses);
  }, [expenses]);

  const highExpenses = useMemo(() => {
    return analyticsService.identifyHighExpenseCategories(expenses, 15);
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Ingresos Totales"
          value={`$${metrics.totalIncome.toLocaleString('es-AR')}`}
          color="emerald"
        />
        <MetricCard
          label="Gastos Totales"
          value={`$${metrics.totalExpense.toLocaleString('es-AR')}`}
          color="red"
        />
        <MetricCard
          label="Ganancia Neta"
          value={`$${metrics.netProfit.toLocaleString('es-AR')}`}
          color={metrics.netProfit >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Margen de Ganancia"
          value={`${metrics.profitMargin.toFixed(1)}%`}
          color="blue"
        />
        <MetricCard
          label="ROI"
          value={`${metrics.roi.toFixed(1)}%`}
          color={metrics.roi >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <h4 className="font-semibold text-stone-900 mb-4">Flujo de Caja (Últimos 6 meses)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                contentStyle={{ backgroundColor: '#f5f5f4', border: '1px solid #d4d4d8' }}
                formatter={(value) => `$${(value as number).toLocaleString('es-AR')}`}
              />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" name="Ingresos" strokeWidth={2} />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Gastos" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <h4 className="font-semibold text-stone-900 mb-4">Gastos por Categoría</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={expenseCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} (${percentage.toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {expenseCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${(value as number).toLocaleString('es-AR')}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Balance */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <h4 className="font-semibold text-stone-900 mb-4">Balance Mensual</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              contentStyle={{ backgroundColor: '#f5f5f4', border: '1px solid #d4d4d8' }}
              formatter={(value) => `$${(value as number).toLocaleString('es-AR')}`}
            />
            <Legend />
            <Bar dataKey="balance" fill="#3b82f6" name="Balance" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* High Expenses Warning */}
      {highExpenses.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Categorías de Alto Gasto
          </h4>
          <div className="space-y-2">
            {highExpenses.map((cat, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-amber-800">{cat.category}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-amber-200 rounded-full h-2">
                    <div
                      className="bg-amber-600 h-2 rounded-full"
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="font-medium text-amber-900 w-16 text-right">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color
}: {
  label: string;
  value: string;
  color: 'emerald' | 'red' | 'green' | 'blue';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900'
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
