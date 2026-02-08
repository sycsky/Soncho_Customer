import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ShoppingBag, Gift, Ticket, ShoppingCart, Package, ExternalLink, Truck, Edit2, Check, X as CloseIcon, Loader2 } from 'lucide-react';
import './MessageCards.css';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { Toast, ToastRef } from './Toast';

interface ProductData {
  id: string;
  title: string;
  price: string;
  currency: string;
  url?: string;
  image?: string;
  handle?: string;
  variantId?: string;
  discounts?: string[];
}

interface ProductCardProps {
  data: ProductData | ProductData[];
  shop?: string;
  onImageLoad?: () => void;
}

interface GiftCardProps {
  data: {
    amount: string;
    code: string;
    currency: string;
  };
}

interface DiscountCardProps {
  data: {
    code: string;
    value: string;
    description: string;
  };
}

interface OrderData {
  orderNumber: string;
  orderId: string;
  totalPrice: string;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  note?: string;
  shippingAddress?: {
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
  trackingInfo?: Array<{
    number: string;
    url: string;
    company: string;
  }>;
  items?: Array<{
    title: string;
    quantity: number;
    price?: string;
    variantId?: string;
    variantTitle?: string;
  }>;
}

interface OrderCardProps {
  data: OrderData | OrderData[];
  onSendMessage?: (content: string) => void;
}

const copyToClipboard = async (text: string, t: any, onSuccess?: () => void) => {
    if (!text) return false;
    
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            onSuccess?.();
            return true;
        } else {
            // Fallback for non-secure context or older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            let fallbackSuccessful = false;
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    onSuccess?.();
                    fallbackSuccessful = true;
                } else {
                    toast.error(t('failed_copy'));
                }
            } catch (err) {
                console.error('Fallback copy failed', err);
                toast.error(t('failed_copy'));
            } finally {
                document.body.removeChild(textArea);
            }
            return fallbackSuccessful;
        }
    } catch (err) {
        console.error('Copy failed', err);
        toast.error(t('failed_copy'));
        return false;
    }
};

