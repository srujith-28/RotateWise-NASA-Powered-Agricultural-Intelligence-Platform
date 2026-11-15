import { Bot, Info, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdvisorMessage, Farm } from '../../types/rotatewise';
import { PageHeader } from '../ui/PageHeader';

interface AiAdvisorViewProps {
  farm: Farm | null;
  geminiConfigured: boolean;
  onLogActivity: (action: string, detail: string) => void;
}

const PRESET_PROMPTS = [
  'What crop should I plant next season to recover soil nitrogen?',
  'How does a 20% rainfall deficit affect my current rotation?',
  'Are there any pest carryover risks in my planned sequence?',
];

export function AiAdvisorView({
  farm,
  geminiConfigured,
  onLogActivity,
}: AiAdvisorViewProps) {
  const buildWelcomeMessage = (targetFarm: Farm | null): AdvisorMessage => ({
    id: `welcome-${targetFarm?.id ?? 'none'}`,
    role: 'assistant',
    content: targetFarm
      ? `Ready to analyze ${targetFarm.name} (${targetFarm.location}, ${targetFarm.soilType}, currently in ${targetFarm.currentCropName}). Ask about next-season crop selection, nitrogen balance, cover crops, or drought resilience.`
      : 'Select or create a farm to begin receiving tailored agronomy and rotation advice.',
    timestamp: 'Now',
    sourceMode: geminiConfigured ? 'gemini-live' : 'local-agronomy-demo',
  });

  const [messages, setMessages] = useState<AdvisorMessage[]>(() => [
    buildWelcomeMessage(farm),
  ]);
  const [input, setInput] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setMessages([buildWelcomeMessage(farm)]);
    setNotice(null);
  }, [farm?.id, geminiConfigured]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !farm || loading) return;

    const userMsg: AdvisorMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      farmContextName: includeContext ? farm.name : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch('/api/advisor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          farm,
          includeFarmContext: includeContext,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reach advisor endpoint.');
      }

      if (data.notice) {
        setNotice(data.notice);
      }

      const assistantMsg: AdvisorMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceMode: data.sourceMode,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      onLogActivity('AI Farm Advisor consulted', trimmed.slice(0, 72));
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Unable to reach advisor service.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Request error: ${errText}`,
          timestamp: 'Error',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="AI Farm Advisor"
        title="AI Farm Advisor"
        subtitle="Context-grounded crop rotation and soil stewardship consultation powered by the server-side advisor module."
        classification={geminiConfigured ? 'suitability' : 'demo'}
        actions={
          <span className="inline-flex h-9 items-center rounded-xl border border-[#E7EBE7] bg-white px-3.5 text-xs font-semibold text-[#174C3C]">
            {geminiConfigured ? 'Gemini Server Integration Active' : 'Local Agronomy Demo Mode'}
          </span>
        }
      />

      <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAF2EC] px-4 py-3 text-xs text-[#174C3C]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
        <span>
          {notice ??
            (geminiConfigured
              ? 'Server-side Gemini API is configured and attached to your active farm soil and climate context.'
              : 'No external Gemini API key is active in this environment. Responses below are computed deterministically by the local agronomy engine and clearly labeled as Local Agronomy Demo.')}
        </span>
      </div>

      <section
        aria-label="Agronomy consultation console"
        className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7EBE7] pb-4">
          <div className="flex items-center gap-2 text-xs text-[#737D76]">
            <Bot className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
            <span>
              Active context:{' '}
              <strong className="font-semibold text-[#18231E]">
                {farm ? `${farm.name} (${farm.currentCropName})` : 'None'}
              </strong>
            </span>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#18231E]">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="h-4 w-4 rounded accent-[#174C3C]"
            />
            <span>Attach farm soil &amp; climate profile</span>
          </label>
        </div>

        <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-auto max-w-2xl bg-[#14251D] text-white'
                  : 'mr-auto max-w-3xl bg-[#F7F8F6] text-[#18231E]'
              }`}
            >
              <div
                className={`mb-2 flex items-center justify-between gap-3 text-[11px] ${
                  msg.role === 'user' ? 'text-[#B9CEC0]' : 'text-[#737D76]'
                }`}
              >
                <span className="font-semibold">
                  {msg.role === 'user'
                    ? 'Farm Manager'
                    : msg.sourceMode === 'gemini-live'
                      ? 'RotateWise AI (Gemini)'
                      : 'RotateWise Agronomy Demo'}
                </span>
                <span className="font-mono tabular-nums">{msg.timestamp}</span>
              </div>
              <p className="whitespace-pre-line">{msg.content}</p>
            </div>
          ))}
          {loading && (
            <div className="mr-auto max-w-md rounded-2xl bg-[#F7F8F6] p-4 text-xs text-[#737D76]">
              Evaluating soil, rotation sequence, and climate profile...
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-[#E7EBE7] pt-4">
          <p className="text-xs font-medium text-[#737D76]">Suggested Prompts</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {PRESET_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={!farm || loading}
                onClick={() => sendQuestion(p)}
                className="rounded-xl border border-[#E7EBE7] bg-[#F7F8F6] px-3 py-2 text-left text-xs font-medium text-[#18231E] transition-colors hover:bg-[#EAF2EC] disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="mt-4 flex flex-col gap-2.5 sm:flex-row"
          >
            <label htmlFor="advisor-question-input" className="sr-only">
              Ask AI Farm Advisor
            </label>
            <input
              id="advisor-question-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!farm || loading}
              placeholder={
                farm
                  ? `Ask about ${farm.name}'s crop rotation, soil health, or climate risks...`
                  : 'Select a farm first...'
              }
              className="h-11 flex-1 rounded-xl border border-[#E7EBE7] bg-white px-3.5 text-sm text-[#18231E] focus:border-[#174C3C] focus:outline-none disabled:bg-[#F7F8F6]"
            />
            <button
              type="submit"
              disabled={!farm || !input.trim() || loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#174C3C] px-4 text-sm font-medium text-white shadow-[0_1px_2px_rgba(20,37,29,0.12)] transition-colors hover:bg-[#133F32] disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Ask Advisor</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
