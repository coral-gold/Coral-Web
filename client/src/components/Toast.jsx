import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ opacity: 1 }}>
          {toast.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }
