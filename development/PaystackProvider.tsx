import React, { createContext, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { styles } from './styles';
import { PaystackMethod, PaystackParams, PaystackProviderProps, PaystackResumeTransactionParams } from './types';
import {
  generatePaystackParams,
  handlePaystackMessage,
  openExternalUrl,
  paystackHtmlContent,
  shouldHandleExternally,
  validateParams,
} from './utils';

type Params = PaystackParams | PaystackResumeTransactionParams;

export const DEFAULT_DEEP_LINK_HOSTS: string[] = ['https://joinzap.com/app/'];

export const PaystackContext = createContext<{
  popup: {
    checkout: (params: PaystackParams) => void;
    newTransaction: (params: PaystackParams) => void;
    resumeTransaction: (params: PaystackResumeTransactionParams) => void;
  };
} | null>(null);

export const PaystackProvider: React.FC<PaystackProviderProps> = ({
  publicKey,
  currency,
  defaultChannels = ['card'],
  deepLinkHosts = [],
  debug = false,
  children,
  onGlobalSuccess,
  onGlobalCancel,
}) => {
  const [visible, setVisible] = useState(false);
  const [params, setParams] = useState<Params | null>(null);
  const [method, setMethod] = useState<PaystackMethod>('checkout');

  const fallbackRef = useMemo(() => `ref_${Date.now()}`, []);

  const resolvedDeepLinkHosts = useMemo(() => [...DEFAULT_DEEP_LINK_HOSTS, ...deepLinkHosts], [deepLinkHosts]);

  const open = useCallback(
    (params: Params, selectedMethod: PaystackMethod) => {
      if (debug) {
        console.log(`[Paystack] Opening modal with method: ${selectedMethod}`);
      }
      if (!validateParams(params, selectedMethod, debug)) {
        return;
      }
      setParams(params);
      setMethod(selectedMethod);
      setVisible(true);
    },
    [debug],
  );

  const checkout = (params: PaystackParams) => open(params, 'checkout');
  const newTransaction = (params: PaystackParams) => open(params, 'newTransaction');
  const resumeTransaction = (params: PaystackResumeTransactionParams) => open(params, 'resumeTransaction');

  const close = () => {
    setVisible(false);
    setParams(null);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    handlePaystackMessage({
      event,
      debug,
      params,
      onGlobalSuccess,
      onGlobalCancel,
      close,
    });
  };

  const paystackHTML = useMemo(() => {
    if (!params) {
      return '';
    }
    let config;
    if (method === 'resumeTransaction') {
      const resumeTransactionParams = params as PaystackResumeTransactionParams;
      config = { method, accessCode: resumeTransactionParams.accessCode };
    } else {
      const otherParams = params as PaystackParams;
      config = {
        method,
        publicKey,
        email: otherParams.email,
        amount: otherParams.amount,
        reference: otherParams.reference || fallbackRef,
        metadata: otherParams.metadata,
        currency: otherParams.currency || currency,
        channels: otherParams.channels || defaultChannels,
        plan: otherParams.plan,
        invoice_limit: otherParams.invoice_limit,
        subaccount: otherParams.subaccount,
        split: otherParams.split,
        split_code: otherParams.split_code,
      };
    }
    return paystackHtmlContent(generatePaystackParams(config), method);
  }, [params, method, publicKey, currency, defaultChannels, fallbackRef]);

  if (debug && visible) {
    console.log('[Paystack] HTML Injected:', paystackHTML);
  }

  return (
    <PaystackContext.Provider value={{ popup: { checkout, newTransaction, resumeTransaction } }}>
      {children}
      <Modal visible={visible} transparent animationType="slide">
        <SafeAreaView style={styles.container}>
          <WebView
            originWhitelist={['*']}
            source={{ html: paystackHTML }}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url ?? '';
              if (!shouldHandleExternally(url, resolvedDeepLinkHosts)) {
                return true;
              }
              if (debug) {
                console.log('[Paystack] Opening external/deep link via OS:', url);
              }
              void openExternalUrl(url, debug);
              return false;
            }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onLoadStart={() => debug && console.log('[Paystack] WebView Load Start')}
            onLoadEnd={() => debug && console.log('[Paystack] WebView Load End')}
            renderLoading={() => <ActivityIndicator size="large" />}
          />
        </SafeAreaView>
      </Modal>
    </PaystackContext.Provider>
  );
};
