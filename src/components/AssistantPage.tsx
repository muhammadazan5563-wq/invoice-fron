import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  Headphones,
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  StopCircle,
  UserRound,
  Volume2,
  VolumeX,
  WalletCards,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

type Role = 'assistant' | 'user';
type ChatMessage = { id: string; role: Role; content: string; time: string; chips?: string[] };

type SpeechRecognitionEventLike = Event & { results: { [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const now = () => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const starterMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    time: now(),
    content: 'Good morning. I’m your ledger copilot. Ask me to find an invoice, check a balance, draft a new bill, or explain what changed in your cash flow.',
    chips: ['Show today’s overview', 'Find overdue invoices', 'Create an invoice'],
  },
];

const examples = [
  { icon: BarChart3, label: 'Business overview', prompt: 'Give me a quick overview of today’s sales, collections and outstanding balance.' },
  { icon: WalletCards, label: 'Check a balance', prompt: 'Check the outstanding balance for my customers.' },
  { icon: ReceiptText, label: 'Find an invoice', prompt: 'Find my latest unpaid invoices.' },
  { icon: FilePlus2, label: 'Draft an invoice', prompt: 'Help me draft an invoice for a customer.' },
];

function AssistantMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`${small ? 'w-8 h-8 rounded-[11px]' : 'w-11 h-11 rounded-[15px]'} bg-brand flex items-center justify-center shadow-[0_10px_24px_-12px_rgba(90,73,230,0.9)]`}>
      <Sparkles className={`${small ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
    </span>
  );
}

function fallbackReply(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes('balance') || lower.includes('overview')) return 'I’m ready to bring your customer balances, vendor dues, collections and cash flow together in one clear view.';
  if (lower.includes('invoice')) return 'Absolutely. Tell me the customer name, items, quantity, price and tax rate. I’ll prepare a draft first and ask for confirmation before saving it.';
  return 'I understand. I can help with invoices, payments, contacts, expenses, reports and everyday questions about your ledger. Try one of the quick actions below to get started.';
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const browserVoiceAvailable = useMemo(() => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = (text: string) => {
    if (!voiceReplies || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (raw = input) => {
    const content = raw.trim();
    if (!content || isSending) return;
    const userMessage: ChatMessage = { id: makeId(), role: 'user', content, time: now() };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);
    try {
      const result = await apiRequest<{ message?: string; reply?: string; approvalRequired?: boolean }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: content, history: [...messages, userMessage].slice(-12) }),
      });
      const reply = result.message || result.reply || fallbackReply(content);
      const assistantMessage: ChatMessage = { id: makeId(), role: 'assistant', content: reply, time: now(), chips: result.approvalRequired ? ['Confirm', 'Cancel'] : undefined };
      setMessages((current) => [...current, assistantMessage]);
      speak(reply);
    } catch {
      const reply = fallbackReply(content);
      const assistantMessage: ChatMessage = { id: makeId(), role: 'assistant', content: reply, time: now(), chips: ['Show today’s overview', 'Find overdue invoices'] };
      setMessages((current) => [...current, assistantMessage]);
      speak(reply);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const copyMessage = async (message: ChatMessage) => {
    await navigator.clipboard?.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <main className="min-h-screen bg-[#f3f2fa] text-ink px-3 py-3 sm:px-5 sm:py-5" id="assistant-page">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1440px] overflow-hidden rounded-[30px] bg-shell shadow-[0_35px_100px_-55px_rgba(19,17,38,0.6)]">
        <aside className="hidden w-[272px] shrink-0 flex-col border-r border-hairline bg-[#fbfaff] lg:flex">
          <div className="flex items-center gap-3 px-6 py-6">
            <AssistantMark small />
            <div><p className="font-display text-[15px] font-extrabold tracking-tight">Naidify AI</p><p className="mt-0.5 text-[10px] font-semibold text-quill-soft">Your ledger copilot</p></div>
          </div>
          <div className="px-4"><button type="button" onClick={() => setMessages(starterMessages)} className="flex w-full items-center gap-2.5 rounded-[15px] bg-ink px-4 py-3 text-left text-[12px] font-bold text-white shadow-[0_14px_25px_-18px_rgba(19,17,38,0.75)]"><Plus className="h-4 w-4" /> New conversation</button></div>
          <div className="mt-8 px-4"><p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-quill-soft">Workspace</p><div className="mt-2 space-y-1"><a href="/" className="flex items-center gap-3 rounded-[13px] px-3 py-3 text-[12px] font-bold text-quill hover:bg-mist hover:text-ink"><BarChart3 className="h-4 w-4" /> Dashboard</a><div className="flex items-center gap-3 rounded-[13px] bg-brand-pale px-3 py-3 text-[12px] font-extrabold text-brand"><Sparkles className="h-4 w-4" /> AI assistant</div></div></div>
          <div className="mt-auto m-4 rounded-[19px] bg-ink p-4 text-white"><div className="flex items-center gap-2"><Headphones className="h-4 w-4 text-brand-soft" /><span className="text-[11px] font-extrabold">Voice enabled</span></div><p className="mt-2 text-[10px] leading-relaxed text-white/55">Speak naturally. I’ll turn your request into the right ledger action.</p></div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-hairline px-5 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-3"><a href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-mist text-quill hover:bg-mist-2 lg:hidden" aria-label="Back to dashboard"><ChevronDown className="h-4 w-4 rotate-90" /></a><AssistantMark small /><div><div className="flex items-center gap-2"><h1 className="font-display text-[16px] font-extrabold tracking-tight">Naidify AI</h1><span className="rounded-full bg-[#e9f8ef] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[#18834a]">Online</span></div><p className="mt-0.5 text-[10px] font-semibold text-quill-soft">Private to your workspace</p></div></div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setVoiceReplies((value) => !value)} className={`flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-bold transition-colors ${voiceReplies ? 'bg-brand-pale text-brand' : 'bg-mist text-quill'}`}><span className="hidden sm:inline">Voice replies</span>{voiceReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button><button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-quill hover:bg-mist-2" aria-label="More options"><MoreHorizontal className="h-4 w-4" /></button></div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-[780px]">
              <div className="mb-9 text-center"><div className="mx-auto mb-4 inline-flex rounded-[21px] bg-brand-pale p-2"><AssistantMark /></div><p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-brand">Your business, in conversation</p><h2 className="mt-2 font-display text-[28px] font-extrabold tracking-tight text-ink sm:text-[36px]">What can I take care of?</h2><p className="mx-auto mt-3 max-w-[510px] text-[13px] font-medium leading-relaxed text-quill">Ask in your own words. I can find records, explain your numbers, and prepare actions for your approval.</p></div>
              <div className="mb-9 grid grid-cols-2 gap-2.5 sm:grid-cols-4">{examples.map(({ icon: Icon, label, prompt }) => <button key={label} type="button" onClick={() => sendMessage(prompt)} className="group rounded-[18px] border border-hairline bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-soft hover:shadow-[0_12px_25px_-20px_rgba(90,73,230,0.75)]"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-mist text-brand group-hover:bg-brand group-hover:text-white"><Icon className="h-4 w-4" /></span><span className="mt-3 block text-[11px] font-extrabold leading-tight text-ink">{label}</span></button>)}</div>
              <div className="space-y-6">{messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[min(640px,90%)] gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>{message.role === 'assistant' ? <AssistantMark small /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-ink text-white"><UserRound className="h-4 w-4" /></span>}<div><div className={`rounded-[20px] px-4 py-3.5 text-[13px] font-medium leading-relaxed ${message.role === 'user' ? 'rounded-tr-[6px] bg-brand text-white' : 'rounded-tl-[6px] bg-mist text-ink'}`}>{message.content}</div><div className={`mt-2 flex items-center gap-3 text-[10px] font-semibold text-quill-soft ${message.role === 'user' ? 'justify-end' : ''}`}><span>{message.time}</span>{message.role === 'assistant' && <button type="button" onClick={() => copyMessage(message)} className="inline-flex items-center gap-1 hover:text-brand">{copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copiedId === message.id ? 'Copied' : 'Copy'}</button>}</div>{message.chips && <div className="mt-3 flex flex-wrap gap-2">{message.chips.map((chip) => <button key={chip} type="button" onClick={() => sendMessage(chip)} className="rounded-full border border-brand/20 bg-brand-pale px-3 py-2 text-[10px] font-extrabold text-brand hover:bg-brand hover:text-white">{chip}</button>)}</div>}</div></div></div>)}{isSending && <div className="flex items-center gap-3"><AssistantMark small /><div className="rounded-[20px] rounded-tl-[6px] bg-mist px-4 py-4"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:240ms]" /></span></div></div>}<div ref={endRef} /></div>
            </div>
          </div>

          <div className="border-t border-hairline bg-white px-4 py-4 sm:px-10 sm:py-5"><form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="mx-auto max-w-[780px]"><div className={`rounded-[23px] border bg-[#fbfaff] p-2 transition-colors ${isListening ? 'border-brand shadow-[0_0_0_4px_rgba(90,73,230,0.1)]' : 'border-hairline focus-within:border-brand-soft'}`}><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} rows={1} placeholder={isListening ? 'Listening… speak your request' : 'Message Naidify AI…'} className="max-h-32 min-h-[42px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] font-medium text-ink outline-none placeholder:text-quill-soft" /><div className="flex items-center justify-between gap-2 px-1"><div className="flex items-center gap-1"><button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-quill hover:bg-mist" aria-label="Attach a file"><Paperclip className="h-4 w-4" /></button><button type="button" onClick={toggleListening} disabled={!browserVoiceAvailable} className={`flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-extrabold transition-colors ${isListening ? 'bg-brand text-white' : 'text-quill hover:bg-mist'} disabled:cursor-not-allowed disabled:opacity-40`} aria-label={isListening ? 'Stop listening' : 'Use voice input'}>{isListening ? <><StopCircle className="h-4 w-4" /> <span className="hidden sm:inline">Listening</span></> : <><Mic className="h-4 w-4" /> <span className="hidden sm:inline">Voice</span></>}</button></div><button type="submit" disabled={!input.trim() || isSending} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_20px_-12px_rgba(90,73,230,0.95)] transition-all hover:bg-brand-mid disabled:cursor-not-allowed disabled:bg-mist-2 disabled:text-quill-soft" aria-label="Send message"><ArrowUp className="h-4 w-4" /></button></div></div><div className="mt-2 flex items-center justify-between px-2 text-[10px] font-semibold text-quill-soft"><span>{browserVoiceAvailable ? 'Voice input ready' : 'Voice input is not supported in this browser'}</span><span className="hidden sm:inline">AI can make mistakes. Review actions before saving.</span></div></form></div>
        </section>
      </div>
    </main>
  );
}
