export interface FinancialMetrics {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: number;
  roi: number;
  expenseRatio: number;
  breakEvenPoint: number;
}

export interface CategoryAnalysis {
  category: string;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MonthlyComparison {
  month: string;
  income: number;
  expense: number;
  balance: number;
  growth: number;
}

export interface CropROI {
  cropName: string;
  investedAmount: number;
  harvestedAmount: number;
  roi: number;
  profitPerUnit: number;
}

export const analyticsService = {
  calculateMetrics(
    totalIncome: number,
    totalExpense: number,
    investmentAmount: number = 0
  ): FinancialMetrics {
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const effectiveInvestment = investmentAmount || totalExpense;
    const roi = effectiveInvestment > 0 ? (netProfit / effectiveInvestment) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
    const breakEvenPoint = expenseRatio > 0 ? 100 / (1 - expenseRatio / 100) : 0;

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin: Math.round(profitMargin * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      expenseRatio: Math.round(expenseRatio * 100) / 100,
      breakEvenPoint: Math.round(breakEvenPoint * 100) / 100
    };
  },

  categorizeExpenses(expenses: any[]): CategoryAnalysis[] {
    const categories: Record<string, number> = {};
    let total = 0;

    expenses.forEach(exp => {
      const category = exp.category || 'Sin categoría';
      categories[category] = (categories[category] || 0) + exp.amount;
      total += exp.amount;
    });

    return Object.entries(categories).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      trend: 'stable'
    }));
  },

  compareMonths(incomes: any[], expenses: any[], monthsCount: number = 6): MonthlyComparison[] {
    const months: Record<string, { income: number; expense: number }> = {};

    for (let i = monthsCount - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toISOString().substring(0, 7);
      const monthName = date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      months[key] = { income: 0, expense: 0 };
    }

    incomes.forEach(inc => {
      if (!inc.date) return;
      const key = inc.date.substring(0, 7);
      if (months[key]) months[key].income += inc.amount;
    });

    expenses.forEach(exp => {
      if (!exp.date) return;
      const key = exp.date.substring(0, 7);
      if (months[key]) months[key].expense += exp.amount;
    });

    const comparisons: MonthlyComparison[] = [];
    let previousBalance = 0;

    Object.entries(months).forEach(([key, data]) => {
      const balance = data.income - data.expense;
      const growth = previousBalance !== 0 ? ((balance - previousBalance) / previousBalance) * 100 : 0;

      comparisons.push({
        month: key,
        income: Math.round(data.income),
        expense: Math.round(data.expense),
        balance: Math.round(balance),
        growth: Math.round(growth * 100) / 100
      });

      previousBalance = balance;
    });

    return comparisons;
  },

  calculateCropROI(
    cropName: string,
    investedAmount: number,
    harvestedAmount: number,
    harvestedUnits: number = 1
  ): CropROI {
    const roi = ((harvestedAmount - investedAmount) / investedAmount) * 100;
    const profitPerUnit = harvestedUnits > 0 ? (harvestedAmount - investedAmount) / harvestedUnits : 0;

    return {
      cropName,
      investedAmount,
      harvestedAmount,
      roi: Math.round(roi * 100) / 100,
      profitPerUnit: Math.round(profitPerUnit * 100) / 100
    };
  },

  predictNextMonth(monthlyComparisons: MonthlyComparison[]): MonthlyComparison | null {
    if (monthlyComparisons.length < 2) return null;

    const recent = monthlyComparisons.slice(-3);
    const avgGrowth = recent.reduce((sum, m) => sum + m.growth, 0) / recent.length;
    const lastMonth = recent[recent.length - 1];

    const predictedIncome = Math.round(lastMonth.income * (1 + avgGrowth / 100));
    const predictedExpense = Math.round(lastMonth.expense * (1 + avgGrowth / 100));

    return {
      month: 'Próximo mes',
      income: predictedIncome,
      expense: predictedExpense,
      balance: predictedIncome - predictedExpense,
      growth: avgGrowth
    };
  },

  identifyHighExpenseCategories(expenses: any[], threshold: number = 20): CategoryAnalysis[] {
    const categories = this.categorizeExpenses(expenses);
    return categories.filter(cat => cat.percentage > threshold).sort((a, b) => b.amount - a.amount);
  }
};
