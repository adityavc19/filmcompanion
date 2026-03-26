"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { track } from "@/lib/analytics";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  positions: number[];
  texts: string[];
  filmTitle?: string;
  filmYear?: string;
  cardLabels?: { type: string; leftPole?: string; rightPole?: string }[];
}

export default function ChatInterface({
  positions,
  texts,
  filmTitle = "this film",
  filmYear = "",
  cardLabels = [],
}: ChatInterfaceProps) {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate a simple opener based on positions
  useEffect(() => {
    if (started && messages.length === 0) {
      const opener = `You just went through the provocation cards for ${filmTitle}. Your positions tell an interesting story — what's the thing about this film you're still turning over?`;
      setMessages([{ id: "opener", role: "assistant", content: opener }]);
    }
  }, [started, messages.length, filmTitle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      track("chat_message_sent", {
        message_number: updatedMessages.filter((m) => m.role === "user").length,
        char_count: userMessage.length,
      });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            filmTitle,
            filmYear,
            positions,
            texts,
            cardLabels,
          }),
        });

        if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No body");

        const assistantId = `assistant-${Date.now()}`;
        let content = "";

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
          );
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Something went wrong. Check that the Gemini API key is set.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, positions, texts, filmTitle, filmYear, cardLabels]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  if (!started) {
    return (
      <button
        onClick={() => {
          setStarted(true);
          track("go_deeper_tap");
        }}
        className="w-full py-4 bg-surface text-text text-center font-medium text-base rounded-xl transition-all hover:bg-surface-hover active:scale-[0.98]"
      >
        Go deeper
      </button>
    );
  }

  return (
    <div className="flex flex-col bg-surface rounded-xl overflow-hidden">
      <div className="flex-1 max-h-[50vh] overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-bg rounded-br-sm"
                  : "bg-bg text-text rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-bg text-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-text/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask anything about ${filmTitle}...`}
          className="flex-1 bg-bg text-text text-sm rounded-lg px-4 py-3 placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-3 bg-accent text-bg rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          →
        </button>
      </form>
    </div>
  );
}
