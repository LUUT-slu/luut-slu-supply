import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct } from '@/lib/shopify';

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

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  isOpen: boolean;
  currentSeller: string | null; // Track the current seller (vendor) in cart
  
  addItem: (item: CartItem) => { success: boolean; error?: string };
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  setOpen: (open: boolean) => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getCurrentSeller: () => string | null;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isOpen: false,
      currentSeller: null,

      addItem: (item) => {
        const { items, currentSeller } = get();
        const itemVendor = item.product.node.vendor;
        
        // Enforce single-seller checkout
        if (items.length > 0 && currentSeller && itemVendor !== currentSeller) {
          return { 
            success: false, 
            error: `Your cart contains items from "${currentSeller}". Please clear your cart before adding items from "${itemVendor}".` 
          };
        }
        
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
          set({ 
            items: [...items, item],
            currentSeller: itemVendor || currentSeller
          });
        }
        
        return { success: true };
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
        const newItems = get().items.filter(item => item.variantId !== variantId);
        set({
          items: newItems,
          currentSeller: newItems.length > 0 ? newItems[0].product.node.vendor : null
        });
      },

      clearCart: () => {
        set({ items: [], currentSeller: null });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setOpen: (isOpen) => set({ isOpen }),

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
          0
        );
      },
      
      getCurrentSeller: () => {
        return get().currentSeller;
      },
    }),
    {
      name: 'luut-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, currentSeller: state.currentSeller }),
    }
  )
);
