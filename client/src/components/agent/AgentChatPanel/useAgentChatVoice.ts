import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/hooks/use-toast";

interface MinimalSpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export function useAgentChatVoice({
  setMessage,
}: {
  setMessage: Dispatch<SetStateAction<string>>;
}) {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  const toggleVoiceInput = useCallback(() => {
    type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;
    const W = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionAPI = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({
        title: "Not supported",
        description: "Voice input is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: MinimalSpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, setMessage, toast]);

  return { isListening, toggleVoiceInput };
}
