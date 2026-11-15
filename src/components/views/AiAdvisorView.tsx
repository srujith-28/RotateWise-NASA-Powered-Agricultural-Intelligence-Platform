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
          <span className="rounded-lg border border-[#E1E8E2] bg-white px-3 py-1.5 text-xs font-semibold text-[#174C3C]">
            {geminiConfigured ? 'Gemini Server Integration Active' : 'Local Agronomy Demo Mode'}
          </span>
        }
      />

      <div className="flex items-start gap-2.5 rounded-xl border border-[#DCE5DF] bg-[#F2F6F3] px-4 py-3 text-xs text-[#284737]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#154734]" aria-hidden="true" />
        <span>
          {notice ??
            (geminiConfigured
              ? 'Server-side Gemini API is configured and attached to your active farm soil and climate context.'
              : 'No external Gemini API key is active in this environment. Responses below are computed deterministically by the local agronomy engine and clearly labeled as Local Agronomy Demo.')}
        </span>
      </div>

      <div className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEAE3] pb-3">
          <div className="flex items-center gap-2 text-xs text-[#4B5B51]">
            <Bot className="h-4 w-4 text-[#2E8B57]" aria-hidden="true" />
            <span>
              Active context:{' '}
              <strong className="text-[#14221A]">
                {farm ? `${farm.name} (${farm.currentCropName})` : 'None'}
              </strong>
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#14221A]">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="h-4 w-4 rounded accent-[#154734]"
            />
            <span>Attach farm soil &amp; climate profile</span>
          </label>
        </div>

        <div className="mt-4 max-h-[380px] space-y-4 overflow-y-auto pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-auto max-w-2xl bg-[#154734] text-white'
                  : 'mr-auto max-w-3xl border border-[#E4E2DA] bg-[#FAF9F5] text-[#14221A]'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] opacity-80">
                <span className="font-semibold">
                  {msg.role === 'user'
                    ? 'Farm Manager'
                    : msg.sourceMode === 'gemini-live'
                      ? 'RotateWise AI (Gemini)'
                      : 'RotateWise Agronomy Demo'}
                </span>
                <span className="font-mono">{msg.timestamp}</span>
              </div>
              <p className="whitespace-pre-line">{msg.content}</p>
            </div>
          ))}
          {loading && (
            <div className="mr-auto max-w-md rounded-xl border border-[#E4E2DA] bg-[#FAF9F5] p-4 text-xs text-[#4B5B51]">
              Evaluating soil, rotation sequence, and climate profile...
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-[#ECEAE3] pt-4">
          <p className="text-xs font-medium text-[#6B7970]">Suggested Prompts</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESET_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={!farm || loading}
                onClick={() => sendQuestion(p)}
                className="rounded-lg border border-[#D8D5CB] bg-[#FBFBF9] px-3 py-1.5 text-left text-xs font-medium text-[#14221A] hover:bg-[#F2F6F3] disabled:opacity-50"
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
            className="mt-4 flex gap-2.5"
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
              className="h-11 flex-1 rounded-lg border border-[#D8D5CB] bg-white px-3.5 text-sm text-[#14221A] focus:border-[#154734] focus:outline-none disabled:bg-[#F6F5F0]"
            />
            <button
              type="submit"
              disabled={!farm || !input.trim() || loading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#154734] px-4 text-sm font-medium text-white hover:bg-[#0F3527] disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Ask Advisor</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
