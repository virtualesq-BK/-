'use client';

import { useCallback, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle,
  FileUp,
  Loader2,
  Mic,
  MicOff,
  Send,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AuditRiskResult } from '@/lib/ai/auditRiskScore';
import { cn } from '@/lib/utils';

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatInterface() {
  const [sessionId] = useState(generateSessionId);
  const [attachedContext, setAttachedContext] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [auditAlert, setAuditAlert] = useState<AuditRiskResult | null>(null);
  const [cpaRequestStatus, setCpaRequestStatus] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
  } = useChat({
    api: '/api/chat',
    onFinish: async (message) => {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      if (!lastUser) return;

      try {
        const res = await fetch('/api/chat/audit-risk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: lastUser.content,
            assistantMessage: message.content,
          }),
        });
        if (res.ok) {
          const audit: AuditRiskResult = await res.json();
          if (audit.alertRequired) {
            setAuditAlert(audit);
          }
        }
      } catch {
        // non-blocking
      }

      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuditAlert(null);
    setCpaRequestStatus(null);
    handleSubmit(e, {
      body: {
        sessionId,
        attachedContext: attachedContext ?? undefined,
      },
    });
    setAttachedContext(null);
    setAttachedFileName(null);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        const res = await fetch('/api/chat/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const { text } = await res.json();
          setInput((prev) => (prev ? `${prev} ${text}` : text));
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      alert('마이크 접근 권한이 필요합니다.');
    }
  }, [setInput]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const { extractedText, fileName } = await uploadRes.json();
      setAttachedContext(extractedText);
      setAttachedFileName(fileName);
    } catch {
      alert('파일 처리에 실패했습니다. PDF 또는 이미지를 사용해 주세요.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const requestCpaReview = async (messageContent: string, messageId?: string) => {
    setCpaRequestStatus(null);
    const res = await fetch('/api/chat/cpa-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageContent, messageId }),
    });

    if (res.ok) {
      setCpaRequestStatus('CPA 검토 요청이 접수되었습니다. 담당 CPA가 10분 내 검토합니다.');
    } else {
      setCpaRequestStatus('CPA 검토 요청에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <div className="flex flex-1 flex-col rounded-lg border">
      {auditAlert && (
        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              감사 위험 점수 {auditAlert.overallScore}점 — CPA 상담을 권장합니다
            </p>
            <ul className="list-disc pl-4">
              {auditAlert.mitigationSuggestions.slice(0, 3).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => setAuditAlert(null)}
          >
            닫기
          </Button>
        </div>
      )}

      {cpaRequestStatus && (
        <div className="border-b bg-blue-50 p-3 text-center text-sm text-blue-800">
          {cpaRequestStatus}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground">
            IRS Publication 기반으로 공제, 양식, 추정세에 대해 질문하세요.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'group max-w-[85%] rounded-lg px-4 py-3',
              message.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'mr-auto bg-muted'
            )}
          >
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            )}

            {message.role === 'assistant' && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => requestCpaReview(message.content, message.id)}
              >
                <UserCheck className="h-3 w-3" />
                CPA 검토 요청
              </Button>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            IRS 문서를 참고하여 답변 중...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {attachedFileName && (
        <div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          첨부됨: {attachedFileName}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t p-4">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleFileAttach}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={isUploading || isLoading}
            onClick={() => fileInputRef.current?.click()}
            title="파일 첨부"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={isLoading}
            onClick={isRecording ? stopRecording : startRecording}
            title="음성 입력"
          >
            {isRecording ? (
              <MicOff className="h-4 w-4 text-destructive" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="세금 관련 질문을 입력하세요..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
