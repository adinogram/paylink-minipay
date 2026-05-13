/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  createPublicClient, 
  createWalletClient, 
  custom, 
  http, 
  parseEther,
  type Address,
  type WalletClient,
  type PublicClient
} from "viem";
import { celoAlfajores } from "viem/chains";
import { Wallet, LogOut, ExternalLink, ShieldCheck, AlertCircle, Loader2, Coins, Copy, Check, Share2, Send } from "lucide-react";
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
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  
  // Payment states
  const [payAmount, setPayAmount] = useState("");
  const [payee, setPayee] = useState<Address | null>(null);
  const [view, setView] = useState<'dashboard' | 'pay'>('dashboard');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect MiniPay
  const isMiniPay = useMemo(() => {
    return typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay;
  }, []);

  // Parse URL parameters for routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const amount = params.get('amount');
    const to = params.get('to');
    
    if (amount && to) {
      setPayAmount(amount);
      setPayee(to as Address);
      setView('pay');
    }
  }, []);

  // Wallet Event Listeners
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      const handleChainChanged = (hexChainId: string) => {
        const newChainId = parseInt(hexChainId, 16);
        setChainId(newChainId);
      };

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setWalletClient(null);
          setChainId(null);
        } else {
          setAddress(accounts[0] as Address);
        }
      };

      ethereum.on("chainChanged", handleChainChanged);
      ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        ethereum.removeListener("chainChanged", handleChainChanged);
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, []);

  // Initialize Public Client
  useEffect(() => {
    async function init() {
      try {
        const pc = createPublicClient({
          chain: celoAlfajores,
          transport: http()
        });
        setPublicClient(pc);
      } catch (err) {
        console.error("Failed to initialize public client:", err);
      }
    }
    init();
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setError("Web3 wallet not detected.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Small delay to ensure extension is fully injected in some environments
      await new Promise(resolve => setTimeout(resolve, 100));

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock your wallet.");
      }
      const account = accounts[0] as Address;

      const client = createWalletClient({
        chain: celoAlfajores,
        transport: custom(ethereum)
      });
      
      const currentChainId = await client.getChainId();
      setChainId(currentChainId);

      if (currentChainId !== celoAlfajores.id) {
        try {
          await client.switchChain({ id: celoAlfajores.id });
          setChainId(celoAlfajores.id);
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await client.addChain({ chain: celoAlfajores });
            setChainId(celoAlfajores.id);
          }
        }
      }

      setAddress(account);
      setWalletClient(client);
    } catch (err: any) {
      console.error("Connection error details:", err);
      const isIframe = window.self !== window.top;
      const rawMsg = err.message || String(err);
      
      if (rawMsg.includes("Unexpected error") || rawMsg.includes("Internal error") || rawMsg.includes("Extension context invalidated")) {
        setError("Browser Security Block: Your wallet extension is being blocked because this app is running in an iframe. Please click 'Open in New Tab' to connect.");
      } else if (err.code === -32002 || rawMsg.includes("already pending")) {
        setError("Connection pending: Please check your wallet for a popup.");
      } else if (rawMsg.includes("User rejected")) {
        setError("Connection rejected by user.");
      } else {
        setError(rawMsg);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Auto-connect for MiniPay
  useEffect(() => {
    if (isMiniPay && !address) {
      connectWallet();
    }
  }, [isMiniPay, address, connectWallet]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
    setError(null);
  }, []);

  const sendPayment = useCallback(async () => {
    if (!walletClient || !payee || !payAmount || !address) return;
    
    setIsMining(true);
    setError(null);
    setTxHash(null);
    
    try {
      const hash = await walletClient.sendTransaction({
        account: address,
        to: payee,
        value: parseEther(payAmount),
        chain: celoAlfajores
      });
      
      setTxHash(hash);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
    } catch (err: any) {
      setError(err.message || "Transaction failed.");
    } finally {
      setIsMining(false);
    }
  }, [walletClient, payee, payAmount, address, publicClient]);

  const generatePaymentLink = () => {
    if (!address || !payAmount) return "";
    const url = new URL(window.location.origin);
    url.searchParams.set('amount', payAmount);
    url.searchParams.set('to', address);
    return url.toString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchNetwork = useCallback(async () => {
    if (!walletClient) return;
    setIsConnecting(true);
    try {
      await walletClient.switchChain({ id: celoAlfajores.id });
      setChainId(celoAlfajores.id);
    } catch (err: any) {
      if (err.code === 4902) {
        await walletClient.addChain({ chain: celoAlfajores });
        setChainId(celoAlfajores.id);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [walletClient]);

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
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2 font-sans">
            Celo Pay
          </h1>
          <p className="text-neutral-500 text-sm">Minimal Celo Payment Links</p>
        </header>

        <main className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {!address && !isMiniPay ? (
              <motion.div
                key="connect"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-neutral-400" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-neutral-900">Connect Wallet</h2>
                    <p className="text-neutral-500 text-sm">Please connect to start using Celo Pay.</p>
                  </div>
                </div>
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full py-4 bg-neutral-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-lg shadow-neutral-200"
                >
                  {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                  Connect Wallet
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
                      <div className="pt-3 border-t border-red-100 mt-1 space-y-2">
                        <p className="font-semibold text-[11px] text-red-800">Troubleshooting:</p>
                        <a 
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 transition-colors shadow-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open in New Tab to Fix
                        </a>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={view}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {view === 'pay' ? (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                       <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto border border-yellow-100">
                        <Coins className="w-8 h-8 text-yellow-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-neutral-900">Send Payment</h2>
                      <p className="text-neutral-500 text-sm">
                        Sending <span className="font-bold text-neutral-900">{payAmount} CELO</span> to
                      </p>
                      <div className="inline-block bg-neutral-100 px-3 py-1 rounded-full text-xs font-mono font-medium">
                        {shortenAddress(payee || "")}
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <button
                        onClick={sendPayment}
                        disabled={isMining || chainId !== celoAlfajores.id}
                        className="w-full py-4 bg-yellow-400 text-yellow-950 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-500 transition-all disabled:opacity-50 shadow-lg shadow-yellow-100"
                      >
                        {isMining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {isMining ? "Confirming..." : `Send ${payAmount} CELO`}
                      </button>
                      <button
                        onClick={() => { setView('dashboard'); window.history.pushState({}, '', '/'); }}
                        className="w-full py-3 text-neutral-400 text-xs font-medium hover:text-neutral-900 transition-colors"
                      >
                        Back to Dashboard
                      </button>
                    </div>

                    {txHash && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 border border-green-100 rounded-xl text-center space-y-2">
                        <p className="text-sm font-bold text-green-900 flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> Payment Sent!
                        </p>
                        <a href={`https://celo-alfajores.blockscout.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 hover:underline">View Transaction</a>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between group bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                        <span className="text-lg font-mono font-medium text-neutral-900 truncate">
                          {shortenAddress(address || "")}
                        </span>
                        <a href={`https://celo-alfajores.blockscout.com/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-900"><ExternalLink className="w-4 h-4" /></a>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono">Create Link</label>
                        <div className="flex gap-2">
                          <input 
                            type="number" step="0.01" placeholder="0.00" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold"
                          />
                          <button
                            onClick={() => copyToClipboard(generatePaymentLink())}
                            disabled={!payAmount}
                            className="bg-neutral-900 text-white p-3.5 rounded-xl disabled:opacity-50"
                          >
                            {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 font-mono block">Network</span>
                        <p className={`font-semibold text-sm ${chainId === celoAlfajores.id ? 'text-neutral-900' : 'text-red-500'}`}>Alfajores</p>
                      </div>
                      <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 font-mono block">Status</span>
                        <p className="font-semibold text-green-600 text-sm">Active</p>
                      </div>
                    </div>
                  </>
                )}

                {chainId !== celoAlfajores.id && (
                  <button 
                    onClick={switchNetwork} 
                    disabled={isConnecting}
                    className="w-full py-3 bg-amber-100 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-200 transition-all flex items-center justify-center gap-2 border border-amber-200"
                  >
                    {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                    Switch to Alfajores
                  </button>
                )}
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600 flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-2">
                       <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                       <span>{error}</span>
                    </div>
                    {(error.includes("iframe") || error.includes("New Tab")) && window.self !== window.top && (
                      <a 
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-bold text-red-800 underline active:opacity-70"
                      >
                        Open in New Tab to Fix
                      </a>
                    )}
                  </motion.div>
                )}

                <button onClick={disconnectWallet} className="w-full py-3 text-neutral-400 hover:text-neutral-900 transition-all text-xs font-medium">
                  Disconnect Wallet
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
