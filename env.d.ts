
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}

interface Window {
  webkitAudioContext: typeof AudioContext;
  google: any;
  // Fix: Added optional modifier to aistudio to resolve identical modifier error
  aistudio?: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}
