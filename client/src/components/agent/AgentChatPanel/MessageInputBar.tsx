import type { RefObject } from "react";
import { Paperclip, Mic, MicOff, Send, Loader2, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_ATTACHMENTS } from "./constants";

export function MessageInputBar({
  message,
  setMessage,
  attachedFiles,
  filePreviews,
  uploadProgress,
  isStreaming,
  isListening,
  onRemoveFile,
  onPickFiles,
  onToggleVoice,
  onSubmit,
  inputRef,
  fileInputRef,
  formRef,
}: {
  message: string;
  setMessage: (v: string) => void;
  attachedFiles: File[];
  filePreviews: Map<string, string>;
  uploadProgress: number | null;
  isStreaming: boolean;
  isListening: boolean;
  onRemoveFile: (index: number) => void;
  onPickFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleVoice: () => void;
  onSubmit: () => void;
  inputRef: RefObject<HTMLInputElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  formRef: RefObject<HTMLFormElement>;
}) {
  return (
    <div className="flex-shrink-0 border-t p-3">
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachedFiles.map((f, i) => {
            const previewKey = `${f.name}-${f.size}`;
            const previewUrl = filePreviews.get(previewKey);
            return (
              <div key={i} className="relative group" data-testid={`badge-attached-file-${i}`}>
                {previewUrl ? (
                  <div className="w-16 h-16 rounded border overflow-hidden bg-muted">
                    <img src={previewUrl} alt={f.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-muted rounded px-2 py-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[100px] truncate">{f.name}</span>
                  </div>
                )}
                <button
                  onClick={() => onRemoveFile(i)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${f.name}`}
                  data-testid={`button-remove-file-${i}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {uploadProgress !== null && (
        <div className="mb-2" data-testid="upload-progress">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Uploading... {uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex gap-2"
        data-testid="form-agent-chat"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.pdf,.csv"
          onChange={onPickFiles}
          className="hidden"
          aria-label="Upload files"
          data-testid="input-file-upload"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || attachedFiles.length >= MAX_ATTACHMENTS}
          className="flex-shrink-0"
          aria-label="Attach file"
          data-testid="button-attach-file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            attachedFiles.length > 0
              ? "Describe what to do with the file(s)..."
              : "Ask about your fleet..."
          }
          disabled={isStreaming}
          className="flex-1"
          data-testid="input-agent-message"
        />
        <Button
          type="button"
          variant={isListening ? "destructive" : "ghost"}
          size="icon"
          onClick={onToggleVoice}
          disabled={isStreaming}
          className="flex-shrink-0"
          aria-label={isListening ? "Stop listening" : "Voice input"}
          data-testid="button-voice-input"
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button
          type="submit"
          size="icon"
          disabled={(!message.trim() && attachedFiles.length === 0) || isStreaming}
          aria-label="Send message"
          data-testid="button-send-message"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
