export type PaystackTransactionResponse = {
  reference: string;
  trans: string;
  transaction: string;
  status: string;
  message?: string;
};

export type PaystackOnloadResponse = { id: string; accessCode: string; customer: Record<string, any> };

export type PaystackProviderProps = {
  publicKey: string;
  currency?: Currency;
  defaultChannels?: PaymentChannels;
  /**
   * Additional hosts to hand off to the OS instead of loading inside the
   * checkout WebView. Added to the built-in defaults, which always apply.
   * See the "Deep linking" section of the README.
   */
  deepLinkHosts?: Array<string | RegExp>;
  debug?: boolean;
  children: React.ReactNode;
  onGlobalSuccess?: (data: PaystackTransactionResponse) => void;
  onGlobalCancel?: () => void;
};

export interface PaystackCallbacks {
  onSuccess: (data: PaystackTransactionResponse) => void;
  onCancel: () => void;
  onLoad?: (res: PaystackOnloadResponse) => void;
  onError?: (res: any) => void;
}

export type PaystackParams = PaystackCallbacks & {
  email: string;
  /** The amount of the transaction in major currency (e.g. Naira) */
  amount: number;
  /** A valid object of extra information that you want to be saved to the transaction. To show this on the dashboard, see Seeing your metadata on the dashboard */
  metadata?: Record<string, any>;
  /** The currency of the transaction. Available options in PaystackPop.CURRENCIES object */
  currency?: Currency;
  /**
   * An array of payment channels to use.
   * By default, all options available in PaystackPop.CHANNELS are used.
   * `google_pay` has to be passed alongside `card`. On its own the transaction will not initialize.
   * Pass `card` with `apple_pay` too, so customers whose device cannot use the wallet can still pay
   */
  channels?: PaymentChannels;
  /** Unique case-sensitive transaction reference. Only -,., = and alphanumeric characters allowed. */
  reference?: string;
  plan?: string;
  invoice_limit?: number;
  subaccount?: string;
  split_code?: string;
  split?: DynamicMultiSplitProps;
};

export type PaystackCheckoutParams = {
  email: string;
  amount: number;
  reference?: string;
  metadata?: Record<string, any>;
  plan?: string;
  invoice_limit?: number;
  subaccount?: string;
  split_code?: string;
  split?: DynamicMultiSplitProps;
  onSuccess: (res: SuccessResponse) => void;
  onCancel: (res: Response) => void;
  onLoad?: (res: { id: string; accessCode: string; customer: Record<string, any> }) => void;
  onError?: (err: { message: string }) => void;
};

export interface PaystackResumeTransactionParams extends PaystackCallbacks {
  accessCode: string;
}

export interface Response {
  status: string;
  data?: string;
}

export interface SuccessResponse extends Response {
  transactionRef?: string;
  data?: any;
}

export type Currency = 'NGN' | 'GHS' | 'USD' | 'ZAR' | 'KES' | 'XOF';

export type PaymentChannels = (
  | 'bank'
  | 'card'
  | 'qr'
  | 'ussd'
  | 'mobile_money'
  | 'bank_transfer'
  | 'eft'
  | 'apple_pay'
)[];

export type SplitTypes = 'flat' | 'percentage';

export type ChargeBearerTypes = 'all' | 'all-proportional' | 'account' | 'subaccount';

interface DynamicSplitSubAccountInterface {
  subaccount: string;
  share: string;
}

export interface DynamicMultiSplitProps {
  type: SplitTypes;
  bearer_type: ChargeBearerTypes;
  subaccounts: DynamicSplitSubAccountInterface[];
  bearer_subaccount?: string;
  reference?: string;
}

export type PaystackMethod = 'checkout' | 'newTransaction' | 'resumeTransaction';

export type ParamRecord = Record<string, string | number | undefined>;

export type GeneratePaystackParamsReturn = string | ParamRecord;
