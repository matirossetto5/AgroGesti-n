export interface SearchOptions {
  caseSensitive?: boolean;
  fuzzy?: boolean;
}

export function searchByField(
  items: any[],
  searchTerm: string,
  fields: string[],
  options?: SearchOptions
): any[] {
  if (!searchTerm.trim()) return items;

  const term = options?.caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return items.filter(item => {
    return fields.some(field => {
      const value = getNestedValue(item, field);
      if (!value) return false;

      const stringValue = options?.caseSensitive
        ? String(value)
        : String(value).toLowerCase();

      return options?.fuzzy
        ? fuzzyMatch(term, stringValue)
        : stringValue.includes(term);
    });
  });
}

export function fuzzyMatch(search: string, target: string): boolean {
  let searchIdx = 0;
  let targetIdx = 0;

  while (searchIdx < search.length && targetIdx < target.length) {
    if (search[searchIdx] === target[targetIdx]) {
      searchIdx++;
    }
    targetIdx++;
  }

  return searchIdx === search.length;
}

export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

export function filterByDateRange(
  items: any[],
  field: string,
  startDate?: string,
  endDate?: string
): any[] {
  return items.filter(item => {
    const itemDate = getNestedValue(item, field);
    if (!itemDate) return true;

    const date = new Date(itemDate);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && date < start) return false;
    if (end && date > end) return false;

    return true;
  });
}

export function filterByRange(
  items: any[],
  field: string,
  min?: number,
  max?: number
): any[] {
  return items.filter(item => {
    const value = getNestedValue(item, field);
    if (value === undefined) return true;

    const numValue = Number(value);
    if (min !== undefined && numValue < min) return false;
    if (max !== undefined && numValue > max) return false;

    return true;
  });
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string | number): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(
  items: T[],
  keyFn: (item: T) => any,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function createFilterPipeline<T>(items: T[]) {
  return {
    items,
    search: (term: string, fields: string[], options?: SearchOptions) => {
      return createFilterPipeline(searchByField(items, term, fields, options));
    },
    dateRange: (field: string, start?: string, end?: string) => {
      return createFilterPipeline(filterByDateRange(items, field, start, end));
    },
    range: (field: string, min?: number, max?: number) => {
      return createFilterPipeline(filterByRange(items, field, min, max));
    },
    groupBy: (keyFn: (item: T) => string | number) => {
      return groupBy(items, keyFn);
    },
    sortBy: (keyFn: (item: T) => any, direction: 'asc' | 'desc' = 'asc') => {
      return createFilterPipeline(sortBy(items, keyFn, direction));
    },
    result: () => items
  };
}
