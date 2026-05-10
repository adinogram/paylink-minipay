/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from "react";
import { 
  createPublicClient, 
  createWalletClient, 
  custom, 
  http, 
  type Address,
  type WalletClient,
  type PublicClient
} from "viem";
import { celoSepolia } from "viem/chains";
import { Wallet, LogOut, ExternalLink, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/**
 * Shortens a wallet address for display.
 */
function shortenAddress(address: Address | string) {
  if (!address) return "";
  const addr = address as string;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function App() {
  const [address, setAddress] = useState<Address | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);

  useEffect(() => {
    console.log("App mounted, initializing clients...");
    try {
      const pc = createPublicClient({
        chain: celoSepolia,
        transport: http()
      });
      setPublicClient(pc);
      console.log("Public client initialized");
    } catch (err) {
      console.error("Failed to initialize public client:", err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    console.log("Connect attempt, ethereum detected:", !!ethereum);
    
    if (!ethereum) {
      setError("Web3 wallet not detected. Please install MetaMask or MiniPay.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    const isIframe = window.self !== window.top;
    console.log("Is running in iframe:", isIframe);

    try {
      const client = createWalletClient({
        chain: celoSepolia,
        transport: custom(ethereum)
      });

      console.log("Requesting permissions first...");
      try {
        await ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (permError: any) {
        console.warn("Permission request error:", permError);
        // Continue anyway as some wallets don't support this but will still allow requestAddresses
      }

      console.log("Requesting addresses...");
      const [account] = await client.requestAddresses();
      console.log("Account connected:", account);
      
      if (!account) {
        throw new Error("Connection request rejected or no accounts found.");
      }

      try {
        console.log("Switching chain to Celo Sepolia...");
        await client.switchChain({ id: celoSepolia.id });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          console.log("Chain not found, adding Celo Sepolia...");
          await client.addChain({ chain: celoSepolia });
        } else {
          console.warn("Chain switch warning:", switchError);
        }
      }

      setAddress(account);
      setWalletClient(client);
    } catch (err: any) {
      console.error("Connection error detail:", err);
      let msg = err.message || "Failed to connect wallet.";
      
      if (isIframe) {
        if (err.code === -32002 || msg.includes("already pending")) {
          msg = "Request already pending. Please check MetaMask or open the app in a new tab (top right icon) to bypass iframe restrictions.";
        } else if (msg.includes("User rejected")) {
          msg = "Connection was rejected. Please try again.";
        } else {
          msg = "Connection failed. Browsers often block wallet extensions in iframes. Please try opening this app in a new tab using the icon above the preview to connect successfully.";
        }
      }
      
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setWalletClient(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-neutral-900 selection:text-white">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase tracking-wider mb-4 border border-yellow-200"
          >
            <ShieldCheck className="w-3 h-3" />
            Celo Proof of Ship
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold tracking-tight text-neutral-900 mb-2 font-sans"
          >
            Celo Starter
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-neutral-500 font-sans text-sm"
          >
            Minimal template for building on Celo testnet.
          </motion.p>
        </header>

        <main className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {!address ? (
              <motion.div
                key="connect"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  id="connect-btn"
                  className="w-full py-4 bg-neutral-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-neutral-200"
                >
                  {isConnecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Wallet className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  )}
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col gap-3 text-xs text-red-600"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                    {window.self !== window.top && (
                      <div className="pt-2 border-t border-red-100 mt-1">
                        <p className="font-semibold mb-1">💡 Troubleshooting:</p>
                        <ul className="list-disc list-inside space-y-1 opacity-80">
                          <li>Click the "Open in new tab" icon (top right)</li>
                          <li>Check if your wallet has a pending request</li>
                          <li>Make sure you are logged into your wallet</li>
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono block">
                    Connected Wallet
                  </span>
                  <div className="flex items-center justify-between group bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                    <span className="text-lg font-mono font-medium text-neutral-900 truncate pr-2">
                      {shortenAddress(address)}
                    </span>
                    <a 
                      href={`https://celo-sepolia.blockscout.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white rounded-lg transition-all text-neutral-400 hover:text-neutral-900 border border-transparent hover:border-neutral-200 shadow-sm shadow-transparent hover:shadow-neutral-100"
                      title="View on Explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono">Network</span>
                    <p className="font-semibold text-neutral-900 text-sm">Celo Sepolia</p>
                  </div>
                  <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono">Status</span>
                    <p className="font-semibold text-green-600 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Active
                    </p>
                  </div>
                </div>

                <button
                  onClick={disconnectWallet}
                  className="w-full py-3 bg-white border border-neutral-200 text-neutral-500 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-neutral-50 hover:text-neutral-900 transition-all text-xs group"
                >
                  <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  Disconnect Wallet
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-12 text-center">
          <div className="flex justify-center gap-6 mb-4">
            <a href="https://docs.celo.org" className="text-xs transition-colors text-neutral-400 hover:text-neutral-900 font-medium">Documentation</a>
            <a href="https://celopedia.celo.org" className="text-xs transition-colors text-neutral-400 hover:text-neutral-900 font-medium">Celopedia</a>
            <a href="https://talent.app" className="text-xs transition-colors text-neutral-400 hover:text-neutral-900 font-medium">Talent App</a>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-300 font-bold">Built for Proof of Ship</p>
        </footer>
      </div>
    </div>
  );
}
