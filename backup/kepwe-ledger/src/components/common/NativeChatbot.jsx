import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../api/client';
import './NativeChatbot.css';

const WELCOME_MESSAGE = 'Hi, I am KEPWE Assist. Ask me about the dashboards, markets, trial access, plans, brokers, or how to use the platform.';
const STARTER_PROMPTS = ['What can I use in my trial?', 'How do I connect Angel One?', 'Show available plans'];

export default function NativeChatbot() {
  const { authState } = useApp();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', text: WELCOME_MESSAGE }]);
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading]);

  const sendMessage = async (value = message) => {
    const text = value.trim();
    if (!text || isLoading) return;
    if (!authState.isLoggedIn) {
      setMessages((current) => [...current, {
        id: `login-${Date.now()}`,
        role: 'assistant',
        text: 'Please sign in to ask account-aware questions. Your KEPWE session keeps responses scoped to your account.',
      }]);
      setMessage('');
      return;
    }

    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text }]);
    setMessage('');
    setIsLoading(true);
    try {
      const response = await apiFetch('/chatbot/message', {
        method: 'POST',
        body: { message: text },
      });
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: response.ok ? response.data?.message : (response.data?.error || 'I could not process that request right now.'),
        suggestions: response.ok ? response.data?.suggestions : [],
      }]);
    } catch {
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        text: 'I could not reach KEPWE right now. Please try again shortly.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  return (
    <>
      {open && !minimized && (
        <section className="native-chatbot-panel" aria-label="KEPWE Assist chat">
          <header className="native-chatbot-header">
            <div className="native-chatbot-title">
              <span className="native-chatbot-icon"><Bot size={18} /></span>
              <span>
                <strong>KEPWE Assist</strong>
                <small>Native platform guide</small>
              </span>
            </div>
            <div className="native-chatbot-actions">
              <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize chat" title="Minimize chat"><ChevronDown size={17} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" title="Close chat"><X size={17} /></button>
            </div>
          </header>

          <div className="native-chatbot-messages" aria-live="polite">
            {messages.map((item) => (
              <div key={item.id} className={`native-chatbot-message ${item.role}`}>
                <p>{item.text}</p>
                {item.suggestions?.length > 0 && (
                  <div className="native-chatbot-suggestions">
                    {item.suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)}>{suggestion}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="native-chatbot-starters">
                {STARTER_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>)}
              </div>
            )}
            {isLoading && <div className="native-chatbot-typing"><Sparkles size={14} /> Checking KEPWE information...</div>}
            <div ref={endRef} />
          </div>

          <form className="native-chatbot-form" onSubmit={handleSubmit}>
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about KEPWE..." maxLength={600} aria-label="Chat message" />
            <button type="submit" disabled={!message.trim() || isLoading} aria-label="Send message" title="Send message"><Send size={16} /></button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`native-chatbot-launcher ${open ? 'open' : ''}`}
        onClick={() => { setOpen((current) => !current); setMinimized(false); }}
        aria-label={open ? 'Close KEPWE Assist' : 'Open KEPWE Assist'}
        title="Open KEPWE Assist"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span className="native-chatbot-launcher-label">Ask KEPWE</span>}
      </button>

      {open && minimized && (
        <button type="button" className="native-chatbot-minimized" onClick={() => setMinimized(false)}>
          <Bot size={16} /> KEPWE Assist <ChevronDown size={15} />
        </button>
      )}
    </>
  );
}
