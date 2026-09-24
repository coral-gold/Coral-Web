import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ ok: true, lines: [], itemCount: 0 });

  const refresh = useCallback(async () => {
    try {
      const d = await api.get('/cart');
      if (d.ok) setCart(d);
    } catch {}
  }, []);

  const cartAction = useCallback(async (body) => {
    try {
      const d = await api.post('/cart', body);
      if (d.ok) setCart(d);
      return d;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const add    = (productId)             => cartAction({ action: 'add', productId });
  const remark = (productId, text)       => cartAction({ action: 'remark', productId, remark: text });
  const remove = (productId)             => cartAction({ action: 'remove', productId });
  const clear  = ()                      => cartAction({ action: 'clear' });

  return (
    <CartCtx.Provider value={{ cart, refresh, add, remark, remove, clear }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() { return useContext(CartCtx); }
