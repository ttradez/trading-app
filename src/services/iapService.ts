/**
 * One-time "Remove Ads" purchase — $5 CAD.
 * Product ID must match exactly what's registered in App Store Connect
 * and Google Play Console.
 */
import { useEffect, useState } from 'react';
import {
  initConnection,
  getProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getAvailablePurchases,
  IAPErrorCode,
  type Product,
  type Purchase,
} from 'react-native-iap';

export const REMOVE_ADS_SKU = 'remove_ads';

export function useIAP() {
  const [product, setProduct] = useState<Product | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener>;
    let purchaseErrorSub:  ReturnType<typeof purchaseErrorListener>;

    (async () => {
      try {
        await initConnection();

        // Restore previous purchase (e.g. after reinstall)
        const available = await getAvailablePurchases();
        if (available.some((p) => p.productId === REMOVE_ADS_SKU)) {
          setPurchased(true);
        }

        const products = await getProducts({ skus: [REMOVE_ADS_SKU] });
        if (products.length > 0) setProduct(products[0]);
      } catch (e: any) {
        setError(e.message);
      }

      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
        if (purchase.productId === REMOVE_ADS_SKU) {
          await finishTransaction({ purchase, isConsumable: false });
          setPurchased(true);
        }
      });

      purchaseErrorSub = purchaseErrorListener((e) => {
        if (e.code !== IAPErrorCode.E_USER_CANCELLED) {
          setError(e.message);
        }
      });
    })();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
    };
  }, []);

  const buyRemoveAds = async () => {
    if (!product) return;
    setLoading(true);
    setError(null);
    try {
      await requestPurchase({ sku: REMOVE_ADS_SKU });
    } catch (e: any) {
      if (e.code !== IAPErrorCode.E_USER_CANCELLED) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return { product, purchased, loading, error, buyRemoveAds };
}
