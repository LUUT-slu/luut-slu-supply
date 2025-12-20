import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct } from '@/lib/shopify';
import { supabase } from '@/integrations/supabase/client';

export interface CartItem {
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

export interface OrderConfirmation {
  id: number;
  name: string; // Order number like #D1
  status: string;
  totalPrice: string;
  currency: string;
  createdAt: string;
  customerName: string;
  location: string;
  preferredDate: string;
  note: string | null;
  lineItems: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
}

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  isOpen: boolean;
  confirmedOrder: OrderConfirmation | null;
  
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  setOpen: (open: boolean) => void;
  createOrder: (orderDetails: {
    customerName: string;
    location: string;
    preferredDate: string;
    note?: string;
  }) => Promise<OrderConfirmation | null>;
  clearConfirmedOrder: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isOpen: false,
      confirmedOrder: null,

      addItem: (item) => {
        const { items } = get();
        const existingItem = items.find(i => i.variantId === item.variantId);
        
        if (existingItem) {
          set({
            items: items.map(i =>
              i.variantId === item.variantId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        
        set({
          items: get().items.map(item =>
            item.variantId === variantId ? { ...item, quantity } : item
          )
        });
      },

      removeItem: (variantId) => {
        set({
          items: get().items.filter(item => item.variantId !== variantId)
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setOpen: (isOpen) => set({ isOpen }),
      
      clearConfirmedOrder: () => set({ confirmedOrder: null }),

      createOrder: async (orderDetails) => {
        const { items, setLoading, getTotalPrice } = get();
        if (items.length === 0) return null;

        setLoading(true);
        try {
          const lineItems = items.map(item => ({
            variant_id: item.variantId,
            quantity: item.quantity,
            title: item.product.node.title,
            price: item.price.amount,
          }));

          const { data, error } = await supabase.functions.invoke('create-order', {
            body: {
              customerName: orderDetails.customerName,
              location: orderDetails.location,
              preferredDate: orderDetails.preferredDate,
              note: orderDetails.note,
              lineItems,
              totalPrice: getTotalPrice(),
            },
          });

          if (error) {
            console.error('Edge function error:', error);
            throw new Error(error.message || 'Failed to create order');
          }

          if (!data.success) {
            throw new Error(data.error || 'Failed to create order');
          }

          const confirmedOrder = data.order as OrderConfirmation;
          set({ confirmedOrder, items: [] });
          
          // Save order ID to localStorage for "My Orders" page
          const savedOrderIds = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");
          if (data.orderId && !savedOrderIds.includes(data.orderId)) {
            savedOrderIds.unshift(data.orderId);
            localStorage.setItem("luut-my-orders", JSON.stringify(savedOrderIds.slice(0, 50)));
          }
          
          return confirmedOrder;
        } catch (error) {
          console.error('Failed to create order:', error);
          throw error;
        } finally {
          setLoading(false);
        }
      },

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
          0
        );
      },
    }),
    {
      name: 'luut-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
