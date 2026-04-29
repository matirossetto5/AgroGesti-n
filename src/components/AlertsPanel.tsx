import React from 'react';
import { Notification, notificationService } from '../services';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface AlertsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AlertsPanel({ notifications, onMarkAsRead, onDelete }: AlertsPanelProps) {
  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
        <Info className="w-12 h-12 mx-auto text-stone-400 mb-3" />
        <p className="text-stone-600">No hay notificaciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`p-4 rounded-lg border flex gap-3 transition-all cursor-pointer hover:shadow-md ${
            notif.read
              ? 'bg-stone-50 border-stone-200'
              : 'bg-blue-50 border-blue-200'
          }`}
          onClick={() => !notif.read && onMarkAsRead(notif.id)}
        >
          <div className="flex-shrink-0">
            {notif.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600" />}
            {notif.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {notif.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
            {notif.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 text-sm">{notif.title}</p>
            <p className="text-xs text-stone-600 mt-1">{notif.message}</p>
            <p className="text-[10px] text-stone-400 mt-2">
              {new Date(notif.timestamp).toLocaleString('es-AR')}
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notif.id);
            }}
            className="flex-shrink-0 text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
