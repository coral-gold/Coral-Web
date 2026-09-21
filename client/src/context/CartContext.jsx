import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ ok: true, lines: [], itemCount: 0, pieceCount: 0 });
  const [panelOpen, setPanelOpen] = useState(false);

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

  const add    = (productId, qty = 1)   => cartAction({ action: 'add', productId, qty });
  const set    = (productId, qty)        => cartAction({ action: 'set', productId, qty });
  const remove = (productId)             => cartAction({ action: 'remove', productId });
  const clear  = ()                      => cartAction({ action: 'clear' });

  return (
    <CartCtx.Provider value={{ cart, refresh, add, set, remove, clear, panelOpen, setPanelOpen }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() { return useContext(CartCtx); }