export const ProductCard: React.FC<ProductCardProps> = ({ data, shop, onImageLoad }) => {
  const { t } = useTranslation();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  
  let products: ProductData[] = [];
  let recommendation = "";

  if (Array.isArray(data)) {
    products = data;
  } else if (data && typeof data === 'object' && 'products' in data) {
    products = (data as any).products;
    recommendation = (data as any).recommendation;
  } else {
    products = [data as ProductData];
  }

  const getProductUrl = (product: ProductData) => {
    if (product.url) return product.url;
    if (shop && product.handle) {
      // Ensure shop doesn't have protocol
      const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${cleanShop}/products/${product.handle}`;
    }
    return null;
  };

  const handleClick = (product: ProductData) => {
    const url = getProductUrl(product);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleAddToCart = async (e: React.MouseEvent, product: ProductData) => {
    e.stopPropagation();
    
    // 尝试获取 variantId (gid://shopify/ProductVariant/123 -> 123)
    let variantId = '';
    if (product.variantId) {
      variantId = product.variantId.split('/').pop() || '';
    }

    if (!variantId) {
      console.warn('No variant ID found for product:', product);
      // Fallback: 如果没有 variantId，尝试跳转到产品页面
      handleClick(product);
      return;
    }

    // 确定目标 Origin
    let origin = '';
    // 优先使用 window.location.origin (如果在 Shopify 页面上)
    // 但如果 shop 参数存在且与当前 origin 不同，我们可能在 iframe 或开发环境中
    // 简单起见，如果提供了 shop，我们构造跳转链接；
    // 如果是嵌入式 App，通常希望 AJAX 添加。
    // 这里我们先尝试 AJAX 添加 (假设同源)，如果失败则打开新窗口。
    
    try {
      // 1. 尝试 AJAX 添加到购物车 (Section Rendering API for Dawn & Horizon & Universal)
      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', '1');

      // Request sections for update to ensure UI reflects the new state (fixes empty cart and rollback issues)
      // 1. Static/Known Section Names
      const staticSections = [
        'cart-drawer',
        'cart-notification',
        'cart-notification-product',
        'cart-notification-button',
        'cart-icon-bubble',
        'cart-bubble', 
        'cart-count',
        'header-cart', 
        'header-group', // For sticky headers
        'cart-live-region-text',
        'main-cart-items',
        'cart-footer'
      ];

      // 2. Dynamic Discovery: Find actual section IDs present in the current DOM
      // This fixes the issue where "cart-drawer.liquid" exists but is rendered with a dynamic ID (e.g. "template--123__cart-drawer")
      const dynamicSections: string[] = [];
      try {
          const sectionElements = document.querySelectorAll('[id^="shopify-section-"], [data-section-id]');
          sectionElements.forEach(el => {
              // Extract ID from data attribute or DOM ID
              const id = el.getAttribute('data-section-id') || el.id.replace('shopify-section-', '');
              if (id && (
                  id.includes('cart') || 
                  id.includes('drawer') || 
                  id.includes('header') || 
                  id.includes('notification')
              )) {
                  dynamicSections.push(id);
              }
          });
      } catch (e) {
          console.warn('Error discovering dynamic sections', e);
      }

      // Combine and deduplicate
      const sections = Array.from(new Set([...staticSections, ...dynamicSections]));
      
      formData.append('sections', sections.join(','));
      formData.append('sections_url', window.location.pathname);

      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
            'Accept': 'application/json'
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success(t('added_to_cart'));

        // --- UI 更新逻辑 (Section Injection + Event Broadcasting + HTML Scraping Fallback) ---
 
         // 0. Inject Sections (Priority Fix)
         let sectionsUpdated = false;
         if (data.sections && Object.keys(data.sections).length > 0) {
             Object.entries(data.sections).forEach(([sectionId, html]) => {
                 try {
                     // Try various selectors to find the container for this section
                     const selectors = [
                         `#shopify-section-${sectionId}`,
                         `#${sectionId}`,
                         `[data-section-id="${sectionId}"]`,
                         `.shopify-section.${sectionId}`,
                         `.${sectionId}`
                     ];
                     
                     let targetElement = null;
                     for (const selector of selectors) {
                         targetElement = document.querySelector(selector);
                         if (targetElement) break;
                     }

                     if (targetElement && typeof html === 'string') {
                         // Create a temporary container to parse the HTML
                         const tempDiv = document.createElement('div');
                         tempDiv.innerHTML = html;
                         
                         // Special handling for cart-icon-bubble which is often just the content
                         if (sectionId === 'cart-icon-bubble' || sectionId === 'cart-bubble') {
                              targetElement.innerHTML = html;
                         } else {
                              // Safer replacement strategy
                              targetElement.innerHTML = html;
                         }
                         sectionsUpdated = true;
                     }
                 } catch (e) {
                     console.warn(`Failed to update section ${sectionId}`, e);
                 }
             });
         }

         // 0.5 Fallback: HTML Scraping (If sections failed or were empty)
         // This solves the "empty cart not refreshing" issue on themes where we don't know the section IDs.
         if (!sectionsUpdated) {
             try {
                 // Fetch the full cart page (HTML) which is guaranteed to have the correct state
                 const cartPageResponse = await fetch('/cart');
                 const cartPageText = await cartPageResponse.text();
                 const parser = new DOMParser();
                 const doc = parser.parseFromString(cartPageText, 'text/html');

                 // List of critical UI elements to sync
                 const criticalSelectors = [
                     // Cart Count / Badge
                     '.cart-count',
                     '#CartCount',
                     '.site-header__cart-count',
                     '[data-cart-count]',
                     '.cart-count-bubble',
                     '.header__cart-count',
                     '[data-header-cart-count]',
                     '.header-bar__cart-count',
                     
                     // Cart Icon Containers (often contain the count)
                     '.site-header__cart',
                     '.header__icon--cart',
                     '#cart-icon-bubble',
                     
                     // Drawers / Mini Carts (Updating these prevents "rollback" when opening)
                     '#CartDrawer',
                     '#cart-drawer',
                     '.cart-drawer',
                     'cart-drawer',
                     'cart-notification'
                 ];

                 criticalSelectors.forEach(selector => {
                     const currentEls = document.querySelectorAll(selector);
                     const newEl = doc.querySelector(selector);

                     if (currentEls.length > 0 && newEl) {
                         currentEls.forEach(currentEl => {
                             // Don't replace if it's a complex interactive component that might break
                             // UNLESS it's a simple badge or icon container
                             if (currentEl.tagName.includes('-') && !selector.includes('cart-drawer')) {
                                 // Custom element: try to just update innerHTML if possible to preserve listeners on the host?
                                 // Actually, replacing innerHTML is safer than replacing the element itself for React/Vue hydration
                                 currentEl.innerHTML = newEl.innerHTML;
                             } else {
                                 // Standard element: replace content
                                 currentEl.innerHTML = newEl.innerHTML;
                                 
                                 // Sync classes (important for removing 'hidden' class)
                                 currentEl.className = newEl.className;
                                 
                                 // Sync attributes (aria-hidden, etc.)
                                 Array.from(newEl.attributes).forEach(attr => {
                                     currentEl.setAttribute(attr.name, attr.value);
                                 });
                             }
                         });
                     }
                 });
             } catch (scrapeErr) {
                 console.warn('HTML Scraping fallback failed', scrapeErr);
             }
         }
        
        // 1. 获取最新的完整购物车数据
        let cartData = null;
        let itemCount = null;
        try {
            const cartRes = await fetch('/cart.js');
            if (cartRes.ok) {
                cartData = await cartRes.json();
                itemCount = cartData.item_count;
            }
        } catch (e) {
            console.warn('Failed to fetch full cart', e);
        }

        const currentCount = itemCount !== null ? itemCount : (data.item_count || 1); 

        // 2. 全方位事件广播 (The "Nuclear" Dispatch Strategy)
        try {
            const detailData = cartData || data;
            
            // Standard / Common
            document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: detailData }));
            window.dispatchEvent(new CustomEvent('cart:add', { detail: data }));
            window.dispatchEvent(new CustomEvent('shopify:cart:update', { detail: detailData }));
            
            // Dawn / Shopify 2.0
            const cartUpdateEvent = new CustomEvent('cart-update', { bubbles: true, detail: { cart: detailData } });
            document.querySelector('cart-notification')?.dispatchEvent(cartUpdateEvent);
            document.querySelector('cart-drawer')?.dispatchEvent(cartUpdateEvent);
            
            // Horizon 2025 / Newer Themes
            document.dispatchEvent(new CustomEvent('CartAddEvent', { bubbles: true, detail: detailData }));
            document.dispatchEvent(new CustomEvent('cart:build', { bubbles: true })); // Streamline 等
            
            // Prestige, Warehouse 等高端商业主题
            document.dispatchEvent(new CustomEvent('cart:refresh', { detail: detailData }));

            // Turbo, Flex 等 Out of the Sandbox 系列
            document.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));

            // 针对一些老款 jQuery 主题
            if ((window as any).jQuery) {
                try {
                    (window as any).jQuery('body').trigger('added_to_cart', [detailData]);
                    (window as any).jQuery(document).trigger('cart.requestComplete', [detailData]);
                } catch (jqErr) {
                    console.warn('jQuery trigger failed', jqErr);
                }
            }

            // 针对 AJAX Cart API 库
            document.dispatchEvent(new CustomEvent('cart-updated', { detail: detailData }));

            // Legacy / Global Functions
            if ((window as any).Shopify?.onCartUpdate && cartData) {
                (window as any).Shopify.onCartUpdate(cartData);
            }
            if ((window as any).ajaxCart?.load) {
                (window as any).ajaxCart.load();
            }
            // Impulse / UpsellPlus suggestions
            const qtyInputs = document.querySelectorAll('form.ajaxcart .js-qty__num, form.cart__contents input.quantity__input, input.ajaxcart__qty-num');
            if (qtyInputs.length > 0) {
                qtyInputs.forEach(input => input.dispatchEvent(new Event('change', { bubbles: true })));
            }

        } catch (e) {
            console.log('Failed to dispatch theme events', e);
        }

        // 3. 手动 DOM 更新 (Manual DOM Manipulation - Expanded)
        if (currentCount !== null) {
            try {
                const selectors = [
                    '#CartCount',
                    '.cart-count',
                    '.site-header__cart-count',
                    '[data-cart-count]',
                    '.cart-link__bubble-num',
                    '.header__cart-count',
                    '[data-header-cart-count]',
                    '.header-bar__cart-count',
                    '.cart-count-bubble span[aria-hidden="true"]', // Dawn
                    '.header__icon--cart .icon-cart + span', // Generic structure
                    '.header__icon--cart span:last-child',
                    '.cart-count-bubble__text',
                    '.cart-count-bubble span',
                    'cart-count',
                    'cart-count-bubble',
                    '[data-testid="cart-count"]',
                    '[data-testid="cart-bubble"]',
                    '[data-id="cart-count"]',
                    '[data-id="cart-bubble"]'
                ];
                
                selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        // CRITICAL FIX: Prevent overwriting body or html content
                        if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
                        
                        el.textContent = currentCount.toString();
                        el.classList.remove('hide', 'hidden', 'invisible', 'is-hidden');
                        
                        // Handle parents
                        const bubble = el.closest('.cart-count-bubble') || el.closest('.site-header__cart-indicator');
                        if (bubble && currentCount > 0) {
                            bubble.classList.remove('hide', 'hidden', 'invisible', 'is-hidden');
                        }
                    });
                });

                const customCountEls = document.querySelectorAll('cart-count, cart-count-bubble, [data-testid="cart-count"], [data-testid="cart-bubble"]');
                customCountEls.forEach(el => {
                    if ((el as any).count !== undefined) {
                        (el as any).count = currentCount;
                    }
                    if ((el as any).setCount) {
                        (el as any).setCount(currentCount);
                    }
                });

                // Use a safe attribute for body state to avoid selector conflicts
                document.documentElement.setAttribute('data-current-cart-count', currentCount.toString());
                document.body.setAttribute('data-current-cart-count', currentCount.toString());
                
                // Final confirmation event
                document.documentElement.dispatchEvent(new CustomEvent('cart:updated', {
                    bubbles: true,
                    detail: { cart: cartData || data }
                }));
            } catch (e) {
                console.warn('Manual UI update failed', e);
            }
        }
        
        // 4. 强制唤醒/打开抽屉 (Force Open Logic)
        // 针对 "只更新数字，不弹窗" 的问题
        try {
            // A. Dawn: 如果没有 cart-notification，尝试添加 'active' 类到 cart-notification
            const cartNotification = document.querySelector('cart-notification');
            if (cartNotification && !(cartNotification as any).renderContents) {
                cartNotification.classList.add('active');
            }
            
            // B. Generic Class Toggles (is-open, active, etc.)
            const drawerSelectors = [
                '#cart-drawer',
                '.cart-drawer',
                '#CartDrawer',
                '.mini-cart',
                '#mini-cart',
                '.drawer--cart',
                '.cart-sidebar',
                '.cart-flyout',
                '[data-cart-drawer]',
                '[data-cart-sidebar]',
                '[data-cart-panel]',
                '[data-testid="cart-drawer"]',
                '[data-testid="mini-cart"]',
                '[data-testid="cart-flyout"]'
            ];
            drawerSelectors.forEach(sel => {
                const el = document.querySelector(sel);
                if (el) {
                    // 很多主题使用 class 来控制显示
                    el.classList.add('is-open', 'active', 'open', 'visible');
                    el.setAttribute('aria-hidden', 'false');
                }
            });
            
            // C. Dispatch explicit "Open" events
            window.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
            document.documentElement.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
            
            // D. Click Trigger (Last Resort, but safer check)
            // 只有当不在购物车页面时，才尝试点击
            if (!window.location.pathname.includes('/cart')) {
                // 查找那些看起来像"打开购物车"的按钮，但排除掉链接到 /cart 的（除非是 js 劫持的）
                // 很多主题的购物车按钮只是一个 <a href="/cart">，但也绑定了 click 事件来打开抽屉
                // 我们尝试触发 click，但要防止跳转
                const triggers = document.querySelectorAll('[data-drawer-trigger="cart"], .js-cart-trigger, [data-action="toggle-cart"], [data-cart-toggle], [data-cart-drawer-toggle], [data-action="open-cart"], [aria-controls="CartDrawer"], [aria-controls="cart-drawer"], [data-cart-drawer-open], [data-testid="cart-drawer-trigger"], [data-testid="cart-button"]');
                if (triggers.length > 0) {
                    (triggers[0] as HTMLElement).click();
                } else {
                     // 如果没有明确的 trigger，尝试点击 header icon，但如果是链接则小心
                     const icon = document.querySelector('.header__icon--cart, #cart-icon-bubble');
                     if (icon) {
                         // 只有当它看起来绑定了 JS 事件时（例如没有 href 或者 href="#" 或者 href="/cart" 但我们希望它弹窗）
                         // 风险：如果它只是一个纯链接，会跳转。
                         // 安全起见，我们只点击那些带有特定 data 属性或 class 的
                     }
                }
            }
        } catch (e) {
            console.warn('Failed to force open drawer', e);
        }

      } else {
        throw new Error('AJAX add to cart failed');
      }
    } catch (error) {
      console.warn('AJAX add to cart failed, falling back to redirect:', error);
      
      // 2. Fallback: 跳转到 permalink
      // 格式: https://{shop}/cart/{variant_id}:1
      
      if (shop) {
        const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
        origin = `https://${cleanShop}`;
      } else {
        // 尝试从产品 URL 获取 origin
        if (product.url) {
          try {
            const urlObj = new URL(product.url);
            origin = urlObj.origin;
          } catch (e) {}
        }
      }

      if (origin) {
        window.open(`${origin}/cart/${variantId}:1`, '_blank');
      } else {
        toast.error(t('failed_copy')); // 使用通用错误或新建
      }
    }
  };

  const handleCheckout = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (products.length === 0) return;

    // Determine origin
    let origin = '';
    const firstUrl = products.find(p => p.url)?.url;
    if (firstUrl) {
      try {
        const urlObj = new URL(firstUrl);
        origin = urlObj.origin;
      } catch (e) {
        console.error('Invalid product URL', e);
      }
    }

    if (!origin && shop) {
       const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
       origin = `https://${cleanShop}`;
    }

    if (!origin) {
        console.error('Cannot determine checkout origin');
        return;
    }

    try {
      const variantsPath = products
        .map(p => {
            const vId = p.variantId ? p.variantId.split('/').pop() : ''; 
            return vId ? `${vId}:1` : '';
        })
        .filter(Boolean)
        .join(',');
      
      if (variantsPath) {
        window.open(`${origin}/cart/${variantsPath}`, '_blank');
      }
    } catch (e) {
      console.error('Error creating checkout URL', e);
    }
  };

  // Unified rendering: Always use the grid/combo layout
  // CSS grid will handle 1 item (via :has selector or default behavior)
  return (
    <div className="product-combo-container">
      {recommendation && (
        <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-2 text-sm border border-blue-100 shadow-sm">
          {recommendation}
        </div>
      )}
      <div className="product-grid">
        {products.map((product, index) => (
          <div 
            key={product.id || index} 
            className="mini-product-card"
            onClick={() => handleClick(product)}
          >
            <div className="mini-product-image">
                {product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    onLoad={onImageLoad}
                  />
                ) : (
                  <ShoppingBag style={{ color: '#ccc', margin: 'auto' }} size={24} />
                )}
            </div>
            <div className="mini-product-info">
              <h4 className="mini-product-title" title={product.title}>{product.title}</h4>
              {product.discounts && product.discounts.length > 0 && (
                <div className="discount-container">
                   {product.discounts.map(d => (
                     <span key={d} className="product-discount-tag">{d}</span>
                   ))}
                </div>
              )}
              <div className="mini-product-price">{product.currency || '$'}{product.price}</div>
              <button 
                className="add-to-cart-btn"
                onClick={(e) => handleAddToCart(e, product)}
              >
                <ShoppingCart size={14} />
                {t('add_to_cart')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button 
        onClick={handleCheckout}
        className="checkout-button"
      >
        <ShoppingCart size={18} />
        {t('checkout_all', {count: products.length})}
      </button>
    </div>
  );
};

export const GiftCard: React.FC<GiftCardProps> = ({ data }) => {
  const { t } = useTranslation();
  const toastRef = useRef<ToastRef>(null);
  const [toastMessage, setToastMessage] = useState('');

  const handleCopy = async () => {
    await copyToClipboard(data.code, t, () => {
      setToastMessage(t('copied_code', { text: data.code }));
      toastRef.current?.show();
    });
  };
  return (
    <div className="message-card gift-card" onClick={handleCopy}>
      <div className="card-header">
        <Gift size={16} className="card-icon" />
        <span className="card-type">{t('gift_card')}</span>
      </div>
      <div className="gift-amount">{data.currency || '$'}{data.amount}</div>
      <div className="gift-code">{data.code}</div>
      <div className="gift-footer">{t('redeem_checkout')}</div>
      <Toast ref={toastRef} message={toastMessage} />
    </div>
  );
};

export const DiscountCard: React.FC<DiscountCardProps> = ({ data }) => {
  const { t } = useTranslation();
  const toastRef = useRef<ToastRef>(null);
  const [toastMessage, setToastMessage] = useState('');

  const handleCopy = async () => {
    await copyToClipboard(data.code, t, () => {
      setToastMessage(t('copied_code', { text: data.code }));
      toastRef.current?.show();
    });
  };
  return (
    <div className="message-card discount-card" onClick={handleCopy}>
      <div className="card-header">
        <Ticket size={16} className="card-icon" />
        <span className="card-type">{t('discount')}</span>
      </div>
      <div className="discount-value">{t('discount_off', {value: data.value})}</div>
      <div className="discount-code">{data.code}</div>
      <div className="discount-desc">{data.description}</div>
      <Toast ref={toastRef} message={toastMessage} />
    </div>
  );
};

interface VariantOption {
  id: string;
  title: string;
  price: string;
  image?: {
    url: string;
  };
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
  product: {
    title: string;
    featuredImage?: {
      url: string;
    };
  };
}

const VariantExchangeModal: React.FC<{
  variantId: string;
  onSelect: (variant: VariantOption) => void;
  onClose: () => void;
}> = ({ variantId, onSelect, onClose }) => {
  const { t } = useTranslation();
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVariants = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/public/shopify/exchangeable-variants?variantId=${variantId}`);
        const result = await response.json();
        
        // Handle Result<T> wrapper
        let variantData = result;
        if (result && typeof result === 'object' && 'data' in result) {
          variantData = result.data;
        }

        // If it's still a string (though the backend should have parsed it), try to parse it
        if (typeof variantData === 'string') {
          try {
            variantData = JSON.parse(variantData);
          } catch (e) {
            console.error('Failed to parse variant data string:', e);
          }
        }

        if (Array.isArray(variantData)) {
          setVariants(variantData);
        } else {
          console.warn('Received non-array variant data:', variantData);
        }
      } catch (error) {
        console.error('Failed to fetch variants:', error);
        toast.error(t('no_variants_available'));
      } finally {
        setLoading(false);
      }
    };
    fetchVariants();
  }, [variantId, t]);

  return ReactDOM.createPortal(
    <div className="variant-modal-overlay" onClick={onClose}>
      <div className="variant-modal-content" onClick={e => e.stopPropagation()}>
        <div className="variant-modal-header">
          <h3>{t('select_variant')}</h3>
          <button className="close-button" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="variant-modal-body">
          {loading ? (
            <div className="loading-container">
              <Loader2 className="animate-spin" size={32} />
              <span>{t('connecting')}</span>
            </div>
          ) : variants.length === 0 ? (
            <div className="no-variants">{t('no_variants_available')}</div>
          ) : (
            <div className="variant-list">
              {variants.map(v => {
                // Use variant image, or fallback to product featured image
                const imageUrl = v.image?.url || v.product?.featuredImage?.url;
                
                return (
                  <div key={v.id} className="variant-item" onClick={() => onSelect(v)}>
                    <div className="variant-image">
                      {imageUrl ? <img src={imageUrl} alt={v.title} /> : <ShoppingBag size={24} />}
                    </div>
                    <div className="variant-info">
                      <div className="variant-title">{v.title}</div>
                      <div className="variant-options">
                        {v.selectedOptions.map(opt => (
                          <span key={opt.name} className="option-tag">{opt.value}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const SingleOrderCard: React.FC<{ order: OrderData; onSendMessage?: (content: string) => void }> = ({ order, onSendMessage }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedAddress, setEditedAddress] = useState(order.shippingAddress || {
    name: '', firstName: '', lastName: '', phone: '', address1: '', address2: '', city: '', province: '', country: '', zip: ''
  });
  const [editedItems, setEditedItems] = useState(order.items || []);
  const [editedNote, setEditedNote] = useState(order.note || '');
  const [exchangingItemIndex, setExchangingItemIndex] = useState<number | null>(null);
  const toastRef = useRef<ToastRef>(null);
  const [toastMessage, setToastMessage] = useState('');
  
  const canEdit = order.fulfillmentStatus.toLowerCase().includes('unfulfilled');

  const handleTrackOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const trackingUrl = order.trackingInfo && order.trackingInfo.length > 0 && order.trackingInfo[0].url
      ? order.trackingInfo[0].url 
      : null;
    
    if (trackingUrl) {
      copyToClipboard(trackingUrl, t, () => {
        setToastMessage(t('copied_code', { text: trackingUrl }));
        toastRef.current?.show();
      });
    } else {
      toast.error(t('no_tracking_info'));
    }
  };

  const handleCancelOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSendMessage) {
      onSendMessage(t('cancel_order_msg', { orderNumber: order.orderNumber }));
    }
  };

  const handleToggleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) {
      // Confirm Edit
      handleConfirmEdit();
    } else {
      setIsEditing(true);
    }
  };

  const handleConfirmEdit = () => {
    if (!onSendMessage) {
      toast.error(t('send_failed'));
      return;
    }

    const changes: string[] = [];
    
    // Check address changes
    const addr = editedAddress;
    const orig = order.shippingAddress || {
      name: '',
      firstName: '',
      lastName: '',
      phone: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      country: '',
      zip: ''
    };
    const addressFields: Array<keyof typeof addr> = ['address1', 'address2', 'city', 'province', 'country', 'zip'];
    
    // Check each address field individually
    addressFields.forEach(field => {
      if (addr[field] !== (orig[field] || '')) {
        changes.push(`${t(field)}: ${addr[field]}`);
      }
    });
    
    if (addr.name !== (orig.name || '')) {
      changes.push(`${t('name')}: ${addr.name}`);
    }
    if (addr.phone !== (orig.phone || '')) {
      changes.push(`${t('phone')}: ${addr.phone}`);
    }

    // Check note changes
    if (editedNote !== (order.note || '')) {
      changes.push(`${t('note')}: ${editedNote}`);
    }

    // Check variant changes
    editedItems.forEach((item, index) => {
      const origItem = order.items?.[index];
      if (origItem && item.variantId !== origItem.variantId) {
        // Format: 我需要修改商品：xxxx,款式A换成B
        const oldVariant = origItem.variantTitle && origItem.variantTitle !== 'Default Title' ? origItem.variantTitle : '';
        const newVariant = item.variantTitle && item.variantTitle !== 'Default Title' ? item.variantTitle : '';
        
        changes.push(t('variant_exchange_format', { 
          productTitle: item.title, 
          oldVariant: oldVariant || t('none'), 
          newVariant: newVariant || t('none') 
        }));
      }
    });

    if (changes.length === 0) {
      setIsEditing(false);
      return;
    }

    const message = t('order_modification_header', { orderNumber: order.orderNumber }) + ', \n          ' + changes.join('\n          ');

    onSendMessage(message);
    setIsEditing(false);
    toast.success(t('send'));
  };

  const handleAddressChange = (field: keyof NonNullable<OrderData['shippingAddress']>, value: string) => {
    setEditedAddress(prev => ({ ...prev, [field]: value }));
  };

  const handleExchangeSelect = (variant: VariantOption) => {
    if (exchangingItemIndex !== null) {
      const newItems = [...editedItems];
      newItems[exchangingItemIndex] = {
        ...newItems[exchangingItemIndex],
        title: variant.product.title,
        variantTitle: variant.title,
        variantId: variant.id
      };
      setEditedItems(newItems);
      setExchangingItemIndex(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('paid') || statusLower.includes('fulfilled') || statusLower.includes('delivered')) {
      return 'bg-green-100 text-green-700';
    }
    if (statusLower.includes('pending') || statusLower.includes('unfulfilled')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    if (statusLower.includes('cancelled') || statusLower.includes('refunded')) {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="message-card order-card">
      <div className="card-header">
        <div className="order-title-wrapper">
          <Package size={16} className="card-icon" />
          <span className="card-type">{t('order')}</span>
        </div>
      </div>
      
      <div className="order-header">
        <div className="order-number">{order.orderNumber}</div>
        <div className="order-price">{order.currency || '$'}{order.totalPrice}</div>
      </div>
      
      <div className="order-status-row">
        <span className={`status-badge ${getStatusBadgeClass(order.financialStatus)}`}>
          {t(`order_status.financial.${order.financialStatus.toLowerCase().replace(/\s+/g, '_')}`, { defaultValue: order.financialStatus })}
        </span>
        <span className={`status-badge ${getStatusBadgeClass(order.fulfillmentStatus)}`}>
          {t(`order_status.fulfillment.${order.fulfillmentStatus.toLowerCase().replace(/\s+/g, '_')}`, { defaultValue: order.fulfillmentStatus })}
        </span>
      </div>

      {(order.shippingAddress || isEditing) && (
        <div className={`shipping-info-section ${isEditing ? 'is-editing' : ''}`}>
          <div className="info-label">{t('shipping_address')}</div>
          <div className="info-content">
            <div className="address-field-row">
              <span className="field-label">{t('name')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.name} 
                  onChange={e => handleAddressChange('name', e.target.value)} 
                />
              ) : (
                <span className="field-value">{order.shippingAddress?.name}</span>
              )}
            </div>
            {(isEditing || (order.shippingAddress?.phone && order.shippingAddress.phone !== 'null')) && (
            <div className="address-field-row">
              <span className="field-label">{t('phone')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.phone === 'null' ? '' : (editedAddress.phone || '')} 
                  onChange={e => handleAddressChange('phone', e.target.value)} 
                />
              ) : (
                <span className="field-value">
                  {order.shippingAddress?.phone}
                </span>
              )}
            </div>
            )}
            <div className="address-field-row">
              <span className="field-label">{t('address1')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.address1} 
                  onChange={e => handleAddressChange('address1', e.target.value)} 
                />
              ) : (
                <span className="field-value">{order.shippingAddress?.address1}</span>
              )}
            </div>
            <div className="address-field-row">
              <span className="field-label">{t('address2')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.address2} 
                  onChange={e => handleAddressChange('address2', e.target.value)} 
                />
              ) : (
                order.shippingAddress?.address2 && <span className="field-value">{order.shippingAddress?.address2}</span>
              )}
            </div>
            <div className="address-field-row">
              <span className="field-label">{t('city')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.city} 
                  onChange={e => handleAddressChange('city', e.target.value)} 
                />
              ) : (
                <span className="field-value">{order.shippingAddress?.city}</span>
              )}
            </div>
            <div className="address-field-row">
              <span className="field-label">{t('province')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.province} 
                  onChange={e => handleAddressChange('province', e.target.value)} 
                />
              ) : (
                <span className="field-value">{order.shippingAddress?.province}</span>
              )}
            </div>
            <div className="address-field-row">
              <span className="field-label">{t('zip')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.zip} 
                  onChange={e => handleAddressChange('zip', e.target.value)} 
                />
              ) : (
                <span className="field-value">{order.shippingAddress?.zip}</span>
              )}
            </div>
            <div className="address-field-row">
              <span className="field-label">{t('country')}:</span>
              {isEditing ? (
                <input 
                  className="edit-input" 
                  value={editedAddress.country} 
                  onChange={e => handleAddressChange('country', e.target.value)} 
                />
              ) : (
                <span className="field-value">{order.shippingAddress?.country}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {(order.note || isEditing) && (
        <div className="order-note-section">
          <div className="info-label">{t('note')}</div>
          {isEditing ? (
            <textarea 
              className="edit-input note-edit-input" 
              value={editedNote} 
              onChange={e => setEditedNote(e.target.value)}
              rows={2}
            />
          ) : (
            <div className="note-content">{order.note || t('none')}</div>
          )}
        </div>
      )}

      {order.trackingInfo && order.trackingInfo.length > 0 && (
        <div className="tracking-section">
          <div className="tracking-header">
            <Truck size={14} />
            <span>{t('tracking')}</span>
          </div>
          {order.trackingInfo.map((tracking, index) => (
            <div key={index} className="tracking-item">
              <span className="tracking-company">{tracking.company}</span>
              <span className="tracking-number">{tracking.number}</span>
            </div>
          ))}
        </div>
      )}

      {editedItems.length > 0 && (
        <div className="order-items-list">
          <div className="items-header">
            {t('items_count', { count: editedItems.length })}
          </div>
          {editedItems.map((item, index) => (
            <div 
              key={index} 
              className={`order-item ${isEditing && item.variantId ? 'editable' : ''}`}
              onClick={() => isEditing && item.variantId && setExchangingItemIndex(index)}
            >
              <div className="item-info">
                <div className="item-title">{item.title}</div>
                {item.variantTitle && item.variantTitle !== 'Default Title' && (
                  <div className="item-variant">{item.variantTitle}</div>
                )}
                <div className="item-details">
                  <span className="item-quantity">× {item.quantity}</span>
                  {item.price && <span className="item-price">{order.currency || '$'}{item.price}</span>}
                </div>
              </div>
              {isEditing && item.variantId && (
                <button className="exchange-btn" onClick={(e) => { e.stopPropagation(); setExchangingItemIndex(index); }}>
                  {t('exchange')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="order-actions-bar">
        <button className="order-action-btn" onClick={handleTrackOrder}>
          <Truck size={14} />
          <span>{t('action_track')}</span>
        </button>
        {canEdit && (
          <>
            <button className={`order-action-btn ${isEditing ? 'active' : ''}`} onClick={handleToggleEdit}>
              {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
              <span>{isEditing ? t('confirm') : t('action_edit')}</span>
            </button>
            <button className="order-action-btn" onClick={handleCancelOrder}>
              <CloseIcon size={14} />
              <span>{t('action_cancel')}</span>
            </button>
          </>
        )}
      </div>

      {exchangingItemIndex !== null && editedItems[exchangingItemIndex].variantId && (
        <VariantExchangeModal 
          variantId={editedItems[exchangingItemIndex].variantId!}
          onSelect={handleExchangeSelect}
          onClose={() => setExchangingItemIndex(null)}
        />
      )}
      <Toast ref={toastRef} message={toastMessage} />
    </div>
  );
};

export const OrderCard: React.FC<OrderCardProps> = ({ data, onSendMessage }) => {
  const { t } = useTranslation();
  // Always treat data as an array
  const orders = Array.isArray(data) ? data : [data];

  return (
    <div className="order-card-container">
      {orders.map((order, index) => (
        <SingleOrderCard key={order.orderId || index} order={order} onSendMessage={onSendMessage} />
      ))}
      <div className="order-instruction-text">
        {t('order_instruction')}
      </div>
    </div>
  );
};
