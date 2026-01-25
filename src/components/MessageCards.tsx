import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ShoppingBag, Gift, Ticket, ShoppingCart, Package, ExternalLink, Truck, Edit2, Check, X as CloseIcon, Loader2 } from 'lucide-react';
import './MessageCards.css';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';

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

const copyToClipboard = async (text: string, t: any) => {
    if (!text) return;
    
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            toast.success(t('copied_code', { text }));
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
            
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    toast.success(t('copied_code', { text }));
                } else {
                    toast.error(t('failed_copy'));
                }
            } catch (err) {
                console.error('Fallback copy failed', err);
                toast.error(t('failed_copy'));
            }
            
            document.body.removeChild(textArea);
        }
    } catch (err) {
        console.error('Copy failed', err);
        toast.error(t('failed_copy'));
    }
};

export const ProductCard: React.FC<ProductCardProps> = ({ data }) => {
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

  const handleClick = (product: ProductData) => {
    if (product.url) {
      window.open(product.url, '_blank');
    } else if (product.handle) {
      // Fallback if full URL not provided but handle is
    }
  };

  const handleCheckout = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (products.length === 0) return;

    // Construct checkout URL
    const firstUrl = products.find(p => p.url)?.url;
    if (!firstUrl) return;

    try {
      const urlObj = new URL(firstUrl);
      const origin = urlObj.origin;
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
      console.error('Invalid product URL', e);
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
                  <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
  return (
    <div className="message-card gift-card" onClick={() => copyToClipboard(data.code, t)}>
      <div className="card-header">
        <Gift size={16} className="card-icon" />
        <span className="card-type">{t('gift_card')}</span>
      </div>
      <div className="gift-amount">{data.currency || '$'}{data.amount}</div>
      <div className="gift-code">{data.code}</div>
      <div className="gift-footer">{t('redeem_checkout')}</div>
    </div>
  );
};

export const DiscountCard: React.FC<DiscountCardProps> = ({ data }) => {
  const { t } = useTranslation();
  return (
    <div className="message-card discount-card" onClick={() => copyToClipboard(data.code, t)}>
      <div className="card-header">
        <Ticket size={16} className="card-icon" />
        <span className="card-type">{t('discount')}</span>
      </div>
      <div className="discount-value">{t('discount_off', {value: data.value})}</div>
      <div className="discount-code">{data.code}</div>
      <div className="discount-desc">{data.description}</div>
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
  
  const canEdit = order.fulfillmentStatus.toLowerCase().includes('unfulfilled');

  const handleTrackOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const trackingUrl = order.trackingInfo && order.trackingInfo.length > 0 && order.trackingInfo[0].url
      ? order.trackingInfo[0].url 
      : null;
    
    if (trackingUrl) {
      copyToClipboard(trackingUrl, t);
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
