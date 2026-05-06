import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface ValidationMessageProps {
  errors?: Array<{ message: string; type: 'error' | 'warning' }>;
  warnings?: Array<{ message: string; type: 'error' | 'warning' }>;
  compact?: boolean;
}

export function ValidationMessage({
  errors = [],
  warnings = [],
  compact = false
}: ValidationMessageProps) {
  const allMessages = [...errors, ...warnings];

  if (allMessages.length === 0) return null;

  const errorCount = errors.length;
  const warningCount = warnings.length;

  if (compact) {
    return (
      <div className="space-y-2">
        {errorCount > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">{errorCount} error{errorCount > 1 ? 'es' : ''}</p>
              <ul className="text-xs text-red-700 mt-1 space-y-1">
                {errors.map((err, idx) => (
                  <li key={idx}>• {err.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {warningCount > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">{warningCount} advertencia{warningCount > 1 ? 's' : ''}</p>
              <ul className="text-xs text-amber-700 mt-1 space-y-1">
                {warnings.map((warn, idx) => (
                  <li key={idx}>• {warn.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-4">
      {errors.map((error, idx) => (
        <div
          key={`error-${idx}`}
          className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error.message}</p>
          </div>
        </div>
      ))}

      {warnings.map((warning, idx) => (
        <div
          key={`warning-${idx}`}
          className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Advertencia</p>
            <p className="text-sm text-amber-700 mt-1">{warning.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface FieldErrorProps {
  error?: string;
  warning?: string;
}

export function FieldError({ error, warning }: FieldErrorProps) {
  if (error) {
    return (
      <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    );
  }

  if (warning) {
    return (
      <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {warning}
      </p>
    );
  }

  return null;
}
