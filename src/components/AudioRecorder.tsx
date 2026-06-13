import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Sparkles, Loader2, AlertCircle, RefreshCw, Keyboard, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { localTextParser } from "../utils/localProcessor";

interface AudioRecorderProps {
  players: string[];
  onEventsProcessed: (
    events: any[],
    transcription: string,
    unmatchedName?: string,
    success?: boolean
  ) => void;
  activeMatch: boolean;
  isOnline: boolean;
  onQueueOfflineEvent: (type: 'audio' | 'text', data: { text?: string; audioBase64?: string; mimeType?: string }) => void;
  textAccent?: string;
  bgAccent?: string;
  hoverAccent?: string;
  badgeColor?: string;
  badgeLight?: string;
  iconColor?: string;
  inputFocus?: string;
  buttonShadow?: string;
}

export default function AudioRecorder({ 
  players, 
  onEventsProcessed, 
  activeMatch, 
  isOnline, 
  onQueueOfflineEvent,
  textAccent = "text-emerald-400",
  bgAccent = "bg-emerald-500",
  hoverAccent = "hover:bg-emerald-400",
  badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  badgeLight = "bg-emerald-500 text-[#050505]",
  iconColor = "text-emerald-400",
  inputFocus = "focus:border-emerald-500",
  buttonShadow = "shadow-emerald-500/10"
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [activeOperations, setActiveOperations] = useState(0);
  const isProcessing = activeOperations > 0;
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(12).fill(10));
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<'success' | 'warning' | 'error' | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const speechRecognitionRef = useRef<any>(null);
  const gotSpeechResultsRef = useRef<boolean>(false);
  const speechTranscriptRef = useRef<string>("");

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      stopTracksAndContext();
    };
  }, []);

  const stopTracksAndContext = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const startLevelVisualization = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Take 12 bins from frequency, normalize to a height between 4px and 48px
        const newLevels = Array.from(dataArray.slice(0, 12)).map(val => {
          return Math.max(6, Math.min(48, (val / 255) * 48));
        });
        setAudioLevel(newLevels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };

      updateLevels();
    } catch (e) {
      console.warn("Could not start levels visualizer context", e);
    }
  };

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    setLiveTranscript("");
    gotSpeechResultsRef.current = false;
    speechTranscriptRef.current = "";

    // 1. Try to start Native Web Speech API for lightning-fast real-time transcriptions
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const rec = new SpeechRecognitionClass();
        rec.lang = "ar-EG"; // Arabic - Egypt (perfect for futbol matches)
        rec.continuous = true;
        rec.interimResults = true;

        rec.onstart = () => {
          console.log("Speech recognition started.");
        };

        rec.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const currentText = finalTranscript || interimTranscript;
          if (currentText.trim()) {
            speechTranscriptRef.current = currentText;
            setLiveTranscript(currentText);
            gotSpeechResultsRef.current = true;
          }
        };

        rec.onerror = (e: any) => {
          console.warn("Speech recognition error:", e);
        };

        rec.onend = () => {
          console.log("Speech recognition ended.");
        };

        speechRecognitionRef.current = rec;
        rec.start();
      } catch (e) {
        console.warn("Could not start Web Speech Recognition API:", e);
      }
    }

    // 2. Start human speech focused DSP pipeline & normal MediaRecorder & audio level visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 }
        }
      });
      streamRef.current = stream;

      // Initialize Web Audio API to establish deep DSP speech isolation
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // Create audio nodes
      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // Noise Filter 1: High-pass Filter (cutoff ~90Hz to completely eliminate low-frequency environment hums, air conditioning rumbles, and background vibrations)
      const highpassFilter = audioCtx.createBiquadFilter();
      highpassFilter.type = "highpass";
      highpassFilter.frequency.value = 90;

      // Noise Filter 2: Low-pass Filter (cutoff ~3800Hz to remove high-frequency hiss, static noise, wind whispers, focusing squarely on the fundamental range of human speech)
      const lowpassFilter = audioCtx.createBiquadFilter();
      lowpassFilter.type = "lowpass";
      lowpassFilter.frequency.value = 3800;

      // Dynamics Management: Dynamics Compressor Node (to normalize volume, boosting quiet spoken words and preventing loud sudden spikes from distorting the signal)
      const dynamicsCompressor = audioCtx.createDynamicsCompressor();
      dynamicsCompressor.threshold.setValueAtTime(-22, audioCtx.currentTime);
      dynamicsCompressor.knee.setValueAtTime(25, audioCtx.currentTime);
      dynamicsCompressor.ratio.setValueAtTime(8, audioCtx.currentTime);
      dynamicsCompressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
      dynamicsCompressor.release.setValueAtTime(0.20, audioCtx.currentTime);

      // Connect the speech isolation sequence: input source -> Highpass filter -> Lowpass filter -> Compressor
      sourceNode.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(dynamicsCompressor);

      // Create destination node to pipe the clean, purified voice stream to the MediaRecorder
      const recDestination = audioCtx.createMediaStreamDestination();
      dynamicsCompressor.connect(recDestination);

      // Create visualizer analyser node connected to the purified stream
      const visualizerAnalyser = audioCtx.createAnalyser();
      visualizerAnalyser.fftSize = 64;
      dynamicsCompressor.connect(visualizerAnalyser);
      analyserRef.current = visualizerAnalyser;

      // Start level visualizer loop using the clean voice frequencies
      const dataArray = new Uint8Array(visualizerAnalyser.frequencyBinCount);
      const updateLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Take 12 bins from frequency, normalize to a height between 6px and 48px
        const newLevels = Array.from(dataArray.slice(0, 12)).map(val => {
          return Math.max(6, Math.min(48, (val / 255) * 48));
        });
        setAudioLevel(newLevels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      // Setup MediaRecorder with the clean, noise-purified stream
      const cleanStream = recDestination.stream;
      const options = { mimeType: "audio/webm" };
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(cleanStream, options);
      } catch (e) {
        // Fallback mimeType for mobile Safari / older devices
        mediaRecorder = new MediaRecorder(cleanStream);
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks & close context immediately AFTER grabbing final chunks and stopping MediaRecorder
        stopTracksAndContext();
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const fallbackText = speechTranscriptRef.current.trim();
        await handleSendAudio(audioBlob, fallbackText);
      };

      mediaRecorder.start(250); // Slice chunks every 250ms
      setIsRecording(true);

      // Play short haptic vibration
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }
    } catch (err: any) {
      console.error("Recording permission or device error:", err);
      setError("لم نتمكن من الوصول للميكروفون. يرجى تفعيل الصلاحية.");
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) {}
      }
    }
  };

  const stopRecording = () => {
    // Stop Web Speech Recognition API first
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }
  };

  // Convert blob to base64 and process
  const handleSendAudio = async (blob: Blob, fallbackText?: string) => {
    setActiveOperations(prev => prev + 1);
    setError(null);
    setLastTranscript(null);
    setLastStatus(null);

    try {
      const mimeType = blob.type || "audio/webm";

      if (isOnline) {
        // 1. Convert video/audio Blob into Base64 format
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              const base64String = reader.result.split(',')[1];
              resolve(base64String);
            } else {
              reject(new Error("تعذر تحويل الملف الصوتي المسجل إلى صيغة مشفرة للـ AI."));
            }
          };
          reader.onerror = () => reject(new Error("حدث خطأ أثناء قراءة ملف الصوت المسجل."));
          reader.readAsDataURL(blob);
        });

        // 2. Transcribe & analyze audio on backend with gemini
        const response = await fetch("/api/process-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            audio: base64,
            mimeType,
            players
          })
        });

        if (!response.ok) {
          throw new Error(`استجاب الخادم بخطأ: ${response.status}`);
        }

        const data = await response.json();
        
        // If the server-side processing indicates a quota fallback or audio failure,
        // and we have a valid client-side live speech transcript, fall back to it!
        if ((!data.success || data.transcription?.includes("حصة")) && fallbackText && fallbackText.trim()) {
          console.log("[AudioRecorder] Server audio model returned quota fallback. Trying client-side fallback with text:", fallbackText);
          const result = localTextParser(fallbackText, players);
          processAiResult(result);
        } else {
          processAiResult(data);
        }
      } else {
        // 3. Keep offline fallback
        if (fallbackText && fallbackText.trim()) {
          console.log("[AudioRecorder] Offline. Immediate client-side fallback parsing of text:", fallbackText);
          const result = localTextParser(fallbackText, players);
          processAiResult(result);
        } else {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
              } else {
                reject(new Error("تعذر تحويل الملف الصوتي المسجل."));
              }
            };
            reader.readAsDataURL(blob);
          });
          onQueueOfflineEvent('audio', { audioBase64: base64, mimeType });
          setError("تم حفظ التسجيل الصوتي محلياً ومؤقتاً. سنقوم بمعالجته وتفريغه تلقائياً بمجرد عودة الاتصال للشريحة!");
          setLastStatus('warning');
        }
      }
    } catch (err: any) {
      console.error("Audio processor failure on client:", err);
      
      // Fallback on full server/network error
      if (fallbackText && fallbackText.trim()) {
        console.log("[AudioRecorder] Server/network error. Proceeding with client-side fallback text local parsing:", fallbackText);
        try {
          const result = localTextParser(fallbackText, players);
          processAiResult(result);
          return;
        } catch (fallbackErr) {
          console.error("Failed to parse fallback text:", fallbackErr);
        }
      }
      
      setError(err.message || "حدث خطأ غير متوقع أثناء معالجة التسجيل الصوتي بالذكاء الاصطناعي.");
      setLastStatus('error');
    } finally {
      setActiveOperations(prev => Math.max(0, prev - 1));
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualText.trim()) return;

    setActiveOperations(prev => prev + 1);
    setError(null);
    setLastTranscript(null);
    setLastStatus(null);
    const textVal = manualText.trim();
    setManualText(""); // Clear instantly so they can type the next event immediately!
    setIsKeyboardMode(false);

    try {
      if (isOnline) {
        const response = await fetch("/api/process-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: textVal,
            players
          })
        });

        if (response.ok) {
          const result = await response.json();
          processAiResult(result);
          return;
        }
      }

      // Fallback/offline: Direct local processing on the client
      const result = localTextParser(textVal, players);
      processAiResult(result);
    } catch (err: any) {
      console.warn("Server text process failed, falling back to local text parser:", err);
      try {
        const result = localTextParser(textVal, players);
        processAiResult(result);
      } catch (fallbackErr: any) {
        console.error(fallbackErr);
        setError("حدث خطأ غير متوقع أثناء المعالجة المحلية للبيانات.");
        setLastStatus('error');
      }
    } finally {
      setActiveOperations(prev => Math.max(0, prev - 1));
    }
  };

  const handleSendTextDirectly = async (text: string) => {
    setActiveOperations(prev => prev + 1);
    setError(null);
    setLastTranscript(null);
    setLastStatus(null);
    const textVal = text.trim();

    try {
      if (isOnline) {
        const response = await fetch("/api/process-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: textVal,
            players
          })
        });

        if (response.ok) {
          const result = await response.json();
          processAiResult(result);
          return;
        }
      }

      // Direct local processing on the client
      const result = localTextParser(textVal, players);
      processAiResult(result);
    } catch (err: any) {
      console.warn("Server text process failed in direct mode, falling back to local text parser:", err);
      try {
        const result = localTextParser(textVal, players);
        processAiResult(result);
      } catch (fallbackErr) {
        console.error("Error with direct voice text process:", fallbackErr);
        setError("فشلت معالجة النص التفاعلي محلياً.");
        setLastStatus('error');
      }
    } finally {
      setActiveOperations(prev => Math.max(0, prev - 1));
      setLiveTranscript("");
    }
  };

  const processAiResult = (result: any) => {
    setLastTranscript(result.transcription);
    
    if (result.success && result.events && result.events.length > 0) {
      onEventsProcessed(result.events, result.transcription, result.unmatchedName, true);
      setLastStatus('success');
      if (navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    } else {
      // Unmatched or unrecognized
      setLastStatus('warning');
      onEventsProcessed([], result.transcription, result.unmatchedName || "غير محدد", false);
      if (result.unmatchedName) {
        setError(`لم يتم مطابقة الاسم "${result.unmatchedName}" بقائمة اللاعبين الحالية. يرجى كتابته أو ذكره كما هو مسجل.`);
      } else {
        setError("لم نتعرف على الحدث الإحصائي بوضوح. يرجى ذكر اسم اللاعب المسجل والحدث.");
      }
    }
  };

  if (!activeMatch) return null;

  let ringColorClass = "bg-emerald-500";
  if (bgAccent && bgAccent.includes("bg-red-")) ringColorClass = "bg-red-500";
  else if (bgAccent && bgAccent.includes("bg-amber-")) ringColorClass = "bg-amber-500";
  else if (bgAccent && bgAccent.includes("bg-cyan-")) ringColorClass = "bg-cyan-500";
  else if (bgAccent && bgAccent.includes("bg-blue-")) ringColorClass = "bg-blue-500";

  return (
    <div className="w-full flex flex-col items-center bg-[#0f0f0f] border border-[#1c1c1c] text-white p-5 sm:p-8 rounded-3xl md:rounded-[2.5rem] shadow-[0_10px_35px_-10px_rgba(0,0,0,0.8)] mb-6 relative overflow-hidden" id="audio-recorder-module">
      
      {/* Decorative center accent */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/5 -translate-x-1/2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-white/5 pointer-events-none" />

      {/* Floating Sparkles decorative element */}
      <div className={`absolute top-4 left-5 flex items-center gap-1.5 text-xs ${textAccent} font-black tracking-widest uppercase`}>
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        <span>منصة الصوت الذكية • AI Voice Hub</span>
      </div>

      {isKeyboardMode ? (
        // Manual Text Fallback Keyboard Form
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="w-full flex flex-col gap-3 relative z-10 text-gray-200"
          onSubmit={handleSendText}
          id="manual-ai-form"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
              <Keyboard className={`w-4 h-4 ${iconColor}`} />
              أدخل الحدث الكروي كتابياً
            </span>
            <button 
              type="button" 
              onClick={() => setIsKeyboardMode(false)}
              className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              id="manual-text-input"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="مثال: يوسف سجل هدف بمساعدة محمد، أو محمود قطع الكرة..."
              className={`w-full bg-[#141414] text-white placeholder-neutral-500 border border-neutral-850 hover:border-neutral-700/60 rounded-2xl px-4 py-3.5 pl-12 focus:outline-none ${inputFocus} text-sm font-bold transition-all`}
            />
            <button
              type="submit"
              id="manual-submit-button"
              disabled={!manualText.trim()}
              className={`absolute left-2 top-2 bottom-2 ${bgAccent} text-black font-black ${hoverAccent} hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 px-3.5 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 animate-fade-in`}
            >
              {activeOperations > 0 ? (
                <div className="flex items-center gap-1 text-black font-black">
                  <span className="text-[10px]">{activeOperations} جاري...</span>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-neutral-400 font-bold">💡 سيقوم المساعد بمطابقة الأسماء والحدث فوراً!</p>
        </motion.form>
      ) : (
        // Voice Recording Interface
        <div className="w-full flex flex-col items-center relative z-10">
          
          {/* Main big mic action button */}
          <div className="relative mb-5 mt-4">
            {/* Background processing badge */}
            {activeOperations > 0 && (
              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 bg-black/90 ${textAccent} border border-neutral-800 px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1.5 shadow-xl animate-pulse backdrop-blur-md z-30 shrink-0 whitespace-nowrap`}>
                <Loader2 className={`w-3 h-3 animate-spin ${textAccent}`} />
                <span>جاري تحليل {activeOperations} حدث بالخلفية... ⚡</span>
              </div>
            )}

            {/* Pulsing glow rings when recording */}
            {isRecording && (
              <>
                <div className={`absolute inset-0 rounded-full ${ringColorClass}/20 animate-ping -z-10`} />
                <div className={`absolute -inset-4 rounded-full ${ringColorClass}/10 animate-pulse -z-10`} />
              </>
            )}
 
            <button
              type="button"
              id="voice-mic-trigger"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all active:scale-95 duration-200 ${
                isRecording 
                  ? "bg-red-600 text-white border-4 border-white animate-pulse" 
                  : `${bgAccent} text-black hover:scale-105 cursor-pointer shadow-xl ${buttonShadow || 'shadow-black/15'}`
              }`}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-black" />
              )}
            </button>
          </div>

          <div className="text-center mb-4">
            <h3 className="font-extrabold text-xl sm:text-2xl text-white mb-1.5 tracking-tight">
              {isRecording ? "جاري تسجيل صوتك حالياً..." : activeOperations > 0 ? "جاري تحليل الأحداث بالخلفية..." : "سجل الأحداث بصوتك الفوري"}
            </h3>
            <p className="text-xs text-neutral-400 font-bold max-w-xs mx-auto leading-relaxed mb-3">
              {isRecording 
                ? "قل مثلاً: 'عمر جاب جون من صناعة علي' أو 'محمد عمل تصدي رائع'" 
                : "اضغط على الدائرة وتحدث، وسيتكفل مساعد الكورة بتسجيلها!"}
            </p>
            {isRecording && liveTranscript && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`bg-black/80 ${textAccent} border border-neutral-800 px-4 py-2 rounded-2xl max-w-xs mx-auto inline-block text-xs font-bold leading-normal shadow-lg shadow-black/30 backdrop-blur-sm`}
                style={{ direction: "rtl" }}
              >
                🎤 جاري سماع: "{liveTranscript}"
              </motion.div>
            )}
          </div>

          {/* Sound bar level visualizer during recording */}
          {isRecording && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-end justify-center gap-1.5 h-12 w-full mb-4 px-2"
              id="sound-wave-columns"
            >
              {audioLevel.map((lvl, idx) => (
                <motion.div
                  key={idx}
                  className={`w-1.5 rounded-full ${ringColorClass}`}
                  animate={{ height: lvl }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                />
              ))}
            </motion.div>
          )}

          {/* Fallbacks / Alternative triggers */}
          {!isRecording && (
            <button
              type="button"
              id="switch-keyboard-mode"
              onClick={() => setIsKeyboardMode(true)}
              className={`text-xs text-neutral-300 font-extrabold hover:${textAccent} hover:border-neutral-700 bg-[#161616] border border-neutral-850 px-4 py-2 rounded-full transition-all cursor-pointer flex items-center gap-1.5`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              اكتب الحدث الكروي يدوياً بالـ AI
            </button>
          )}
        </div>
      )}

      {/* Transcript Results and Alerts */}
      <AnimatePresence>
        {(error || lastTranscript) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full mt-4 border-t border-black/10 pt-4 relative z-10"
            id="recording-feedback-panel"
          >
            {/* Last Transcript Block */}
            {lastTranscript && (
              <div className={`p-4 rounded-2xl mb-2 text-sm font-bold border flex flex-col gap-1.5 ${
                lastStatus === 'success' 
                  ? `bg-black ${textAccent} border-neutral-800`
                  : lastStatus === 'warning'
                    ? "bg-black/90 border-neutral-800 text-amber-500"
                    : "bg-black/90 border-neutral-800 text-red-400"
              }`}>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold opacity-70">
                  <Sparkles className="w-3.5 h-3.5" />
                  النص المسجل:
                </div>
                <p className="italic">"{lastTranscript}"</p>
              </div>
            )}

            {/* Error Message Block */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
