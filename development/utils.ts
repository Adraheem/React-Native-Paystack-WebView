import { Alert, Linking } from 'react-native';
import {
  GeneratePaystackParamsReturn,
  ParamRecord,
  PaystackMethod,
  PaystackParams,
  PaystackResumeTransactionParams,
  PaystackTransactionResponse,
} from './types';

const stringify = (value?: string): string | undefined => value ? `'${value}'` : undefined;

const objToStr = (value: ParamRecord) =>
  Object.entries(value)
    .map(([key, value]) => value ? `${key}: ${value}` : undefined)
    .filter(Boolean)
    .join(',\n');

const CALLBACKS = {
  onSuccess: `function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'success', data: response }));
      }`,
  onCancel: `function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'cancel' }));
      }`,
  onLoad: `function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'load', data: response }));
      }`,
  onError: `function(error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'error', error: { message: error.message } }));
      }`,
};

type CallbackKeys = keyof typeof CALLBACKS;

export const shouldHandleExternally = (
  url: string,
  hosts: Array<string | RegExp>,
): boolean =>
  !!url &&
  hosts.some((matcher) =>
    typeof matcher === 'string' ? url.indexOf(matcher) === 0 : matcher.test(url),
  );

export const openExternalUrl = async (url: string, debug = false): Promise<void> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      if (debug) console.log('[Paystack] No app can handle URL:', url);
      return;
    }
    await Linking.openURL(url);
  } catch (err) {
    if (debug) console.log('[Paystack] Linking.openURL failed:', err);
  }
};

export const validateParams = (params: PaystackParams | PaystackResumeTransactionParams, method: PaystackMethod, debug: boolean): boolean => {
  const errors: string[] = [];
  if(method === 'resumeTransaction'){
    const resumeTransactionParams = params as PaystackResumeTransactionParams;
    if(!resumeTransactionParams.accessCode) errors.push('Access code is required');
  } else {
    const otherParams = params as PaystackParams;
    if (!otherParams.email) errors.push('Email is required');
    if (!otherParams.amount || typeof otherParams.amount !== 'number' || otherParams.amount <= 0) {
      errors.push('Amount must be a valid number greater than 0');
    }
  }
  if (!params.onSuccess || typeof params.onSuccess !== 'function') {
    errors.push('onSuccess callback is required and must be a function');
  }
  if (!params.onCancel || typeof params.onCancel !== 'function') {
    errors.push('onCancel callback is required and must be a function');
  }

  if (errors.length > 0) {
    debug && console.warn('Paystack Validation Errors:', errors);
    Alert.alert('Payment Error', errors.join('\n'));
    return false;
  }
  return true;
};

export const sanitize = (
  value: unknown,
  fallback: string | number | object,
  wrapString = true,
): string => {
  try {
    if (typeof value === 'string') return wrapString ? `'${value}'` : value;
    return JSON.stringify(value ?? fallback);
  } catch (e) {
    return JSON.stringify(fallback);
  }
};

export const handlePaystackMessage = ({
                                        event,
                                        debug,
                                        params,
                                        onGlobalSuccess,
                                        onGlobalCancel,
                                        close,
                                      }: {
  event: any;
  debug: boolean;
  params: Pick<PaystackParams, CallbackKeys> | null;
  onGlobalSuccess?: (data: PaystackTransactionResponse) => void;
  onGlobalCancel?: () => void;
  close?: () => void;
}) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (debug) console.log('[Paystack] Message Received:', data);

    switch (data.event) {
      case 'success': {
        if (debug) console.log('[Paystack] Success:', data.data);
        params?.onSuccess(data.data);
        onGlobalSuccess?.(data.data);
        close?.();
        break;
      }
      case 'cancel': {
        if (debug) console.log('[Paystack] Cancelled');
        params?.onCancel();
        onGlobalCancel?.();
        close?.();
        break;
      }
      case 'error': {
        if (debug) console.error('[Paystack] Error:', data.error);
        close?.();
        break;
      }
      case 'load': {
        if (debug) console.log('[Paystack] Loaded:', data);
        break;
      }
    }
  } catch (e) {
    if (debug) console.warn('[Paystack] Message Error:', e);
  }
};

type CheckoutParams = Omit<PaystackParams, CallbackKeys> & { publicKey: string, method: 'checkout' | 'newTransaction' }

const generateCheckoutParams = (config: CheckoutParams) => ({
  key: stringify(config.publicKey),
  email: stringify(config.email),
  amount: config.amount * 100,
  currency: stringify(config.currency),
  reference: stringify(config.reference),
  metadata: JSON.stringify(config.metadata),
  channels: JSON.stringify(config.channels),
  plan: stringify(config.plan),
  invoice_limit: config.invoice_limit,
  subaccount: stringify(config.subaccount),
  split_code: stringify(config.split_code),
  split: JSON.stringify(config.split),
});

type ResumeTransactionParams = Omit<PaystackResumeTransactionParams, CallbackKeys> & { method: 'resumeTransaction' }

const generateResumeTransactionParams = (config: ResumeTransactionParams) => config.accessCode;

export const generatePaystackParams = (config: CheckoutParams | ResumeTransactionParams): GeneratePaystackParamsReturn => {
  switch (config.method) {
    case 'resumeTransaction':
      return generateResumeTransactionParams(config);

    default:
      return generateCheckoutParams(config);
  }
};

export const paystackHtmlContent = (
  params: GeneratePaystackParamsReturn,
  method: PaystackMethod = 'checkout',
): string => {
  let invokeFn;

  if (method === 'resumeTransaction') {
    invokeFn = `
    paystack.resumeTransaction('${params as string}', {${objToStr(CALLBACKS)}});
    `;
  } else {
    invokeFn = `
    paystack.${method}({
    ${objToStr({ ...(params as ParamRecord), ...CALLBACKS })}
    });
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Paystack</title>
    </head>
    <body onload="payWithPaystack()" style="background-color:#fff;height:100vh">
      <script src="https://js.paystack.co/v2/inline.js"></script>
      <script>
        function payWithPaystack() {
          const paystack = new PaystackPop();
          ${invokeFn}
        }
      </script>
    </body>
    </html>
  `;
};
