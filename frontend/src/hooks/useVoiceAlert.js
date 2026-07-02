import { useCallback, useRef } from "react";

export function useVoiceAlert() {
  const lastSpoken = useRef("");
  const cooldownTimer = useRef(null);

  const speak = useCallback((text, lang = "hi-IN") => {
    if (!text || text === lastSpoken.current) return;
    if (!window.speechSynthesis) return;

    lastSpoken.current = text;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => {
      lastSpoken.current = "";
    }, 4000);
  }, []);

  return { speak };
}
