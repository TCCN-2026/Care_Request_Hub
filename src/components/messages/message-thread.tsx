"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface MessageThreadItem {
  id: string;
  body: string;
  createdAt: string;
  senderLabel: string;
  isOwnMessage: boolean;
  flagged?: boolean;
  flagReason?: string | null;
}

export function MessageThread({
  messages,
  onSend,
  showFlags,
  emptyLabel = "No messages yet.",
}: {
  messages: MessageThreadItem[];
  onSend?: (body: string) => Promise<{ error?: string }>;
  showFlags?: boolean;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!onSend || draft.trim().length === 0) return;
    setSending(true);
    setError(null);
    const result = await onSend(draft);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-md border p-3 text-sm ${
                message.isOwnMessage ? "border-zinc-300 bg-zinc-50" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">{message.senderLabel}</span>
                <div className="flex items-center gap-2">
                  {showFlags && message.flagged && <Badge variant="destructive">Flagged</Badge>}
                  <span className="text-xs text-zinc-500">
                    {new Date(message.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">{message.body}</p>
              {showFlags && message.flagged && message.flagReason && (
                <p className="mt-1 text-xs text-red-700">Reason: {message.flagReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {onSend && (
        <div className="space-y-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Textarea
            rows={2}
            placeholder="Write a message…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={sending}
          />
          <Button type="button" size="sm" disabled={sending || draft.trim().length === 0} onClick={handleSend}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      )}
    </div>
  );
}
