import React, { useState, useEffect, useRef } from "react";
import { 
  Trophy, 
  Users, 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Sparkles, 
  Crown, 
  Calendar, 
  Flame, 
  ArrowRight, 
  FileText, 
  UserPlus, 
  TrendingUp, 
  Activity, 
  Volume2, 
  Award, 
  CheckCircle, 
  Timer,
  AlertCircle,
  Loader2,
  RefreshCw,
  History,
  ChevronLeft,
  Shield,
  Zap,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { Player, PlayerStats, MatchEvent, MatchState, initialStats, MatchHistoryItem } from "./types";
import AudioRecorder from "./components/AudioRecorder";
import StatsTable from "./components/StatsTable";
import { localTextParser, localGenerateMatchInsights, localGenerateMatchInsightsDual } from "./utils/localProcessor";
import GroupsDashboard, { INITIAL_GROUPS, recalculateGroupStandings } from "./components/GroupsDashboard";
import { calculateMatchMomentum } from "./utils/momentum";
import { getRatingColorClass, calculatePlayerLiveRating } from "./utils/playerRatings";

export interface ThemePreset {
  id: string;
  name: string;
  nameEn: string;
  textAccent: string;
  bgAccent: string;
  hoverAccent: string;
  borderAccent: string;
  badgeColor: string;
  badgeLight: string;
  iconColor: string;
  inputFocus: string;
  gradientFrom: string;
  glowColor: string;
  buttonShadow?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "emerald",
    name: "ملاعب الهضاب الخضراء 🟢",
    nameEn: "Emerald Pitch",
    textAccent: "text-emerald-400",
    bgAccent: "bg-emerald-500",
    hoverAccent: "hover:bg-emerald-400",
    borderAccent: "border-emerald-500/20",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    badgeLight: "bg-emerald-500 text-[#0c0c0c]",
    iconColor: "text-emerald-400",
    inputFocus: "focus:border-emerald-500",
    gradientFrom: "from-emerald-500",
    glowColor: "shadow-emerald-500/15",
    buttonShadow: "shadow-emerald-500/10"
  },
  {
    id: "crimson",
    name: "بركان الألتراس الناري 🔴",
    nameEn: "Ultras Crimson",
    textAccent: "text-red-400",
    bgAccent: "bg-red-500",
    hoverAccent: "hover:bg-red-400",
    borderAccent: "border-red-500/20",
    badgeColor: "bg-red-500/10 text-red-500 border border-red-500/20",
    badgeLight: "bg-red-500 text-[#0c0c0c]",
    iconColor: "text-red-400",
    inputFocus: "focus:border-red-500",
    gradientFrom: "from-red-500",
    glowColor: "shadow-red-500/15",
    buttonShadow: "shadow-red-500/10"
  },
  {
    id: "royalBlue",
    name: "السامبا الملكية الزرقاء 🔵",
    nameEn: "Royal Samba",
    textAccent: "text-blue-400",
    bgAccent: "bg-blue-500",
    hoverAccent: "hover:bg-blue-400",
    borderAccent: "border-blue-500/20",
    badgeColor: "bg-blue-500/10 text-blue-450 border border-blue-500/20",
    badgeLight: "bg-blue-500 text-[#0c0c0c]",
    iconColor: "text-blue-400",
    inputFocus: "focus:border-blue-500",
    gradientFrom: "from-blue-500",
    glowColor: "shadow-blue-500/15",
    buttonShadow: "shadow-blue-500/10"
  },
  {
    id: "cyan",
    name: "كهرباء المستقبل النيون 🌐",
    nameEn: "Neon Cyber",
    textAccent: "text-cyan-400",
    bgAccent: "bg-cyan-500",
    hoverAccent: "hover:bg-cyan-400",
    borderAccent: "border-cyan-500/20",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
    badgeLight: "bg-cyan-500 text-[#0c0c0c]",
    iconColor: "text-cyan-400",
    inputFocus: "focus:border-cyan-500",
    gradientFrom: "from-cyan-500",
    glowColor: "shadow-cyan-500/15",
    buttonShadow: "shadow-cyan-500/10"
  },
  {
    id: "gold",
    name: "ذهب منصة التتويج 🟡",
    nameEn: "Champions Gold",
    textAccent: "text-amber-400",
    bgAccent: "bg-amber-500",
    hoverAccent: "hover:bg-amber-400",
    borderAccent: "border-amber-500/20",
    badgeColor: "bg-amber-500/10 text-amber-450 border border-amber-500/20",
    badgeLight: "bg-amber-500 text-[#0c0c0c]",
    iconColor: "text-amber-400",
    inputFocus: "focus:border-amber-500",
    gradientFrom: "from-amber-500",
    glowColor: "shadow-amber-500/15",
    buttonShadow: "shadow-amber-500/10"
  }
];

// Predefined lists to let users start a match instantly!
const INITIAL_DEMO_PLAYERS_A = ["محمد صلاح", "عمر مرموش", "مصطفى محمد", "تريزيجيه", "محمد النني"];
const INITIAL_DEMO_PLAYERS_B = ["ساديو ماني", "رياض محرز", "أشرف حكيمي", "ياسين بونو", "سفيان أمرابط"];

const renderMarkdownLines = (text: string) => {
  if (!text) return <p className="text-gray-400 italic">لا يوجد محتوى متوفر حالياً لهذه الفقرة.</p>;
  return text.split('\n').map((line, i) => {
    if (line.trim().startsWith('###')) {
      return <h4 key={i} className="text-base font-extrabold text-[#10b981] mt-4 mb-2">{line.replace('###', '').trim()}</h4>;
    } else if (line.trim().startsWith('##')) {
      return <h3 key={i} className="text-lg font-black text-[#10b981] mt-5 mb-2 border-r-4 border-[#10b981] pr-2">{line.replace('##', '').trim()}</h3>;
    } else if (line.trim().startsWith('**')) {
      return <p key={i} className="font-bold text-amber-500 my-1">{line.replace(/\*\*/g, '')}</p>;
    } else if (line.trim().startsWith('-')) {
      return <li key={i} className="list-none pr-4 relative before:content-['⚽'] before:absolute before:right-0 before:text-[10px] my-1 text-gray-300 font-semibold">{line.substring(2)}</li>;
    }
    return <p key={i} className="text-gray-200 my-1 pb-1">{line}</p>;
  });
};

export default function App() {
  interface OfflineQueueItem {
    id: string;
    timestamp: string;
    matchTimeInSeconds: number;
    type: 'audio' | 'text';
    textData?: string;
    audioBase64?: string;
    mimeType?: string;
    recordedAt: string;
  }

  const [teamNameA, setTeamNameA] = useState(() => localStorage.getItem("kawera_team_name_a") || localStorage.getItem("kawera_team_name") || "شياطين الجزيرة");
  const [teamNameB, setTeamNameB] = useState(() => localStorage.getItem("kawera_team_name_b") || "عملاقة الهضاب");
  const [themeId, setThemeId] = useState(() => localStorage.getItem("kawera_theme_id") || "emerald");
  const activeTheme = THEME_PRESETS.find(t => t.id === themeId) || THEME_PRESETS[0];

  const [playersA, setPlayersA] = useState<Player[]>(() => {
    const saved = localStorage.getItem("kawera_players_a") || localStorage.getItem("kawera_players");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [playersB, setPlayersB] = useState<Player[]>(() => {
    const saved = localStorage.getItem("kawera_players_b");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [currentTab, setCurrentTab] = useState<'match' | 'groups'>('match');
  const [tournamentGroups, setTournamentGroups] = useState<any[]>(() => {
    const saved = localStorage.getItem("kawera_groups");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_GROUPS();
  });
  const [groupMatchContext, setGroupMatchContext] = useState<{ groupId: string; matchId: string } | null>(() => {
    const saved = localStorage.getItem("kawera_group_match_context");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem("kawera_groups", JSON.stringify(tournamentGroups));
  }, [tournamentGroups]);
  
  const [newPlayerNameA, setNewPlayerNameA] = useState("");
  const [newPlayerNameB, setNewPlayerNameB] = useState("");
  const [activeFeedTab, setActiveFeedTab] = useState<'feed' | 'momentum' | 'highlights' | 'mvp'>('feed');
  
  const [matchStatus, setMatchStatus] = useState<'setup' | 'active' | 'finished'>(() => {
    return (localStorage.getItem("kawera_match_status") as any) || 'setup';
  });
  const [events, setEvents] = useState<MatchEvent[]>(() => {
    const saved = localStorage.getItem("kawera_events");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  
  // Stopwatch Match state
  const [matchTime, setMatchTime] = useState(() => {
    const saved = localStorage.getItem("kawera_match_time");
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [isTimerRunning, setIsTimerRunning] = useState(() => {
    const running = localStorage.getItem("kawera_timer_running") === "true";
    const status = localStorage.getItem("kawera_match_status") || 'setup';
    return running && status === 'active';
  });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI match insights (structured for dual team or legacy fallback string)
  const [aiInsights, setAiInsights] = useState<{
    matchSummary: string;
    insightsA: string;
    insightsB: string;
    overallMvpName: string;
    overallMvpReason: string;
    overallMvpTeam: string;
  } | string | null>(() => {
    const saved = localStorage.getItem("kawera_ai_insights");
    if (saved) {
      try { 
        return JSON.parse(saved); 
      } catch (e) {
        return saved;
      }
    }
    return null;
  });
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [activeInsightTab, setActiveInsightTab] = useState<'summary' | 'coachA' | 'coachB' | 'mvp'>('summary');

  // Match History States
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>(() => {
    const saved = localStorage.getItem("kawera_match_history");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [viewingHistoryInsights, setViewingHistoryInsights] = useState<MatchHistoryItem | null>(null);
  const [historyModalTab, setHistoryModalTab] = useState<'insights' | 'events' | 'ratings' | 'momentum'>('insights');

  // Offline Sync State
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    const saved = localStorage.getItem("kawera_offline_queue");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Persistence triggers
  useEffect(() => {
    localStorage.setItem("kawera_team_name_a", teamNameA);
  }, [teamNameA]);

  useEffect(() => {
    localStorage.setItem("kawera_team_name_b", teamNameB);
  }, [teamNameB]);

  useEffect(() => {
    localStorage.setItem("kawera_players_a", JSON.stringify(playersA));
  }, [playersA]);

  useEffect(() => {
    localStorage.setItem("kawera_players_b", JSON.stringify(playersB));
  }, [playersB]);

  useEffect(() => {
    localStorage.setItem("kawera_match_status", matchStatus);
  }, [matchStatus]);

  useEffect(() => {
    localStorage.setItem("kawera_events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("kawera_match_time", matchTime.toString());
  }, [matchTime]);

  useEffect(() => {
    localStorage.setItem("kawera_timer_running", isTimerRunning.toString());
  }, [isTimerRunning]);

  useEffect(() => {
    localStorage.setItem("kawera_ai_insights", aiInsights ? JSON.stringify(aiInsights) : "");
  }, [aiInsights]);

  useEffect(() => {
    localStorage.setItem("kawera_offline_queue", JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem("kawera_match_history", JSON.stringify(matchHistory));
  }, [matchHistory]);

  // Online connection monitors
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Offline event queue compiler
  const handleQueueEvent = (type: 'audio' | 'text', data: { text?: string; audioBase64?: string; mimeType?: string }) => {
    const itemId = `offline-${Date.now()}`;
    const stamp = formatTime(matchTime);

    // Initial placeholder timeline element
    const placeholderEvent: MatchEvent = {
      id: `placeholder-${itemId}`,
      timestamp: stamp,
      transcription: data.text || "كلمة صوتية محفوظة أوفلاين (قيد الانتظار لمزامنة الـ AI)",
      explanation: data.text 
        ? `⏳ [معلق] جاري حفظ ومطابقة: "${data.text}"` 
        : "⏳ [معلق] لقطة صوتية محفوظة محلياً وتنتظر تفعيل الاتصال للمزامنة",
      updates: [],
    };
    
    setEvents(prev => [placeholderEvent, ...prev]);

    // Push into queue
    const newItem: OfflineQueueItem = {
      id: itemId,
      timestamp: stamp,
      matchTimeInSeconds: matchTime,
      type,
      textData: data.text,
      audioBase64: data.audioBase64,
      mimeType: data.mimeType,
      recordedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setOfflineQueue(prev => [...prev, newItem]);
  };

  // Synchronizer engine - handles online Gemini APIs and local high-performance fallback
  const triggerAutomaticSync = async (forceQueue?: OfflineQueueItem[]) => {
    const queueToProcess = forceQueue || offlineQueue;
    if (queueToProcess.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);
    let successfullySyncedIds: string[] = [];

    // Snapshot of players to avoid closure gaps
    const currentPlayers = [...playersA, ...playersB];

    for (const item of queueToProcess) {
      try {
        let result;
        if (item.type === 'text' && item.textData) {
          let backendSuccess = false;
          try {
            if (isOnline) {
              const response = await fetch("/api/process-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: item.textData,
                  players: currentPlayers.map(p => p.name)
                })
              });
              if (response.ok) {
                result = await response.json();
                backendSuccess = true;
              }
            }
          } catch (e) {
            console.warn("Failed to process synced text in backend, falling back:", e);
          }

          if (!backendSuccess) {
            result = localTextParser(item.textData, currentPlayers.map(p => p.name));
          }
        } else if (item.type === 'audio' && item.audioBase64) {
          let backendSuccess = false;
          try {
            if (isOnline) {
              const response = await fetch("/api/process-audio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audio: item.audioBase64,
                  mimeType: item.mimeType || "audio/webm",
                  players: currentPlayers.map(p => p.name)
                })
              });
              if (response.ok) {
                result = await response.json();
                backendSuccess = true;
              }
            }
          } catch (e) {
            console.warn("Failed to process synced audio in backend:", e);
          }

          if (!backendSuccess) {
            result = {
              transcription: "[مقطع صوتي محفوظ دقة مفقودة]",
              success: false,
              unmatchedName: "تعذر تفريغ الصوت سحابياً لفشل الاتصال خلال المزامنة",
              events: []
            };
          }
        } else {
          result = {
            transcription: "[بيانات تالفة]",
            success: false,
            unmatchedName: "بيانات تالفة",
            events: []
          };
        }

        const stamp = item.timestamp;

        if (result.success && result.events && result.events.length > 0) {
          const matchEventUpdates: any[] = [];
          result.events.forEach((evt: any) => {
            const p = currentPlayers.find(player => player.name === evt.player);
            if (p) {
              matchEventUpdates.push({
                playerId: p.id,
                playerName: p.name,
                stat: evt.stat,
                change: evt.change
              });
            }
          });

          // Sync individual stats increments for both Team A and Team B
          setPlayersA(prevPlayers => {
            return prevPlayers.map(p => {
              const playerEvts = result.events.filter((evt: any) => evt.player === p.name);
              if (playerEvts.length > 0) {
                const newStats = { ...p.stats };
                playerEvts.forEach((evt: any) => {
                  const statKey = evt.stat as keyof PlayerStats;
                  newStats[statKey] = Math.max(0, (newStats[statKey] || 0) + evt.change);
                });
                return { ...p, stats: newStats };
              }
              return p;
            });
          });

          setPlayersB(prevPlayers => {
            return prevPlayers.map(p => {
              const playerEvts = result.events.filter((evt: any) => evt.player === p.name);
              if (playerEvts.length > 0) {
                const newStats = { ...p.stats };
                playerEvts.forEach((evt: any) => {
                  const statKey = evt.stat as keyof PlayerStats;
                  newStats[statKey] = Math.max(0, (newStats[statKey] || 0) + evt.change);
                });
                return { ...p, stats: newStats };
              }
              return p;
            });
          });

          const combinedExplanation = result.events.map((e: any) => e.explanation).join(" و ");

          // Swap timelines from wait block to processed
          setEvents(prevEvents => {
            const hasPlaceholder = prevEvents.some(ev => ev.id === `placeholder-${item.id}`);
            if (hasPlaceholder) {
              return prevEvents.map(ev => {
                if (ev.id === `placeholder-${item.id}`) {
                  return {
                    id: `event-${Date.now()}-${item.id}`,
                    timestamp: stamp,
                    transcription: result.transcription,
                    explanation: combinedExplanation,
                    updates: matchEventUpdates,
                  };
                }
                return ev;
              });
            } else {
              const newEv: MatchEvent = {
                id: `event-${Date.now()}-${item.id}`,
                timestamp: stamp,
                transcription: result.transcription,
                explanation: combinedExplanation,
                updates: matchEventUpdates,
              };
              return [newEv, ...prevEvents];
            }
          });
        } else {
          // Unmatched or AI couldn't read the text/voice correctly
          setEvents(prevEvents => {
            return prevEvents.map(ev => {
              if (ev.id === `placeholder-${item.id}`) {
                return {
                  id: `event-${Date.now()}-${item.id}`,
                  timestamp: stamp,
                  transcription: result.transcription || item.textData || "صوت مسجل",
                  explanation: result.unmatchedName 
                    ? `⚠️ [لم يطابق الاسم] تم رصد "${result.unmatchedName}" ولكنه ليس مسجلاً في الاسكواد التفاعلي.`
                    : "⚠️ [غير مفهوم] تعذر على الذكاء الاصطناعي استخلاص صيغة إحصائية مفهومة للحدث.",
                  updates: [],
                };
              }
              return ev;
            });
          });
        }

        successfullySyncedIds.push(item.id);
      } catch (err: any) {
        console.error("Error syncing item:", item.id, err);
        setSyncError(`فشل معالجة الحدث المعلق: ${err.message || "خطأ داخلي"}`);
        break; // integrity-first sequence stopper
      }
    }

    if (successfullySyncedIds.length > 0) {
      setOfflineQueue(prev => prev.filter(item => !successfullySyncedIds.includes(item.id)));
    }
    setIsSyncing(false);
  };

  // Sync automatic trigger agent
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && !isSyncing) {
      triggerAutomaticSync();
    }
  }, [isOnline, offlineQueue.length]);

  // Predefined lists to let users start a match instantly!
  const handleLoadDemoPlayers = () => {
    const demoArrayA: Player[] = INITIAL_DEMO_PLAYERS_A.map((name, i) => ({
      id: `player-A-${Date.now()}-${i}`,
      name,
      stats: initialStats(),
    }));
    const demoArrayB: Player[] = INITIAL_DEMO_PLAYERS_B.map((name, i) => ({
      id: `player-B-${Date.now()}-${i}`,
      name,
      stats: initialStats(),
    }));
    setPlayersA(demoArrayA);
    setPlayersB(demoArrayB);
  };

  // Start match & trigger timer
  const handleStartMatch = () => {
    if (!teamNameA.trim() || !teamNameB.trim()) {
      alert("يرجى إدخال أسماء الفريقين أولاً!");
      return;
    }
    if (playersA.length === 0 && playersB.length === 0) {
      alert("يرجى إضافة لاعب واحد على الأقل في أي من الفريقين لبدء المباراة!");
      return;
    }
    setMatchStatus('active');
    setMatchTime(0);
    setIsTimerRunning(true);
    setEvents([]);
  };

  // Handle Stopwatch ticker
  useEffect(() => {
    if (isTimerRunning && matchStatus === 'active') {
      timerIntervalRef.current = setInterval(() => {
        setMatchTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, matchStatus]);

  // Format seconds to match duration MM:SS
  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Add individual player
  const handleAddPlayer = (teamId: 'A' | 'B', nameInputValue: string) => {
    if (!nameInputValue.trim()) return;

    const allPlayersCombined = [...playersA, ...playersB];
    if (allPlayersCombined.some(p => p.name.trim() === nameInputValue.trim())) {
      alert("هذا اللاعب مضاف بالفعل في أحد الفريقين!");
      return;
    }

    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: nameInputValue.trim(),
      stats: initialStats(),
    };

    if (teamId === 'A') {
      setPlayersA(prev => [...prev, newPlayer]);
      setNewPlayerNameA("");
    } else {
      setPlayersB(prev => [...prev, newPlayer]);
      setNewPlayerNameB("");
    }
  };

  // Delete individual player during setup
  const handleDeletePlayer = (teamId: 'A' | 'B', id: string) => {
    if (teamId === 'A') {
      setPlayersA(prev => prev.filter(p => p.id !== id));
    } else {
      setPlayersB(prev => prev.filter(p => p.id !== id));
    }
  };

  // Manual adjust statistic helper from the grid
  const handleUpdateStat = (playerId: string, stat: keyof PlayerStats, change: number) => {
    const isPlayerInA = playersA.some(p => p.id === playerId);
    if (isPlayerInA) {
      setPlayersA(prev => 
        prev.map(p => {
          if (p.id === playerId) {
            const newVal = Math.max(0, (p.stats[stat] || 0) + change);
            return {
              ...p,
              stats: {
                ...p.stats,
                [stat]: newVal
              }
            };
          }
          return p;
        })
      );
    } else {
      setPlayersB(prev => 
        prev.map(p => {
          if (p.id === playerId) {
            const newVal = Math.max(0, (p.stats[stat] || 0) + change);
            return {
              ...p,
              stats: {
                ...p.stats,
                [stat]: newVal
              }
            };
          }
          return p;
        })
      );
    }
  };

  // AI-driven sound event registration
  const handleEventsProcessed = (
    aiEvents: any[], 
    transcription: string, 
    unmatchedName?: string, 
    success?: boolean
  ) => {
    const stamp = formatTime(matchTime);

    // If matches are found
    if (success && aiEvents && aiEvents.length > 0) {
      const matchEventUpdates: any[] = [];

      // Calculate updates first using the current state of players
      aiEvents.forEach(evt => {
        const pA = playersA.find(p => p.name === evt.player);
        const pB = playersB.find(p => p.name === evt.player);
        const p = pA || pB;
        if (p) {
          const statKey = evt.stat as keyof PlayerStats;
          matchEventUpdates.push({
            playerId: p.id,
            playerName: p.name,
            stat: statKey,
            change: evt.change,
            team: pA ? 'A' : 'B'
          });
        }
      });

      // Update the playersA immutably
      setPlayersA(prevPlayers => {
        return prevPlayers.map(p => {
          // Find all events for this player
          const playerEvts = aiEvents.filter(evt => evt.player === p.name);
          if (playerEvts.length > 0) {
            // Create a brand new stats object
            const newStats = { ...p.stats };
            playerEvts.forEach(evt => {
              const statKey = evt.stat as keyof PlayerStats;
              newStats[statKey] = Math.max(0, (newStats[statKey] || 0) + evt.change);
            });
            return {
              ...p,
              stats: newStats
            };
          }
          return p;
        });
      });

      // Update the playersB immutably
      setPlayersB(prevPlayers => {
        return prevPlayers.map(p => {
          // Find all events for this player
          const playerEvts = aiEvents.filter(evt => evt.player === p.name);
          if (playerEvts.length > 0) {
            // Create a brand new stats object
            const newStats = { ...p.stats };
            playerEvts.forEach(evt => {
              const statKey = evt.stat as keyof PlayerStats;
              newStats[statKey] = Math.max(0, (newStats[statKey] || 0) + evt.change);
            });
            return {
              ...p,
              stats: newStats
            };
          }
          return p;
        });
      });

      // Construct Timeline Log
      const combinedExplanation = aiEvents.map(e => e.explanation).join(" و ");
      const newEvent: MatchEvent = {
        id: `event-${Date.now()}`,
        timestamp: stamp,
        transcription,
        explanation: combinedExplanation,
        updates: matchEventUpdates,
      };

      setEvents(prev => [newEvent, ...prev]);
    } else {
      // Unrecognized logging (keeps a log of what was said but marks as red/warning for the user)
      const newEvent: MatchEvent = {
        id: `event-${Date.now()}`,
        timestamp: stamp,
        transcription: transcription || "صوت غير واضح",
        explanation: unmatchedName 
          ? `حاول الذكاء الاصطناعي مطابقة اسم "${unmatchedName}" ولكنه لم يجده قائمة اللعيبة.` 
          : "لم يطابق المساعد الصوتي أي حدث كروي مسجل. يرجى التحدث بوضوح.",
        updates: [],
        rawText: unmatchedName
      };
      setEvents(prev => [newEvent, ...prev]);
    }
  };

  // Delete an event from Timeline and rollback statistics!
  const handleDeleteEvent = (eventId: string) => {
    const targetEvent = events.find(e => e.id === eventId);
    if (!targetEvent) return;

    // Rollback the stats values that this event updated immutably (Team A)
    setPlayersA(prevPlayers => {
      return prevPlayers.map(p => {
        const matchingUpdates = targetEvent.updates.filter(upd => upd.playerId === p.id);
        if (matchingUpdates.length > 0) {
          const newStats = { ...p.stats };
          matchingUpdates.forEach(upd => {
            const statKey = upd.stat as keyof PlayerStats;
            newStats[statKey] = Math.max(0, (newStats[statKey] || 0) - upd.change);
          });
          return {
            ...p,
            stats: newStats
          };
        }
        return p;
      });
    });

    // Rollback the stats values that this event updated immutably (Team B)
    setPlayersB(prevPlayers => {
      return prevPlayers.map(p => {
        const matchingUpdates = targetEvent.updates.filter(upd => upd.playerId === p.id);
        if (matchingUpdates.length > 0) {
          const newStats = { ...p.stats };
          matchingUpdates.forEach(upd => {
            const statKey = upd.stat as keyof PlayerStats;
            newStats[statKey] = Math.max(0, (newStats[statKey] || 0) - upd.change);
          });
          return {
            ...p,
            stats: newStats
          };
        }
        return p;
      });
    });

    // Remove event from timeline
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Calculate MVP crown winner from both teams
  const calculateMVP = (): { name: string; score: number; teamName: string } | null => {
    const combined = [
      ...playersA.map(p => ({ ...p, teamName: teamNameA })),
      ...playersB.map(p => ({ ...p, teamName: teamNameB }))
    ];
    if (combined.length === 0) return null;

    let bestPlayer = combined[0];
    let highestScore = -999;

    combined.forEach(p => {
      const s = p.stats;
      const score = 
        (s.goals * 4) + 
        (s.assists * 3) + 
        (s.def_con * 1.5) + 
        (s.normal_saves * 1.5) + 
        (s.penalty_saves * 3) - 
        (s.penalty_miss * 2) - 
        (s.own_goal * 3) - 
        (s.goal_cons * 1);

      if (score > highestScore) {
        highestScore = score;
        bestPlayer = p;
      }
    });

    return { name: bestPlayer.name, score: highestScore, teamName: bestPlayer.teamName };
  };

  const mvp = calculateMVP();

  // Generate Cairo coach insights using server-side Gemini or fallback to local offline mode
  const handleEndMatch = async () => {
    setIsTimerRunning(false);
    setMatchStatus('finished');
    setIsGeneratingInsights(true);
    setAiInsights(null);
    setInsightsError(null);

    // Compute final details from player rosters and events
    const scoreA = playersA.reduce((sum, p) => sum + p.stats.goals, 0) + playersB.reduce((sum, p) => sum + p.stats.own_goal, 0);
    const scoreB = playersB.reduce((sum, p) => sum + p.stats.goals, 0) + playersA.reduce((sum, p) => sum + p.stats.own_goal, 0);
    const calculatedMvp = calculateMVP();

    const newHistoryItem: MatchHistoryItem = {
      id: "match_" + Date.now(),
      date: new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      teamNameA: teamNameA || "شياطين الجزيرة",
      teamNameB: teamNameB || "عملاقة الهضاب",
      scoreA: scoreA,
      scoreB: scoreB,
      duration: matchTime,
      mvp: calculatedMvp ? { name: calculatedMvp.name, teamName: calculatedMvp.teamName, score: calculatedMvp.score } : null,
      playersA: JSON.parse(JSON.stringify(playersA)),
      playersB: JSON.parse(JSON.stringify(playersB)),
      eventsCount: events.length,
      events: JSON.parse(JSON.stringify(events))
    };

    setMatchHistory(prev => [newHistoryItem, ...prev]);

    // If this match was initiated from the groups dashboard, record the results and update standings automatically!
    if (groupMatchContext) {
      const { groupId, matchId } = groupMatchContext;
      setTournamentGroups(prev => {
        const nextGroups = prev.map(g => {
          if (g.id === groupId) {
            const nextMatches = g.matches.map(m => {
              if (m.id === matchId) {
                return {
                  ...m,
                  scoreA,
                  scoreB,
                  played: true
                };
              }
              return m;
            });
            const newGroup = { ...g, matches: nextMatches };
            return recalculateGroupStandings(newGroup);
          }
          return g;
        });
        return nextGroups;
      });
      // Clear match context
      setGroupMatchContext(null);
      localStorage.removeItem("kawera_group_match_context");
    }

    try {
      if (isOnline) {
        const response = await fetch("/api/generate-insights", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            teamNameA: teamNameA || "شياطين الجزيرة",
            playersA: playersA || [],
            teamNameB: teamNameB || "عملاقة الهضاب",
            playersB: playersB || [],
            events: events.filter(e => e.updates.length > 0)
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data && (data.matchSummary || data.insightsA || data.insightsB)) {
            setAiInsights(data);
            setMatchHistory(prev => prev.map(item => {
              if (item.id === newHistoryItem.id) {
                return { ...item, aiInsightsSummary: data };
              }
              return item;
            }));
            return;
          }
        }
      }

      // Offline or server exception fallback: Generate locally
      const localReport = localGenerateMatchInsightsDual(
        teamNameA || "شياطين الجزيرة",
        playersA || [],
        teamNameB || "عملاقة الهضاب",
        playersB || [],
        events.filter(e => e.updates.length > 0)
      );
      setAiInsights(localReport);
      setMatchHistory(prev => prev.map(item => {
        if (item.id === newHistoryItem.id) {
          return { ...item, aiInsightsSummary: localReport };
        }
        return item;
      }));
    } catch (err: any) {
      console.warn("Server insights generation failed, falling back to local coach analyzer:", err);
      try {
        const localReport = localGenerateMatchInsightsDual(
          teamNameA || "شياطين الجزيرة",
          playersA || [],
          teamNameB || "عملاقة الهضاب",
          playersB || [],
          events.filter(e => e.updates.length > 0)
        );
        setAiInsights(localReport);
        setMatchHistory(prev => prev.map(item => {
          if (item.id === newHistoryItem.id) {
            return { ...item, aiInsightsSummary: localReport };
          }
          return item;
        }));
      } catch (fallbackErr: any) {
        console.error("Extreme Insight fallback error:", fallbackErr);
        setInsightsError("عذراً، حدث خطأ أثناء تحضير تقرير المدرب الحقيقي والمحلي.");
      }
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleStartGroupMatch = (teamAName: string, teamBName: string, groupId: string, matchId: string) => {
    setTeamNameA(teamAName);
    setTeamNameB(teamBName);
    
    // Initialize default structured rosters with clear positions
    const defaultPlayersListA = [
      { id: 'pa1', name: "مهاجم أ (" + teamAName + ")", stats: initialStats() },
      { id: 'pa2', name: "مهاجم ب (" + teamAName + ")", stats: initialStats() },
      { id: 'pa3', name: "وسط (" + teamAName + ")", stats: initialStats() },
      { id: 'pa4', name: "مدافع (" + teamAName + ")", stats: initialStats() },
      { id: 'pa5', name: "حارس (" + teamAName + ")", stats: initialStats() },
    ];
    const defaultPlayersListB = [
      { id: 'pb1', name: "مهاجم أ (" + teamBName + ")", stats: initialStats() },
      { id: 'pb2', name: "مهاجم ب (" + teamBName + ")", stats: initialStats() },
      { id: 'pb3', name: "وسط (" + teamBName + ")", stats: initialStats() },
      { id: 'pb4', name: "مدافع (" + teamBName + ")", stats: initialStats() },
      { id: 'pb5', name: "حارس (" + teamBName + ")", stats: initialStats() },
    ];
    setPlayersA(defaultPlayersListA);
    setPlayersB(defaultPlayersListB);
    setEvents([]);
    setMatchTime(0);
    setIsTimerRunning(false);

    // Save active match group reference
    setGroupMatchContext({ groupId, matchId });
    localStorage.setItem("kawera_group_match_context", JSON.stringify({ groupId, matchId }));

    setMatchStatus('setup'); 
    setCurrentTab('match'); 
  };

  const generateCoachInsightOffscreenElement = (insightsText: string): HTMLDivElement => {
    const tempContainer = document.createElement("div");
    tempContainer.id = "temp-capture-insights-container";
    
    // Fixed positioning at 0, 0 with zero opacity to calculate exact dimensions without rendering black or offscreen blank spots
    tempContainer.style.position = "fixed";
    tempContainer.style.left = "0";
    tempContainer.style.top = "0";
    tempContainer.style.zIndex = "-999999";
    tempContainer.style.opacity = "0";
    tempContainer.style.pointerEvents = "none";
    tempContainer.style.width = "850px";
    tempContainer.style.backgroundColor = "#070707";
    tempContainer.style.color = "#ffffff";
    tempContainer.style.fontFamily = "'Segoe UI', Tahoma, Arial, sans-serif";
    tempContainer.style.padding = "40px";
    tempContainer.style.borderRadius = "24px";
    tempContainer.style.border = "1px solid rgba(16, 185, 129, 0.25)";
    tempContainer.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.6)";
    tempContainer.style.direction = "rtl"; 
    
    const todayString = new Date().toLocaleDateString('ar-EG', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const tName = `${teamNameA || "الفريق الأول"} ضد ${teamNameB || "الفريق الثاني"}`;

    // Parse markdown-like content into premium HTML structure
    const contentHtml = insightsText.split('\n').map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<div style='height: 8px;'></div>";
      
      if (trimmed.startsWith('###')) {
        return `<h4 class="arabic-text" style="font-size: 18px; font-weight: 800; color: #10b981; margin-top: 20px; margin-bottom: 10px; text-align: right; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">${trimmed.replace('###', '').trim()}</h4>`;
      } else if (trimmed.startsWith('##')) {
        return `<h3 class="arabic-text" style="font-size: 22px; font-weight: 900; color: #10b981; margin-top: 28px; margin-bottom: 12px; border-right: 4px solid #10b981; padding-right: 10px; text-align: right; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">${trimmed.replace('##', '').trim()}</h3>`;
      } else if (trimmed.startsWith('**')) {
        return `<p class="arabic-text" style="font-size: 16px; font-weight: bold; color: #f59e0b; margin: 8px 0; text-align: right; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">${trimmed.replace(/\*\*/g, '')}</p>`;
      } else if (trimmed.startsWith('-')) {
        return `<li class="arabic-text" style="list-style-type: none; padding-right: 22px; position: relative; margin: 8px 0; text-align: right; color: #d1d5db; font-weight: 600; font-size: 15px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
          <span style="position: absolute; right: 0; font-size: 11px;">⚽</span>
          ${trimmed.substring(2)}
        </li>`;
      }
      return `<p class="arabic-text" style="font-size: 15px; color: #e5e7eb; margin: 6px 0; padding-bottom: 4px; text-align: right; line-height: 1.7; font-weight: 500; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">${trimmed}</p>`;
    }).join("");

    tempContainer.innerHTML = `
      <style>
        * {
          letter-spacing: 0px !important;
          letter-spacing: normal !important;
        }
        .arabic-text {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif !important;
          letter-spacing: 0px !important;
          letter-spacing: normal !important;
        }
      </style>
      <div style="position: absolute; top: 0; right: 0; width: 300px; height: 300px; background-color: rgba(16, 185, 129, 0.04); border-radius: 50%; filter: blur(80px); pointer-events: none;"></div>
      <div style="position: absolute; bottom: 0; left: 0; width: 250px; height: 250px; background-color: rgba(245, 158, 11, 0.02); border-radius: 50%; filter: blur(80px); pointer-events: none;"></div>

      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2937; padding-bottom: 24px; margin-bottom: 24px; position: relative; z-index: 10; direction: rtl;">
        <div style="text-align: right;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="background-color: #10b981; color: #050505; font-weight: 950; font-size: 10px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">EL-KAWERA AI</span>
            <h1 class="arabic-text" style="font-size: 26px; font-weight: 950; margin: 0; color: #ffffff;">
              تحليل المدير الفني الأسطوري
            </h1>
          </div>
          <p class="arabic-text" style="font-size: 14px; color: #a3a3a3; margin: 0; font-weight: 600;">تحليل فني تكتيكي شامل ومفصل لأداء الفريقين الكرويين</p>
        </div>
        <div style="text-align: left; direction: ltr;">
          <div style="font-size: 12px; font-weight: 950; color: #10b981; margin-bottom: 4px;">COACH BRIEFING</div>
          <div style="font-size: 12px; color: #6b7280; font-weight: 600;">${todayString}</div>
        </div>
      </div>

      <!-- Team Badge -->
      <div style="background-color: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 12px; padding: 12px 20px; margin-bottom: 24px; text-align: right; direction: rtl; position: relative; z-index: 10;">
        <span class="arabic-text" style="color: #9ca3af; font-size: 12px; font-weight: bold;">أطراف اللقاء:</span>
        <span class="arabic-text" style="color: #10b981; font-size: 15px; font-weight: 900; margin-right: 6px;">⚽ ${tName}</span>
      </div>

      <!-- Content -->
      <div style="position: relative; z-index: 10; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right;">
        ${contentHtml}
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 36px; padding-top: 16px; border-top: 1px dashed #1f2937; opacity: 0.8; position: relative; z-index: 10; direction: rtl;">
        <div class="arabic-text" style="font-size: 11px; color: #10b981; font-weight: 800; display: flex; align-items: center; gap: 4px;">
          🏆 منصة الكورة الذكية صوتياً - EL-KAWERA
        </div>
        <div style="font-size: 10px; color: #4b5563; font-family: monospace; letter-spacing: 0.5px;">
          OK-KWR-PRO-EXPORT • STABLE BRIEFING
        </div>
      </div>
    `;

    return tempContainer;
  };

  const handleDownloadCoachInsightImage = async () => {
    if (!aiInsights) return;

    try {
      // Build a beautifully formatted comprehensive report text
      const reportText = typeof aiInsights === "string"
        ? aiInsights
        : `
## 📊 تقرير المباراة الشامل (الملخص العام)
${aiInsights.matchSummary || ""}

## 🛡️ تقرير الأداء الفني لنادي: ${teamNameA}
${aiInsights.insightsA || ""}

## ⚡ تقرير الأداء الفني لنادي: ${teamNameB}
${aiInsights.insightsB || ""}

## 👑 نجم السهرة في الماتش (MVP)
**اللاعب:** ${aiInsights.overallMvpName || ""} (${aiInsights.overallMvpTeam || ""})
**تفسير النجومية:** ${aiInsights.overallMvpReason || ""}
      `.trim();

      // Create off-screen, oklch-free, beautifully styled element
      const tempContainer = generateCoachInsightOffscreenElement(reportText);
      document.body.appendChild(tempContainer);

      // Momentary delay for layout & rendering pipeline
      await new Promise(resolve => setTimeout(resolve, 150));

      const image = await toPng(tempContainer, {
        backgroundColor: "#070707",
        width: 850,
        height: tempContainer.offsetHeight,
        style: {
          position: "relative",
          left: "0",
          top: "0",
          opacity: "1",
          zIndex: "auto",
          transform: "scale(1)",
          transformOrigin: "top left",
        }
      });

      document.body.removeChild(tempContainer);

      const link = document.createElement("a");
      link.download = `AI_Coach_Insight_${teamNameA || "TeamA"}_vs_${teamNameB || "TeamB"}.png`;
      link.href = image;
      link.click();
    } catch (err) {
      console.error("Failed to export coach insights as image:", err);
    }
  };

  // Reset to brand-new setup match
  const handleRestart = (keepPlayers: boolean) => {
    if (offlineQueue.length > 0) {
      const confirmRestart = window.confirm("تنبيه: يوجد أحداث معلقة في طابور المزامنة التلقائية لم يتم رصدها بعد. في حالة البدء مجدداً ستفقد هذه الأحداث نهائياً. هل أنت متأكد من المسح والتصفير؟");
      if (!confirmRestart) return;
    }

    setMatchStatus('setup');
    setMatchTime(0);
    setIsTimerRunning(false);
    setEvents([]);
    setAiInsights(null);
    setOfflineQueue([]);
    setSyncError(null);
    if (!keepPlayers) {
      setPlayersA([]);
      setPlayersB([]);
    } else {
      // Clear statistics for a clean new rematch
      setPlayersA(prev => 
        prev.map(p => ({
          ...p,
          stats: initialStats(),
        }))
      );
      setPlayersB(prev => 
        prev.map(p => ({
          ...p,
          stats: initialStats(),
        }))
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col antialiased relative font-sans p-2.5 sm:p-4 md:p-6" id="bento-match-tracker-app">
      
      {/* Decorative center radial background to look elite */}
      <div 
        className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-0 opacity-[0.05]" 
        style={{ 
          background: `radial-gradient(circle at top, ${
            themeId === 'emerald' ? '#10b981' :
            themeId === 'crimson' ? '#ef4444' :
            themeId === 'royalBlue' ? '#3b82f6' :
            themeId === 'cyan' ? '#06b6d4' : '#f59e0b'
          }, transparent 55%)` 
        }} 
      />

      {/* Header Section matching high-fidelity bento design */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-4 sm:mb-6 bg-neutral-900/40 border border-[#1c1c1c] p-3 sm:p-5 rounded-2xl md:rounded-3xl gap-4 z-10 backdrop-blur-md relative" id="navbar-header">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${activeTheme.bgAccent} rounded-full flex items-center justify-center font-extrabold text-[#050505] text-xl shadow-lg ${activeTheme.glowColor}`}>AI</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black leading-tight tracking-tight text-white flex items-center gap-2">
                Match Tracker Pro <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${activeTheme.badgeColor}`}>الكورة بالـ AI</span>
              </h1>
              {/* Connection Status Beacon */}
              <div className="flex items-center gap-1.5" id="header-connection-beacon">
                {isOnline ? (
                  <span className={`flex items-center gap-1.5 px-3 py-1 ${activeTheme.badgeColor} text-[10px] font-bold rounded-full shadow-sm`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeTheme.bgAccent} animate-pulse`} />
                    متصل بالشبكة
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-400 text-[10px] font-bold rounded-full animate-pulse shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    وضع أوفلاين
                  </span>
                )}
                {offlineQueue.length > 0 && (
                  <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce">
                    {offlineQueue.length} معلّق
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-extrabold mt-0.5">منصة تسجيل وتحليل الإحصائيات الرياضية صوتياً</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {matchStatus === 'active' && (
            <>
              <div className="text-center">
                <p className="text-[10px] uppercase text-neutral-500 font-black tracking-widest">مدة المباراة (DURATION)</p>
                <div className="flex items-center gap-2 mt-0.5" id="stopwatch-ticker">
                  <span className="text-3xl font-mono font-black text-emerald-400">
                    {formatTime(matchTime)}
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
              </div>
              <div className="h-10 w-px bg-neutral-800 hidden md:block"></div>
            </>
          )}

          {matchStatus === 'active' && (
            <button 
              onClick={handleEndMatch}
              className="px-6 py-2.5 bg-red-600/10 border border-red-600/50 text-red-500 rounded-full text-sm font-semibold hover:bg-red-600 hover:text-white transition-all cursor-pointer"
            >
              إنهاء اللقاء
            </button>
          )}
        </div>
      </header>

      {/* Navigation tabs selector */}
      <div className="max-w-7xl w-full mx-auto px-1 sm:px-4 mt-2 mb-1 z-15 flex border-b border-neutral-900 pb-3 gap-3 md:gap-5" style={{ direction: "rtl" }}>
        <button
          onClick={() => setCurrentTab('match')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            currentTab === 'match'
              ? `${activeTheme.badgeLight} text-[#050505] border-transparent scale-102 shadow-md`
              : "bg-neutral-950/45 border-neutral-850 text-neutral-400 hover:text-white hover:border-neutral-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ملعب المباراة المباشرة 🎙️</span>
        </button>

        <button
          onClick={() => setCurrentTab('groups')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
            currentTab === 'groups'
              ? `${activeTheme.badgeLight} text-[#050505] border-transparent scale-102 shadow-md`
              : "bg-neutral-950/45 border-neutral-850 text-neutral-400 hover:text-white hover:border-neutral-800"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>جدول ترتيب المجموعات (4 مجموعات) 🏆</span>
        </button>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-1 sm:px-4 py-3 md:py-10 z-10 flex flex-col gap-5 md:gap-8">
        <AnimatePresence mode="wait">
          
          {currentTab === 'groups' ? (
            <motion.div
              key="groups-dashboard-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full relative z-10"
            >
              <GroupsDashboard
                groups={tournamentGroups}
                onUpdateGroups={setTournamentGroups}
                onStartGroupMatch={handleStartGroupMatch}
                activeTheme={activeTheme}
                currentMatchContext={groupMatchContext}
              />
            </motion.div>
          ) : (
            <>
              {/* ================== SETUP SCREEN ================== */}
              {matchStatus === 'setup' && (
            <motion.div
              key="setup-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-6 relative z-10 w-full"
              id="setup-screen-grid"
            >
              {/* Top Bar: Settings & Themes */}
              <div className="bento-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#1c1c1c] pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <h2 className="text-xl font-extrabold text-white">إعدادات المواجهة والبطولة الثنائية • Teams Setup</h2>
                    </div>
                    <p className="text-xs text-neutral-400 font-extrabold font-sans">اضبط اسم الفريق المستضيف والضيف وجهّز قائمة اللاعبين للمنافسة وحساب الـ MVP</p>
                  </div>
                  
                  <div className="flex items-center gap-2.5">
                    {/* Demo button */}
                    {(playersA.length === 0 || playersB.length === 0) && (
                      <button
                        onClick={handleLoadDemoPlayers}
                        id="load-demo-players-btn"
                        className="text-xs text-amber-500 hover:scale-[1.03] flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 rounded-xl cursor-pointer transition-all border border-amber-500/20 font-black text-right"
                      >
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>اسكواد تجريبي جاهز للفرقتين</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* UI Color Theme Template Selector */}
                <div className="mb-6">
                  <label className="block text-xs text-neutral-400 font-extrabold mb-3 font-sans">اختر قالب تصميم وشكل الواجهة المفضل لديك • App & Table Style</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {THEME_PRESETS.map((t) => {
                      const isSelected = themeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setThemeId(t.id);
                            localStorage.setItem("kawera_theme_id", t.id);
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? `${t.borderAccent} bg-[#0c0c0c] border-[1.5px] scale-[1.03] shadow-lg ${t.glowColor}`
                              : "border-neutral-850 hover:border-neutral-700 bg-[#121212]/30 hover:bg-[#121212]"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full ${t.bgAccent} mb-2 shadow-inner border border-white/10`} />
                          <span className={`text-[10px] text-center font-extrabold pb-0.5 leading-tight ${isSelected ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Match triggers */}
                <div className="border-t border-[#1c1c1c] pt-5">
                  <button
                    onClick={handleStartMatch}
                    id="start-match-trigger"
                    className="w-full bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-[#050505] font-black text-lg py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer"
                  >
                    بدء المباراة والتحليل الفوري للفرقتين ⚽
                  </button>
                  <p className="text-center text-xs text-neutral-500 font-bold mt-2 font-sans">
                    * يجب إدخال اسم الفريقين وتأكيد وجود لاعب واحد على الأقل لبدء اللقاء.
                  </p>
                </div>
              </div>

              {/* Dynamic Symmetric Team Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full" id="teams-configuration-grid">
                
                {/* Team A (Home Team) Layout */}
                <div className="bento-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col min-h-[450px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                    <h3 className="text-base font-black text-white">الفريق الأول (صاحب الأرض) • Team A</h3>
                  </div>

                  {/* Team A Name */}
                  <div className="mb-4">
                    <label className="block text-xs text-neutral-400 font-extrabold mb-1.5 font-sans">اسم الفريق الأول</label>
                    <input
                      type="text"
                      value={teamNameA}
                      onChange={(e) => setTeamNameA(e.target.value)}
                      placeholder="أدخل اسم الفريق الأول (مثال: شياطين الجزيرة)..."
                      className="w-full bg-[#141414] border border-[#262626] text-white rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Add Player to Team A */}
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleAddPlayer('A', newPlayerNameA); }} 
                    className="flex flex-col gap-2 mb-6"
                  >
                    <label className="block text-xs text-neutral-400 font-extrabold mb-1.5 font-sans">تسجيل لاعبين في قائمة الفريق الأول</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPlayerNameA}
                        onChange={(e) => setNewPlayerNameA(e.target.value)}
                        placeholder="اسم اللاعب (أحمد، مصطفى...)"
                        className="flex-1 bg-[#141414] border border-[#262626] text-white rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-500 text-[#050505] font-black px-4 rounded-2xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-lg"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>إضافة</span>
                      </button>
                    </div>
                  </form>

                  {/* Team A Player Roster */}
                  <div className="flex-1 flex flex-col justify-start">
                    <h4 className="text-xs font-extrabold text-neutral-500 mb-2.5 font-sans">قائمة اللاعبين الحالية ({playersA.length})</h4>
                    
                    {playersA.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#262626] rounded-2xl min-h-[150px]">
                        <Users className="w-8 h-8 text-neutral-800 mb-2" />
                        <p className="text-xs text-neutral-400 font-bold font-sans">القائمة حالياً فارغة.</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-[300px] space-y-2 pr-1 custom-scrollbar">
                        <AnimatePresence>
                          {playersA.map((p, index) => (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="bg-[#141414] border border-[#262626] rounded-xl p-3 flex justify-between items-center"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-[10px]">
                                  {index + 1}
                                </span>
                                <span className="text-xs font-black text-neutral-200">{p.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeletePlayer('A', p.id)}
                                className="text-neutral-500 hover:text-red-400 p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                  
                  {playersA.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPlayersA([])}
                      className="text-[11px] text-red-400 hover:underline flex items-center gap-1 mt-4 self-start cursor-pointer transition-all font-sans"
                    >
                      تصفير قائمة الفريق الأول
                    </button>
                  )}
                </div>

                {/* Team B (Away Team) Layout */}
                <div className="bento-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col min-h-[450px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                    <h3 className="text-base font-black text-white">الفريق الثاني (الضيف) • Team B</h3>
                  </div>

                  {/* Team B Name */}
                  <div className="mb-4">
                    <label className="block text-xs text-neutral-400 font-extrabold mb-1.5 font-sans">اسم الفريق الثاني</label>
                    <input
                      type="text"
                      value={teamNameB}
                      onChange={(e) => setTeamNameB(e.target.value)}
                      placeholder="أدخل اسم الفريق الثاني (مثال: عملاقة الهضاب)..."
                      className="w-full bg-[#141414] border border-[#262626] text-white rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Add Player to Team B */}
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleAddPlayer('B', newPlayerNameB); }} 
                    className="flex flex-col gap-2 mb-6"
                  >
                    <label className="block text-xs text-neutral-400 font-extrabold mb-1.5 font-sans">تسجيل لاعبين في قائمة الفريق الثاني</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPlayerNameB}
                        onChange={(e) => setNewPlayerNameB(e.target.value)}
                        placeholder="اسم اللاعب (أحمد، مصطفى...)"
                        className="flex-1 bg-[#141414] border border-[#262626] text-white rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-500 text-[#050505] font-black px-4 rounded-2xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-lg"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>إضافة</span>
                      </button>
                    </div>
                  </form>

                  {/* Team B Player Roster */}
                  <div className="flex-1 flex flex-col justify-start">
                    <h4 className="text-xs font-extrabold text-neutral-500 mb-2.5 font-sans">قائمة اللاعبين الحالية ({playersB.length})</h4>
                    
                    {playersB.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#262626] rounded-2xl min-h-[150px]">
                        <Users className="w-8 h-8 text-neutral-800 mb-2" />
                        <p className="text-xs text-neutral-400 font-bold font-sans">القائمة حالياً فارغة.</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-[300px] space-y-2 pr-1 custom-scrollbar">
                        <AnimatePresence>
                          {playersB.map((p, index) => (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="bg-[#141414] border border-[#262626] rounded-xl p-3 flex justify-between items-center"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-[10px]">
                                  {index + 1}
                                </span>
                                <span className="text-xs font-black text-neutral-200">{p.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeletePlayer('B', p.id)}
                                className="text-neutral-500 hover:text-red-400 p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                  
                  {playersB.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPlayersB([])}
                      className="text-[11px] text-red-400 hover:underline flex items-center gap-1 mt-4 self-start cursor-pointer transition-all font-sans"
                    >
                      تصفير قائمة الفريق الثاني
                    </button>
                  )}
                </div>

              </div>

              {/* MATCH HISTORY ARTIFACTS SECTION */}
              <div className="bg-[#0f0f0f] border border-neutral-900 rounded-2xl md:rounded-[2.5rem] p-4 sm:p-7 relative overflow-hidden shadow-xl mt-6 animate-fade-in" id="match-history-card">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-neutral-900 pb-4 mb-4" style={{ direction: "rtl" }}>
                  <div className="flex items-center gap-2">
                    <History className={`w-5 h-5 ${activeTheme.textAccent}`} />
                    <h3 className="font-extrabold text-white text-base font-sans">سجل وأرشيف المباريات الكروية الملعوبة ({matchHistory.length})</h3>
                  </div>
                  {matchHistory.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("هل أنت متأكد من مسح جميع المباريات المؤرشفة؟ لا يمكن التراجع عن هذا الإجراء.")) {
                          setMatchHistory([]);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer font-bold font-sans"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح السجل بالكامل</span>
                    </button>
                  )}
                </div>

                {matchHistory.length === 0 ? (
                  <div className="text-center py-12" style={{ direction: "rtl" }}>
                    <Calendar className="w-12 h-12 text-neutral-800 mx-auto mb-3" />
                    <p className="text-xs text-neutral-400 font-bold max-w-md mx-auto leading-relaxed font-sans">
                      لا يوجد أي مباريات ملعوبة مسبقاً في السجل حتى الآن. ابدأ مباراة جديدة، وعند إنهائها، ستظهر تفاصيلها الدقيقة والمدونة هنا تلقائياً!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" style={{ direction: "rtl" }}>
                    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                      {matchHistory.map((item) => {
                        const isA_Winner = item.scoreA > item.scoreB;
                        const isB_Winner = item.scoreB > item.scoreA;
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => {
                              setViewingHistoryInsights(item);
                              setHistoryModalTab('insights');
                            }}
                            className="bg-[#141414] border border-[#262626] hover:border-neutral-500 hover:bg-[#181818] transition-all rounded-2xl p-4 flex flex-col gap-3 group relative cursor-pointer select-none"
                          >
                            {/* Date, duration, event count */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-400 font-sans">
                              <span className="font-bold">{item.date}</span>
                              <div className="flex items-center gap-3">
                                <span className={`font-mono px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-950 font-black text-[9px] ${activeTheme.textAccent}`}>
                                  ⏱️ {formatTime(item.duration)}
                                </span>
                                <span className="font-sans px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-950 text-neutral-400 font-bold">
                                  📊 {item.eventsCount} حدث
                                </span>
                              </div>
                            </div>

                            {/* Scores detail row */}
                            <div className="flex items-center justify-between gap-4 mt-2 border-t border-neutral-900 pt-3">
                              {/* Team A score */}
                              <div className="flex-1 flex items-center gap-3">
                                <div className="w-[34px] h-[34px] rounded-lg bg-neutral-950 flex items-center justify-center font-bold text-lg font-mono text-white border border-neutral-900 shadow-inner">
                                  {item.scoreA}
                                </div>
                                <span className={`text-xs font-black truncate ${isA_Winner ? 'text-emerald-400 font-extrabold' : 'text-neutral-300'}`}>
                                  {item.teamNameA}
                                </span>
                              </div>

                              <span className="text-neutral-600 font-extrabold text-[10px] uppercase font-mono px-1">ضد</span>

                              {/* Team B score */}
                              <div className="flex-1 flex items-center justify-end gap-3">
                                <span className={`text-xs font-black truncate text-left ${isB_Winner ? 'text-amber-400 font-extrabold' : 'text-neutral-300'}`}>
                                  {item.teamNameB}
                                </span>
                                <div className="w-[34px] h-[34px] rounded-lg bg-neutral-950 flex items-center justify-center font-bold text-lg font-mono text-white border border-neutral-900 shadow-inner">
                                  {item.scoreB}
                                </div>
                              </div>
                            </div>

                            {/* MVP Tag / Details and Action button */}
                            <div className="flex items-center justify-between gap-4 border-t border-neutral-900/60 pt-2.5 mt-1 text-[11px] font-sans">
                              <div className="flex items-center gap-1.5 text-neutral-400 shrink-0">
                                {item.mvp ? (
                                  <>
                                    <Award className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                    <span>أفضل لاعب: <strong className="text-amber-400 font-black">{item.mvp.name}</strong> ({item.mvp.teamName})</span>
                                  </>
                                ) : (
                                  <span>لا يوجد MVP مسجل</span>
                                )}
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingHistoryInsights(item);
                                  setHistoryModalTab('insights');
                                }}
                                className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-white flex items-center gap-1 transition-all group-hover:${activeTheme.borderAccent} cursor-pointer`}
                              >
                                <span>عرض تفاصيل اللقاء الكاملة</span>
                                <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* ================== ACTIVE MATCH SCREEN ================== */}
          {matchStatus === 'active' && (
            <motion.div
              key="match-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-6 relative z-10"
              id="match-screen-container"
            >
              
              {/* Match overview widget */}
              <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden" id="match-status-widget">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20" style={{ backgroundColor: themeId === 'emerald' ? '#10b981' : themeId === 'crimson' ? '#ef4444' : themeId === 'royalBlue' ? '#3b82f6' : themeId === 'cyan' ? '#06b6d4' : '#f59e0b' }} />
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${activeTheme.badgeColor} flex items-center justify-center text-xl`}>
                    ⚽
                  </div>
                  <div>
                    <span className={`text-[10px] ${activeTheme.textAccent} font-black block uppercase tracking-wider`}>مباراة جارية الآن • LIVE TRACKING</span>
                    <h2 className="text-xl font-black text-white">{teamNameA || "الفريق الأول"} ضد {teamNameB || "الفريق الثاني"}</h2>
                  </div>
                </div>

                {/* Match stopwatch control center */}
                <div className="flex items-center gap-3 bg-[#141414] border border-[#262626] rounded-2xl p-2.5 self-start md:self-auto" id="timer-control-center">
                  <button
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      isTimerRunning 
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20" 
                        : `${activeTheme.bgAccent} text-[#050505] font-extrabold ${activeTheme.hoverAccent}`
                    }`}
                  >
                    {isTimerRunning ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>إيقاف مؤقت</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>استئناف</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setMatchTime(0)}
                    className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-xl transition-all cursor-pointer border border-neutral-700"
                    title="تصفير الوقت"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* End match button */}
                <button
                  onClick={handleEndMatch}
                  className="bg-amber-500 text-[#050505] hover:bg-amber-400 font-black px-6 py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-transform cursor-pointer"
                  id="end-match-btn"
                >
                  <Trophy className="w-4 h-4" />
                  <span>إنهاء المباراة والتقرير الختامي</span>
                </button>
              </div>

              {/* Dynamic Grid: Recorder + Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="match-live-grid">
                
                {/* Right/Major Panel: Stats sheet & layout grid */}
                <div className="lg:col-span-2 flex flex-col gap-6" id="match-interactive-stats">
                  
                  {/* AI sound recorder module */}
                  <AudioRecorder
                    players={[...playersA.map(p => p.name), ...playersB.map(p => p.name)]}
                    onEventsProcessed={handleEventsProcessed}
                    activeMatch={matchStatus === 'active'}
                    isOnline={isOnline}
                    onQueueOfflineEvent={handleQueueEvent}
                    textAccent={activeTheme.textAccent}
                    bgAccent={activeTheme.bgAccent}
                    hoverAccent={activeTheme.hoverAccent}
                    badgeColor={activeTheme.badgeColor}
                    badgeLight={activeTheme.badgeLight}
                    iconColor={activeTheme.iconColor}
                    inputFocus={activeTheme.inputFocus}
                    buttonShadow={activeTheme.buttonShadow}
                  />

                  {/* Stats table for Team A */}
                  <StatsTable 
                    players={playersA} 
                    onUpdateStat={handleUpdateStat} 
                    teamName={teamNameA}
                    textAccent={activeTheme.textAccent}
                    bgAccent={activeTheme.bgAccent}
                    hoverAccent={activeTheme.hoverAccent}
                    borderAccent={activeTheme.borderAccent}
                    badgeColor={activeTheme.badgeColor}
                    badgeLight={activeTheme.badgeLight}
                    iconColor={activeTheme.iconColor}
                  />

                  {/* Stats table for Team B */}
                  <StatsTable 
                    players={playersB} 
                    onUpdateStat={handleUpdateStat} 
                    teamName={teamNameB}
                    textAccent={activeTheme.textAccent}
                    bgAccent={activeTheme.bgAccent}
                    hoverAccent={activeTheme.hoverAccent}
                    borderAccent={activeTheme.borderAccent}
                    badgeColor={activeTheme.badgeColor}
                    badgeLight={activeTheme.badgeLight}
                    iconColor={activeTheme.iconColor}
                  />
                  
                </div>

                {/* Left Panel: Real-time Timeline Feed */}
                <div className="lg:col-span-1 flex flex-col gap-6" id="match-timeline-feed">
                  
                  {/* Offline Pending Items Sync Card */}
                  {offlineQueue.length > 0 && (
                    <div className="bento-card bg-gradient-to-br from-[#120a00] to-[#0f0f0f] border border-amber-500/30 p-4 sm:p-5 rounded-2xl md:rounded-3xl shadow-xl flex flex-col gap-3 relative overflow-hidden" id="offline-sync-queue-card">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex justify-between items-center border-b border-amber-500/10 pb-2.5">
                        <div className="flex items-center gap-2 text-amber-500">
                          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                          <h3 className="font-extrabold text-[12px] sm:text-xs tracking-wide">طابور المزامنة التلقائية ({offlineQueue.length})</h3>
                        </div>
                        {isOnline ? (
                          <button
                            onClick={() => triggerAutomaticSync()}
                            disabled={isSyncing}
                            className="bg-amber-550 bg-amber-500 text-black font-extrabold text-[10px] px-2.5 py-1 rounded-lg hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isSyncing ? "جاري الرفع..." : "زامن الآن 🔄"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-500 font-extrabold opacity-60">بانتظار اﻹنترنت للرفع...</span>
                        )}
                      </div>

                      {syncError && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold space-y-2">
                          <p>{syncError}</p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (offlineQueue.length > 0) {
                                  const [first, ...rest] = offlineQueue;
                                  setOfflineQueue(rest);
                                  setSyncError(null);
                                  setEvents(prev => prev.filter(ev => ev.id !== `placeholder-${first.id}`));
                                }
                              }}
                              className="bg-red-500 text-white font-black text-[9px] px-2 py-1 rounded-md cursor-pointer hover:bg-red-400 transition"
                            >
                              تخطي هذا الحدث المعلق ⚠️
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOfflineQueue([]);
                                setSyncError(null);
                                setEvents(prev => prev.filter(ev => !ev.id.startsWith("placeholder-")));
                              }}
                              className="bg-neutral-800 text-neutral-300 font-extrabold text-[9px] px-2 py-1 rounded-md cursor-pointer hover:bg-neutral-700 transition"
                            >
                              مسح كل الانتظار 🧹
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="max-h-[160px] overflow-y-auto space-y-2 custom-scrollbar pr-0.5" id="offline-queue-rows">
                        {offlineQueue.map((item) => (
                          <div key={item.id} className="bg-black/40 border border-[#1a1a1a] rounded-xl p-2.5 flex items-center justify-between text-xs font-semibold gap-2">
                            <div className="flex flex-col gap-0.5 text-right w-full">
                              <span className="text-[9px] text-neutral-500 font-bold">⏱️ دقيقة الحدث {item.timestamp} • سجل في {item.recordedAt}</span>
                              <p className="text-gray-300 font-bold leading-tight">
                                {item.type === 'text' ? `📝 نص: "${item.textData}"` : "🎤 لقطة صوتية محفوظة أوفلاين"}
                              </p>
                            </div>
                            <span className="shrink-0 flex items-center bg-amber-500/10 text-amber-500 border border-amber-500/25 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                              {isSyncing ? "جاري..." : "معلق"}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] text-neutral-500 font-medium leading-normal text-right">
                        💡 سيتم معالجة الحدث ومزامنة الإحصائيات بالذكاء الاصطناعي تلقائياً عندما يتوفر اتصال اﻹنترنت!
                      </p>
                    </div>
                  )}

                  <div className="bento-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl md:rounded-[2.5rem] p-4 sm:p-5 shadow-xl flex-1 flex flex-col min-h-[420px]">
                    {/* Multi-Tab visual switcher headers */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-950 rounded-2xl border border-neutral-900 mb-5">
                      <button
                        type="button"
                        onClick={() => setActiveFeedTab('feed')}
                        className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          activeFeedTab === 'feed'
                            ? `${activeTheme.badgeLight} text-[#050505] font-black`
                            : "text-neutral-500 hover:text-white"
                        }`}
                      >
                        الأحداث Live
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFeedTab('momentum')}
                        className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          activeFeedTab === 'momentum'
                            ? `${activeTheme.badgeLight} text-[#050505] font-black`
                            : "text-neutral-500 hover:text-white"
                        }`}
                      >
                        الزخم 📊
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFeedTab('highlights')}
                        className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          activeFeedTab === 'highlights'
                            ? `${activeTheme.badgeLight} text-[#050505] font-black`
                            : "text-neutral-500 hover:text-white"
                        }`}
                      >
                        الملخص 🌟
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFeedTab('mvp')}
                        className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          activeFeedTab === 'mvp'
                            ? `${activeTheme.badgeLight} text-[#050505] font-black`
                            : "text-neutral-500 hover:text-white"
                        }`}
                      >
                        الـ MVP 🏆
                      </button>
                    </div>

                    {/* RENDERING TABS */}
                    {activeFeedTab === 'feed' && (
                      <div className="flex-1 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-neutral-900/60">
                          <span className="text-[10px] text-neutral-400 font-extrabold">البث الحي الكامل للأحداث</span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono font-bold">
                            {events.length} أحداث
                          </span>
                        </div>

                        {events.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500" id="empty-timeline-state">
                            <Volume2 className="w-12 h-12 text-neutral-800 mb-2 animate-pulse" />
                            <p className="text-sm">لم يسجل أي حدث حتى الآن.</p>
                            <p className="text-xs text-neutral-600 max-w-xs mt-1.5 leading-relaxed">
                              ابدأ بتسجيل تعليقك الصوتي لتتم مطابقة البيانات بالـ AI فوراً!
                            </p>
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-1 custom-scrollbar" id="timeline-scroll-area">
                            <AnimatePresence>
                              {events.map((ev) => {
                                const hasUpdates = ev.updates && ev.updates.length > 0;
                                return (
                                  <motion.div
                                    key={ev.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`border rounded-[1.5rem] p-4 text-sm relative transition-colors ${
                                      hasUpdates 
                                        ? `bg-[#141414] border-[#262626] hover:${activeTheme.borderAccent}` 
                                        : "bg-red-500/5 border-red-500/10 text-red-200"
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-1 mb-2">
                                      {/* Timestamp */}
                                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg font-mono ${activeTheme.badgeColor}`}>
                                        {ev.timestamp}
                                      </span>
                                      {/* Deletion trigger */}
                                      <button
                                        onClick={() => {
                                          if (confirm("هل تريد إلغاء هذا الحدث والتراجع عن نقاط الإحصائيات لجميع اللاعبين المرتبطين به؟")) {
                                            handleDeleteEvent(ev.id);
                                          }
                                        }}
                                        className="text-neutral-500 hover:text-red-450 p-1 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                        title="حذف وتراجع عن النقاط"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    <p className="font-bold text-gray-200 mb-1 leading-relaxed text-right">
                                      {ev.explanation}
                                    </p>

                                    <div className="text-[10px] text-gray-400 border-t border-neutral-900/60 pt-2 mt-2 italic flex flex-col gap-0.5 text-right">
                                      <span>نص التعليق: "{ev.transcription}"</span>
                                      {hasUpdates && (
                                        <span className={`${activeTheme.textAccent} font-bold not-italic font-sans mt-0.5`}>
                                          ✓ تم المطابقة التلقائية وزيادة إحصائيات اللاعبين بنجاح!
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    )}

                    {activeFeedTab === 'momentum' && (
                      <div className="flex-1 flex flex-col justify-start h-full text-right animate-fade-in">
                        {(() => {
                          const points = calculateMatchMomentum(events);
                          const width = 320;
                          const height = 120;
                          const padding = 15;
                          const centerY = height / 2;
                          
                          // Calculate step width
                          const step = (width - padding * 2) / Math.max(1, points.length - 1);
                          const maxVal = Math.max(...points.map(p => Math.abs(p.val)), 4);
                          const scale = (height / 2 - padding) / maxVal;

                          return (
                            <div className="flex flex-col gap-4">
                              <div className="flex justify-between items-center text-[10px] text-neutral-400 font-bold px-1 select-none">
                                <span className="text-emerald-400">▲ ضغط {teamNameA || "المستضيف"}</span>
                                <span className="text-neutral-500 font-mono font-black">الزخم (MOMENTUM)</span>
                                <span className="text-red-400">▼ ضغط {teamNameB || "الضيف"}</span>
                              </div>

                              <div className="relative bg-[#070707] p-3 rounded-2xl border border-neutral-900 overflow-hidden">
                                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[110px] overflow-visible">
                                  {/* Central baseline */}
                                  <line
                                    x1={padding}
                                    y1={centerY}
                                    x2={width - padding}
                                    y2={centerY}
                                    stroke="#1e1e1e"
                                    strokeWidth="1.5"
                                    strokeDasharray="4,4"
                                  />

                                  {/* Draw bars */}
                                  {points.map((p, idx) => {
                                    const x = padding + idx * step;
                                    const barHeight = p.val * scale;
                                    const color = p.val >= 0 ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)";
                                    return (
                                      <g key={idx}>
                                        <line
                                          x1={x}
                                          y1={centerY}
                                          x2={x}
                                          y2={centerY - barHeight}
                                          stroke={color}
                                          strokeWidth="3.5"
                                          strokeLinecap="round"
                                          className="transition-all duration-300"
                                        />
                                        <circle
                                          cx={x}
                                          cy={centerY - barHeight}
                                          r="2"
                                          fill={color}
                                        />
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>

                              <div className="bg-[#141414]/30 border border-neutral-900 rounded-xl p-3">
                                <span className="text-[10px] text-neutral-500 font-extrabold flex items-center gap-1">📊 قراءة منحنى الضغط والتحولات الهجومية:</span>
                                <p className="text-[11px] text-neutral-400 leading-relaxed font-sans mt-1">
                                  يقوم حاسوب El-Kawera بحساب فترات الهجوم الضاغط والسيطرة في الثلث الأخير بناءً على الإحصائيات الفعالة (تسديدات، انقاذ ركلات، دفاع ناجح) ليعكس واقع تدفق وإثارة المباراة!
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeFeedTab === 'highlights' && (
                      <div className="flex-1 flex flex-col justify-start h-full text-right animate-fade-in">
                        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-neutral-900">
                          <span className="text-[10px] text-white font-extrabold">لقطات اللقاء والأهداف الكبرى ✨</span>
                        </div>

                        {events.filter(e => {
                          if (!e.updates) return false;
                          return e.updates.some(u => ["goals", "own_goal", "penalty_saves", "penalty_miss"].includes(u.stat));
                        }).length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                            <Sparkles className="w-10 h-10 text-neutral-800 mb-2 animate-pulse" />
                            <p className="text-xs">لم تسجل أي لحظات كبرى (أهداف أو ضربات حاسمة) حتى الآن.</p>
                          </div>
                        ) : (
                          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1 custom-scrollbar">
                            {events
                              .filter(e => {
                                if (!e.updates) return false;
                                return e.updates.some(u => ["goals", "own_goal", "penalty_saves", "penalty_miss"].includes(u.stat));
                              })
                              .map((ev) => (
                                <div key={ev.id} className="p-3 bg-neutral-950 border border-neutral-900 rounded-2xl flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-extrabold font-mono text-xs flex items-center justify-center shrink-0 border border-emerald-500/20">
                                    {ev.timestamp}
                                  </div>
                                  <div className="text-right flex-1 truncate">
                                    <p className="text-xs font-black text-white truncate">{ev.explanation}</p>
                                    <span className="text-[9px] text-neutral-500 italic block mt-0.5">الملخص الرسمي للمباراة</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeFeedTab === 'mvp' && (
                      <div className="flex-1 flex flex-col justify-start h-full text-right animate-fade-in">
                        {(() => {
                          const currentMvp = calculateMVP();
                          if (!currentMvp || currentMvp.score === -999) {
                            return (
                              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                                <Crown className="w-10 h-10 text-neutral-800 mb-2 animate-bounce" />
                                <p className="text-xs">لم يتم احتساب نجم اللقاء بعد.</p>
                                <p className="text-[10px] text-neutral-600 mt-1 max-w-xs leading-normal">
                                  سيبدأ نظام MVP الرياضي بحساب الأداء العام ونقاط التقييم حال حدوث أهداف أو انقاذ ركلات أو محاولات ناجحة!
                                </p>
                              </div>
                            );
                          }

                          const ratingVal = Math.max(3.0, Math.min(10.0, 6.0 + currentMvp.score / 3.5));
                          const colorClasses = getRatingColorClass(ratingVal);
                          
                          return (
                            <div className="flex flex-col gap-4">
                              <div className="bg-gradient-to-br from-[#121212] to-[#070707] border border-neutral-850 p-4 rounded-3xl relative overflow-hidden flex items-center gap-4.5">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                                
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                                  <Crown className="w-7 h-7 text-amber-500 animate-pulse" />
                                </div>

                                <div className="text-right flex-1 truncate">
                                  <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/15">
                                    🏆 نَجْمُ اللِّقَاءِ الحَقِيْقِي (LIVE MVP)
                                  </span>
                                  <h4 className="text-base font-black text-white mt-2 truncate">{currentMvp.name}</h4>
                                  <p className="text-[10px] text-neutral-500 font-semibold mt-0.5">{currentMvp.teamName}</p>
                                </div>

                                <div className="flex flex-col items-center gap-1 text-center shrink-0">
                                  <span className={`text-base px-2.5 py-1 rounded-xl font-mono font-black border ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border}`}>
                                    {ratingVal.toFixed(1)}
                                  </span>
                                  <span className="text-[8px] text-neutral-500 font-black">Sofa Rating</span>
                                </div>
                              </div>

                              <div className="border border-neutral-900 rounded-2xl p-4 bg-[#0a0a0a]/50 text-right space-y-2">
                                <span className="text-[10px] font-bold text-neutral-400 block pb-1 border-b border-neutral-900">⚡ المؤشرات المقاسة لأداء النجم:</span>
                                <ul className="text-[11px] text-neutral-400 space-y-1.5 leading-relaxed font-sans">
                                  <li className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <span>النقاط الإجمالية المكتسبة: <span className="font-mono font-bold text-amber-400">{currentMvp.score.toFixed(1)}pt</span></span>
                                  </li>
                                  <li className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>اللاعب الأكثر تأثيراً على مجريات اللعب واللمسات الحاسمة.</span>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

              </div>
              
            </motion.div>
          )}

          {/* ================== POST MATCH REPORT SCREEN ================== */}
          {matchStatus === 'finished' && (
            <motion.div
              key="finished-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-6"
              id="finished-screen-wrapper"
            >
              
              {/* Celebrate header */}
              <div className={`bg-gradient-to-r from-[#0f0f0f] to-[#141414] border ${activeTheme.borderAccent} rounded-2xl md:rounded-[2.5rem] p-5 sm:p-8 text-center relative overflow-hidden shadow-2xl animate-fade-in`} id="finished-match-banner">
                <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none opacity-20" style={{ background: `radial-gradient(circle at center, ${themeId === 'emerald' ? '#10b981' : themeId === 'crimson' ? '#ef4444' : themeId === 'royalBlue' ? '#3b82f6' : themeId === 'cyan' ? '#06b6d4' : '#f59e0b'}, transparent)` }} />
                
                <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-3 animate-bounce" />
                <h2 className="text-3xl font-black text-white tracking-wide">اكتملت المباراة بنجاح 🏆</h2>
                <p className={`text-sm ${activeTheme.textAccent} font-bold mt-1.5`}>الحمد لله! قمت بإدارة اللقاء ببراعة تامة وسجلت كافة التحركات.</p>
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => handleRestart(true)}
                    className={`${activeTheme.bgAccent} ${activeTheme.hoverAccent} text-[#050505] font-black px-6 py-3.5 rounded-2xl text-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg ${activeTheme.glowColor}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة نفس اللقاء ( rematch )</span>
                  </button>
                  <button
                    onClick={() => handleRestart(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-750 text-white font-bold px-6 py-3.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>ماتش جديد بالكامل</span>
                  </button>
                </div>
              </div>

              {/* GRAND FINAL SCOREBOARD CARD */}
              <div className="bg-[#0c0c0c] border border-neutral-900 rounded-2xl md:rounded-[2.5rem] p-6 text-center relative overflow-hidden shadow-2xl" id="final-scoreboard-card">
                <div className="absolute inset-0 bg-gradient-to-b from-[#10b981]/5 to-transparent pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto relative z-10" style={{ direction: "rtl" }}>
                  
                  {/* Team A stats summary */}
                  {(() => {
                    const scorersListA = [
                      ...playersA.filter(p => p.stats.goals > 0).map(p => ({
                        name: p.name,
                        goals: p.stats.goals,
                        type: "normal"
                      })),
                      ...playersB.filter(p => p.stats.own_goal > 0).map(p => ({
                        name: p.name,
                        goals: p.stats.own_goal,
                        type: "own"
                      }))
                    ];

                    return (
                      <div className="flex-1 flex flex-col items-center sm:items-end text-center sm:text-right w-full sm:w-auto">
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1 font-sans">الفريق الأول (صاحب الأرض)</span>
                        <h3 className="text-xl sm:text-2xl font-black text-white">{teamNameA || "الفريق الأول"}</h3>
                        <div className="mt-2.5 w-full flex flex-col items-center sm:items-end gap-1">
                          <span className="text-[10px] text-neutral-400 font-black block">مسجلو الأهداف ⚽:</span>
                          {scorersListA.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-center sm:justify-end">
                              {scorersListA.map((scorer, i) => (
                                <span 
                                  key={i} 
                                  className="text-[11px] bg-[#10b981]/15 border border-[#10b981]/30 px-2 py-0.5 rounded-lg text-white font-semibold flex items-center gap-1 shrink-0"
                                >
                                  <span>⚽ {scorer.name}</span>
                                  {scorer.goals > 1 && <span className="font-extrabold text-emerald-400">({scorer.goals})</span>}
                                  {scorer.type === "own" && <span className="text-[8px] text-red-500 font-black bg-red-400/15 px-1 py-0.2 rounded font-sans">(عكسي)</span>}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-500 italic font-medium">لا يوجد مسجلي أهداف للمباراة 🚫</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Gigantic Score numbers */}
                  <div className="flex items-center gap-4 sm:gap-7 my-2 sm:my-0">
                    <div className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] rounded-2xl sm:rounded-3xl bg-neutral-950 border border-neutral-900 flex items-center justify-center text-3xl sm:text-5xl font-black text-emerald-400 font-mono shadow-inner border-b-2 border-emerald-500/50">
                      {playersA.reduce((sum, p) => sum + p.stats.goals, 0) + playersB.reduce((sum, p) => sum + p.stats.own_goal, 0)}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 mb-1 animate-pulse">صافرة النهاية 🏆</span>
                      <span className="text-xs text-neutral-500 font-bold">النتيجة النهائية</span>
                    </div>
                    <div className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] rounded-2xl sm:rounded-3xl bg-neutral-950 border border-neutral-900 flex items-center justify-center text-3xl sm:text-5xl font-black text-amber-400 font-mono shadow-inner border-b-2 border-amber-500/50">
                      {playersB.reduce((sum, p) => sum + p.stats.goals, 0) + playersA.reduce((sum, p) => sum + p.stats.own_goal, 0)}
                    </div>
                  </div>

                  {/* Team B stats summary */}
                  {(() => {
                    const scorersListB = [
                      ...playersB.filter(p => p.stats.goals > 0).map(p => ({
                        name: p.name,
                        goals: p.stats.goals,
                        type: "normal"
                      })),
                      ...playersA.filter(p => p.stats.own_goal > 0).map(p => ({
                        name: p.name,
                        goals: p.stats.own_goal,
                        type: "own"
                      }))
                    ];

                    return (
                      <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1 font-sans">الفريق الثاني (الضيف)</span>
                        <h3 className="text-xl sm:text-2xl font-black text-white">{teamNameB || "الفريق الثاني"}</h3>
                        <div className="mt-2.5 w-full flex flex-col items-center sm:items-start gap-1">
                          <span className="text-[10px] text-neutral-400 font-black block">مسجلو الأهداف ⚽:</span>
                          {scorersListB.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                              {scorersListB.map((scorer, i) => (
                                <span 
                                  key={i} 
                                  className="text-[11px] bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-lg text-white font-semibold flex items-center gap-1 shrink-0"
                                >
                                  <span>⚽ {scorer.name}</span>
                                  {scorer.goals > 1 && <span className="font-extrabold text-amber-400">({scorer.goals})</span>}
                                  {scorer.type === "own" && <span className="text-[8px] text-red-500 font-black bg-red-400/15 px-1 py-0.2 rounded font-sans">(عكسي)</span>}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-500 italic font-medium">لا يوجد مسجلي أهداف للمباراة 🚫</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>

              {/* MVP block and team stats grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="finished-stats-grid">
                
                {/* MVP card picker */}
                <div className="bento-card bg-[#0f0f0f] border border-amber-500/30 p-4 sm:p-6 rounded-2xl md:rounded-[2.5rem] shadow-xl flex flex-col justify-center items-center text-center relative overflow-hidden" id="mvp-award-card">
                  <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    <Award className="w-3.5 h-3.5" />
                    <span>رجل المباراة MVP</span>
                  </div>

                  {mvp ? (
                    <>
                      <div className="relative mb-4 mt-4">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-amber-500 rotate-[10deg] animate-pulse">
                          <Crown className="w-8 h-8 fill-amber-500" />
                        </div>
                        <div className="w-20 h-20 rounded-full bg-amber-500/10 border-4 border-amber-500 flex items-center justify-center text-3xl font-bold shadow-lg shadow-amber-500/10">
                          🏅
                        </div>
                      </div>
                      <h3 className="text-xl font-black text-white">{mvp.name}</h3>
                      <p className="text-xs text-amber-500 font-bold mt-1">فريق {mvp.teamName || "المنافس"}</p>
                      <p className="text-[10px] text-neutral-400 font-bold mt-0.5">توج بجائزة أفضل لاعب بناءً على الإسهامات الكروية!</p>
                      
                      <div className="w-full mt-5 bg-black/40 border border-[#1c1c1c] p-4 rounded-2xl text-xs text-right space-y-2 text-gray-300">
                        {[...playersA, ...playersB].find(p => p.name === mvp.name) && (
                          <>
                            <div className="flex justify-between items-center">
                              <span>الأهداف المسجلة:</span>
                              <span className={`font-mono font-bold ${activeTheme.textAccent}`}>{[...playersA, ...playersB].find(p => p.name === mvp.name)?.stats.goals || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>تمريرات حاسمة (أسيست):</span>
                              <span className={`font-mono font-bold ${activeTheme.textAccent}`}>{[...playersA, ...playersB].find(p => p.name === mvp.name)?.stats.assists || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>افتكاك تشتيت (دفاع):</span>
                              <span className={`font-mono font-bold ${activeTheme.textAccent}`}>{[...playersA, ...playersB].find(p => p.name === mvp.name)?.stats.def_con || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>تصديات حارس المرمى:</span>
                              <span className={`font-mono font-bold ${activeTheme.textAccent}`}>{[...playersA, ...playersB].find(p => p.name === mvp.name)?.stats.normal_saves || 0}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-400">لا يوجد لاعب لحساب رجل المباراة.</p>
                  )}
                </div>

                {/* Team Side-by-Side Statistics Comparison */}
                {(() => {
                  const goalsA = playersA.reduce((sum, p) => sum + p.stats.goals, 0);
                  const goalsB = playersB.reduce((sum, p) => sum + p.stats.goals, 0);
                  const ownGoalsA = playersA.reduce((sum, p) => sum + p.stats.own_goal, 0);
                  const ownGoalsB = playersB.reduce((sum, p) => sum + p.stats.own_goal, 0);
                  const finalScoreA = goalsA + ownGoalsB;
                  const finalScoreB = goalsB + ownGoalsA;

                  const assistsA = playersA.reduce((sum, p) => sum + p.stats.assists, 0);
                  const assistsB = playersB.reduce((sum, p) => sum + p.stats.assists, 0);

                  const defA = playersA.reduce((sum, p) => sum + p.stats.def_con, 0);
                  const defB = playersB.reduce((sum, p) => sum + p.stats.def_con, 0);

                  const normSavesA = playersA.reduce((sum, p) => sum + p.stats.normal_saves, 0);
                  const normSavesB = playersB.reduce((sum, p) => sum + p.stats.normal_saves, 0);

                  const penSavesA = playersA.reduce((sum, p) => sum + p.stats.penalty_saves, 0);
                  const penSavesB = playersB.reduce((sum, p) => sum + p.stats.penalty_saves, 0);

                  const penMissA = playersA.reduce((sum, p) => sum + p.stats.penalty_miss, 0);
                  const penMissB = playersB.reduce((sum, p) => sum + p.stats.penalty_miss, 0);

                  const StatComparisonRow = ({ label, valA, valB }: { label: string, valA: number, valB: number }) => {
                    const total = valA + valB;
                    const pctA = total > 0 ? (valA / total) * 100 : 50;
                    const pctB = total > 0 ? (valB / total) * 100 : 50;
                    return (
                      <div className="flex flex-col gap-1 py-1.5 border-b border-neutral-900 last:border-0" style={{ direction: "rtl" }}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-white w-1/3 text-right">{valA}</span>
                          <span className="text-gray-400 font-extrabold text-center w-1/3 text-[10px] sm:text-xs">{label}</span>
                          <span className="font-extrabold text-white w-1/3 text-left">{valB}</span>
                        </div>
                        <div className="h-2 w-full bg-[#141212]/80 rounded-full flex overflow-hidden border border-neutral-950">
                          <div 
                            style={{ width: `${pctA}%` }} 
                            className={`h-full transition-all duration-500 ${valA > valB ? activeTheme.bgAccent : valA < valB ? 'bg-neutral-800' : 'bg-neutral-700'}`}
                          />
                          <div 
                            style={{ width: `${pctB}%` }} 
                            className={`h-full transition-all duration-500 ${valB > valA ? 'bg-amber-500' : valB < valA ? 'bg-neutral-800' : 'bg-neutral-700'}`}
                          />
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="md:col-span-2 bento-card bg-[#0f0f0f] border border-[#1c1c1c] p-4 sm:p-6 rounded-2xl md:rounded-[2.5rem] shadow-xl flex flex-col justify-between gap-4" id="match-scorecard">
                      <div>
                        <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`w-5 h-5 ${activeTheme.textAccent}`} />
                            <span className="font-extrabold text-white text-sm sm:text-base">تحليل الفروقات والنسب الإحصائية للمباراة</span>
                          </div>
                          <span className="text-[10px] bg-[#141414] border border-neutral-800 px-2.5 py-1 rounded-xl text-neutral-400 font-bold font-mono">
                            مدة اللعب: {formatTime(matchTime)}
                          </span>
                        </div>

                        {/* Quick summary header column helper */}
                        <div className="grid grid-cols-3 text-center mb-2 px-1 text-[10px] sm:text-xs font-black text-neutral-500" style={{ direction: "rtl" }}>
                          <div className="text-right text-emerald-400 truncate pr-1">🛡️ {teamNameA || "الفريق الأول"}</div>
                          <div className="text-center">الفئة الإحصائية</div>
                          <div className="text-left text-amber-500 truncate pl-1">⚡ {teamNameB || "الفريق الثاني"}</div>
                        </div>

                        <div className="space-y-1">
                          <StatComparisonRow label="إجمالي نتيجة المباراة ⚽" valA={finalScoreA} valB={finalScoreB} />
                          <StatComparisonRow label="الأهداف المسجلة للاعبين" valA={goalsA} valB={goalsB} />
                          <StatComparisonRow label="التمريرات الحاسمة (أسيست)" valA={assistsA} valB={assistsB} />
                          <StatComparisonRow label="تصديات الحارس العادية" valA={normSavesA} valB={normSavesB} />
                          <StatComparisonRow label="تصدي ضربات جزاء" valA={penSavesA} valB={penSavesB} />
                          <StatComparisonRow label="افتكاك وقطع كرات" valA={defA} valB={defB} />
                          <StatComparisonRow label="ركلات جزاء مهدرة" valA={penMissA} valB={penMissB} />
                          <StatComparisonRow label="أهداف عكسية (في مرماه)" valA={ownGoalsA} valB={ownGoalsB} />
                        </div>
                      </div>

                      <div className="text-xs text-neutral-400 bg-[#141414] border border-[#262626] p-4 rounded-2xl leading-relaxed flex items-start gap-2.5">
                        <CheckCircle className={`w-4.5 h-4.5 ${activeTheme.textAccent} shrink-0 mt-0.5`} />
                        <span>توضح القضبان الملونة تفوق كل فريق في المهارات الخاصة بالملعب. تم تجميع الإحصائيات الفردية بفضل معالجة الصوت المباشرة المرفوعة على سيرفر El-Kawera الذكي. جاهز لمشاطرة النتيجة مع زملائك في النادي!</span>
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* AI tactical Coach Briefing */}
              <div className={`bento-card bg-[#0f0f0f] border ${activeTheme.borderAccent} p-4 sm:p-6 rounded-2xl md:rounded-[2.5rem] shadow-xl flex flex-col gap-4 relative`} id="coach-briefing-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c1c1c] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-5 h-5 ${activeTheme.textAccent} animate-pulse`} />
                    <h3 className="font-extrabold text-white text-sm sm:text-base">التقارير التحليلية والمدير الفني الأسطوري 📝</h3>
                  </div>

                  {/* Actions to download as Image only */}
                  {aiInsights && !isGeneratingInsights && (
                    <div className="flex items-center gap-2 self-end sm:self-auto insight-actions-container" style={{ direction: "rtl" }}>
                      <button
                        onClick={handleDownloadCoachInsightImage}
                        className="text-xs bg-[#141414] hover:bg-neutral-900 text-neutral-300 hover:text-white border border-[#262626] hover:border-neutral-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
                        title="تنزيل كصورة"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span>تنزيل التقرير بالكامل كصورة 📸</span>
                      </button>
                    </div>
                  )}
                </div>

                {isGeneratingInsights ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3" id="generating-briefing-loader">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    <p className="text-sm text-emerald-400 font-bold">جاري تدبيج تقرير فني أسطوري عن الماتش...</p>
                    <div className="text-center font-bold text-xs text-gray-400 italic space-y-1">
                      <p>"المدرب بيراجع لقطات الملعب وكومبو الألعاب بالمليمتر..."</p>
                      <p>"بيحلل أداء الأطراف وبيرتب الكلمة التاريخية للفريق..."</p>
                    </div>
                  </div>
                ) : insightsError ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{insightsError}</span>
                  </div>
                ) : aiInsights ? (
                  <div className="flex flex-col gap-4">
                    {/* Premium tab selectors directly inside the card */}
                    <div className="flex flex-wrap gap-2 border-b border-neutral-900 pb-3" style={{ direction: "rtl" }}>
                      <button
                        onClick={() => setActiveInsightTab('summary')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInsightTab === 'summary' 
                            ? `${activeTheme.bgAccent} text-black font-black shadow-md ${activeTheme.glowColor}`
                            : 'bg-[#141414] text-gray-400 hover:text-white border border-[#262626]'
                        }`}
                      >
                        <span>📊</span>
                        <span>التحليل الشامل للماتش</span>
                      </button>
                      <button
                        onClick={() => setActiveInsightTab('coachA')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInsightTab === 'coachA' 
                            ? `${activeTheme.bgAccent} text-black font-black shadow-md ${activeTheme.glowColor}`
                            : 'bg-[#141414] text-gray-400 hover:text-white border border-[#262626]'
                        }`}
                      >
                        <Shield className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>المدير الفني لـ {teamNameA || "الفريق الأول"}</span>
                      </button>
                      <button
                        onClick={() => setActiveInsightTab('coachB')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInsightTab === 'coachB' 
                            ? `${activeTheme.bgAccent} text-black font-black shadow-md ${activeTheme.glowColor}`
                            : 'bg-[#141414] text-gray-400 hover:text-white border border-[#262626]'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                        <span>المدير الفني لـ {teamNameB || "الفريق الثاني"}</span>
                      </button>
                      <button
                        onClick={() => setActiveInsightTab('mvp')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeInsightTab === 'mvp' 
                            ? `${activeTheme.bgAccent} text-black font-black shadow-md ${activeTheme.glowColor}`
                            : 'bg-[#141414] text-gray-400 hover:text-white border border-[#262626]'
                        }`}
                      >
                        <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>تعليق MVP الخاص</span>
                      </button>
                    </div>

                    {/* Rendering tab contents dynamically */}
                    <div className="text-right font-sans" style={{ direction: "rtl", textAlign: "right" }}>
                      {activeInsightTab === 'summary' && (
                        <div className="bg-black/20 p-4 sm:p-6 rounded-2xl border border-neutral-900/60 leading-relaxed">
                          <div className="mb-4 flex items-center gap-2 border-b border-neutral-900 pb-2">
                            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">شريط التحليل التكتيكي وملخص الأحداث الإجمالي</span>
                          </div>
                          <div className="space-y-3">
                            {typeof aiInsights === "string" 
                              ? renderMarkdownLines(aiInsights) 
                              : renderMarkdownLines(aiInsights.matchSummary)}
                          </div>
                        </div>
                      )}

                      {activeInsightTab === 'coachA' && (
                        <div className="bg-emerald-950/15 p-4 sm:p-6 rounded-2xl border border-emerald-500/20 leading-relaxed relative overflow-hidden">
                          <div className="absolute top-2 left-2 opacity-[0.03] text-8xl">🛡️</div>
                          <div className="mb-4 flex items-center gap-2 border-b border-emerald-900/40 pb-2">
                            <Shield className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                              التقرير والمشحذ الفني لمدرب {teamNameA || "الفريق الأول"} الأسطوري
                            </span>
                          </div>
                          <div className="space-y-3">
                            {typeof aiInsights === "string" ? (
                              <p className="text-neutral-400 text-xs italic">التحليل مدمج في التقرير العام بالتبويب الأول.</p>
                            ) : (
                              renderMarkdownLines(aiInsights.insightsA)
                            )}
                          </div>
                        </div>
                      )}

                      {activeInsightTab === 'coachB' && (
                        <div className="bg-sky-950/15 p-4 sm:p-6 rounded-2xl border border-sky-500/20 leading-relaxed relative overflow-hidden">
                          <div className="absolute top-2 left-2 opacity-[0.03] text-8xl">⚡</div>
                          <div className="mb-4 flex items-center gap-2 border-b border-sky-900/40 pb-2">
                            <Zap className="w-4 h-4 text-sky-400" />
                            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                              التقرير والمشحذ الفني لمدرب {teamNameB || "الفريق الثاني"} الأسطوري
                            </span>
                          </div>
                          <div className="space-y-3">
                            {typeof aiInsights === "string" ? (
                              <p className="text-neutral-400 text-xs italic">التحليل مدمج في التقرير العام بالتبويب الأول.</p>
                            ) : (
                              renderMarkdownLines(aiInsights.insightsB)
                            )}
                          </div>
                        </div>
                      )}

                      {activeInsightTab === 'mvp' && (
                        <div className="bg-amber-500/5 p-4 sm:p-6 rounded-2xl border border-amber-500/20 leading-relaxed relative overflow-hidden">
                          <div className="absolute top-2 left-2 opacity-[0.03] text-8xl">👑</div>
                          <div className="mb-4 flex items-center gap-2 border-b border-neutral-900 pb-2">
                            <Trophy className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">تحليل وتفسير رجل السهرة (MVP) الكوميدي والتكتيكي</span>
                          </div>
                          <div className="flex flex-col items-center text-center justify-center py-4">
                            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/50 flex items-center justify-center text-2xl shadow-inner mb-2 animate-bounce">
                              👑
                            </div>
                            {typeof aiInsights === "string" ? (
                              <p className="text-neutral-400 text-xs italic">التحليل مدمج في التقرير العام بالتبويب الأول.</p>
                            ) : (
                              <>
                                <h4 className="text-lg font-black text-white">{aiInsights.overallMvpName || "لا يوجد لاعب مميز"}</h4>
                                <span className="text-xs text-amber-500 font-bold mt-1 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                                  فريق {aiInsights.overallMvpTeam || "المباراة"}
                                </span>
                                <div className="mt-4 bg-[#141414] border border-[#262626] px-4 py-3 rounded-xl max-w-md text-xs text-neutral-300 leading-relaxed text-right relative">
                                  <span className="absolute -top-3 right-4 bg-[#0f0f0f] px-2 font-mono text-[9px] text-[#8a8a8a]">لماذا نال اللقب؟</span>
                                  {aiInsights.overallMvpReason || "الجميع قدموا مردوداً رائعاً!"}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">لا تتوفر تحليلات حالياً.</p>
                )}
              </div>

              {/* Final Post-Match Fully Loaded Stats Tables */}
              <div className="mt-4 flex flex-col gap-6 animate-fade-in" id="post-match-stats-table">
                <StatsTable 
                  players={playersA} 
                  onUpdateStat={handleUpdateStat} 
                  teamName={teamNameA}
                  textAccent={activeTheme.textAccent}
                  bgAccent={activeTheme.bgAccent}
                  hoverAccent={activeTheme.hoverAccent}
                  borderAccent={activeTheme.borderAccent}
                  badgeColor={activeTheme.badgeColor}
                  badgeLight={activeTheme.badgeLight}
                  iconColor={activeTheme.iconColor}
                />
                
                <StatsTable 
                  players={playersB} 
                  onUpdateStat={handleUpdateStat} 
                  teamName={teamNameB}
                  textAccent={activeTheme.textAccent}
                  bgAccent={activeTheme.bgAccent}
                  hoverAccent={activeTheme.hoverAccent}
                  borderAccent={activeTheme.borderAccent}
                  badgeColor={activeTheme.badgeColor}
                  badgeLight={activeTheme.badgeLight}
                  iconColor={activeTheme.iconColor}
                />
              </div>

            </motion.div>
          )}
          </>
          )}

        </AnimatePresence>
      </main>

      {/* HISTORIC MATCH DETAILS MODAL OVERLAY */}
      <AnimatePresence>
        {viewingHistoryInsights && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setViewingHistoryInsights(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0b0b0b] border border-neutral-900 w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative scrollbar-thin"
              style={{ direction: 'rtl' }}
            >
              {/* Close Button & Header */}
              <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    🏆
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">تقرير أداء تكتيكي مفصل</h3>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">{viewingHistoryInsights.date}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingHistoryInsights(null)}
                  className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Score display banner */}
              <div className="bg-[#141414] border border-neutral-900 rounded-2xl p-5 flex items-center justify-between gap-4 max-w-2xl mx-auto w-full">
                <div className="text-center flex-1">
                  <span className="text-[10px] text-gray-500 font-bold block mb-1">الفريق الأول</span>
                  <span className="text-sm font-black text-white block truncate">{viewingHistoryInsights.teamNameA}</span>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-3xl font-black text-emerald-400">{viewingHistoryInsights.scoreA}</span>
                  <span className="text-xs text-neutral-600 font-bold">ضد</span>
                  <span className="text-3xl font-black text-amber-400">{viewingHistoryInsights.scoreB}</span>
                </div>
                <div className="text-center flex-1">
                  <span className="text-[10px] text-gray-500 font-bold block mb-1">الفريق الثاني</span>
                  <span className="text-sm font-black text-white block truncate">{viewingHistoryInsights.teamNameB}</span>
                </div>
              </div>

              {/* Stats table overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl text-center">
                  <span className="text-[10px] text-neutral-500 block font-bold mb-1">مدة المباراة الكلية</span>
                  <span className="text-lg font-mono font-black text-neutral-300">{formatTime(viewingHistoryInsights.duration)}</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl text-center">
                  <span className="text-[10px] text-neutral-500 block font-bold mb-1">عدد الأحداث المسجلة</span>
                  <span className="text-lg font-mono font-black text-neutral-300">{viewingHistoryInsights.eventsCount} أحداث</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl text-center flex flex-col justify-center items-center">
                  <span className="text-[10px] text-neutral-500 block font-bold mb-1">رجل المباراة MVP</span>
                  {viewingHistoryInsights.mvp ? (
                    <span className="text-xs font-black text-amber-400">{viewingHistoryInsights.mvp.name} ({viewingHistoryInsights.mvp.teamName})</span>
                  ) : (
                    <span className="text-xs text-gray-500 font-bold">غير متوفر</span>
                  )}
                </div>
              </div>

              {/* Multi-Tab visual switcher headers */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-950 rounded-2xl border border-neutral-900 mb-2">
                <button
                  type="button"
                  onClick={() => setHistoryModalTab('insights')}
                  className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer text-center ${
                    historyModalTab === 'insights'
                      ? `${activeTheme.badgeLight} text-[#050505] font-black`
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  التحليل والذكاء الاصطناعي 🧠
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryModalTab('events')}
                  className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer text-center ${
                    historyModalTab === 'events'
                      ? `${activeTheme.badgeLight} text-[#050505] font-black`
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  الجدول الزمني للأحداث ⏱️
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryModalTab('ratings')}
                  className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer text-center ${
                    historyModalTab === 'ratings'
                      ? `${activeTheme.badgeLight} text-[#050505] font-black`
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  تقييمات اللاعبين 🎖️
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryModalTab('momentum')}
                  className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer text-center ${
                    historyModalTab === 'momentum'
                      ? `${activeTheme.badgeLight} text-[#050505] font-black`
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  منحنى الزخم 📈
                </button>
              </div>

              {/* REPORT & TAB CONTENTS */}
              <div className="mt-2">
                {historyModalTab === 'insights' && (
                  <div className="space-y-4 text-right animate-fade-in">
                    <h4 className="font-extrabold text-[#fff] text-sm mb-3 flex items-center gap-1.5 pb-2 border-b border-neutral-900">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>تقرير المحلل الفني والمدرب التكتيكي الذكي</span>
                    </h4>

                    {viewingHistoryInsights.aiInsightsSummary ? (
                      <div className="space-y-4">
                        {/* Overall summary block */}
                        {viewingHistoryInsights.aiInsightsSummary.matchSummary && (
                          <div className="p-4 bg-[#111] border border-neutral-900 rounded-2xl">
                            <span className="text-xs text-emerald-400 font-bold mb-1.5 block">🎯 ملخص مجريات اللقاء التكتيكي</span>
                            <p className="text-xs text-gray-300 leading-relaxed font-sans">{viewingHistoryInsights.aiInsightsSummary.matchSummary}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Coach A insights */}
                          {viewingHistoryInsights.aiInsightsSummary.insightsA && (
                            <div className="p-4 bg-[#111]/40 border border-neutral-900 rounded-2xl border-r-4 border-r-emerald-500">
                              <span className="text-xs text-emerald-450 font-black mb-1.5 block">🟢 تحليل الأداء التكتيكي للفريق الأول ({viewingHistoryInsights.teamNameA})</span>
                              <p className="text-xs text-gray-305 leading-relaxed font-sans mt-1 whitespace-pre-wrap">{viewingHistoryInsights.aiInsightsSummary.insightsA}</p>
                            </div>
                          )}
                          {/* Coach B insights */}
                          {viewingHistoryInsights.aiInsightsSummary.insightsB && (
                            <div className="p-4 bg-[#111]/40 border border-neutral-900 rounded-2xl border-r-4 border-r-amber-400">
                              <span className="text-xs text-amber-455 font-black mb-1.5 block">🟡 تحليل الأداء التكتيكي للفريق الثاني ({viewingHistoryInsights.teamNameB})</span>
                              <p className="text-xs text-gray-305 leading-relaxed font-sans mt-1 whitespace-pre-wrap">{viewingHistoryInsights.aiInsightsSummary.insightsB}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-neutral-950 border border-neutral-900 rounded-2xl">
                        <p className="text-xs text-neutral-500 font-bold">عفواً، لم يتوفر تقرير ذكاء اصطناعي محفوظ لهذه المباراة بعد او تم توليدها أوفلاين دون اتصال بالخادم.</p>
                      </div>
                    )}
                  </div>
                )}

                {historyModalTab === 'events' && (
                  <div className="space-y-4 text-right animate-fade-in">
                    <h4 className="font-extrabold text-[#fff] text-sm mb-3 flex items-center gap-1.5 pb-2 border-b border-neutral-900">
                      <History className="w-4 h-4 text-emerald-400" />
                      <span>جدول أحداث ومجريات اللعب الكلاسيكية</span>
                    </h4>

                    {(!viewingHistoryInsights.events || viewingHistoryInsights.events.length === 0) ? (
                      <div className="text-center py-12 bg-[#111] rounded-2xl border border-neutral-900">
                        <p className="text-xs text-neutral-500 font-bold font-sans">لا توجد أحداث تفصيلية مسجلة بالتوقيت لهذه المباراة في الأرشيف القديم.</p>
                      </div>
                    ) : (
                      <div className="relative border-r border-neutral-900 pr-5 mr-3 space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
                        {viewingHistoryInsights.events.map((ev, idx) => (
                          <div key={ev.id || idx} className="relative">
                            {/* Dot */}
                            <div className="absolute -right-[28px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border border-neutral-950" />
                            <div className="bg-[#111] border border-neutral-900 p-3.5 rounded-xl text-xs">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[10px] font-bold bg-neutral-950 border border-neutral-800 text-neutral-350 px-2 py-0.5 rounded font-mono">
                                  ⏱️ الدقيقة {ev.timestamp}
                                </span>
                              </div>
                              <p className="text-gray-100 font-bold leading-tight text-right mt-1.5">{ev.explanation}</p>
                              <p className="text-[10px] text-neutral-500 italic mt-1 leading-normal">
                                نص التعليق: "{ev.transcription}"
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {historyModalTab === 'ratings' && (
                  <div className="space-y-4 text-right animate-fade-in">
                    <h4 className="font-extrabold text-[#fff] text-sm mb-3 flex items-center gap-1.5 pb-2 border-b border-neutral-900">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>تقييمات اللاعبين واللمسات الفعالة (Sofa Ratings Live)</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Team A Roster */}
                      <div className="bg-[#111]/40 border border-neutral-900 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-900">
                          <span className="text-xs font-black text-emerald-450">تشكيلة {viewingHistoryInsights.teamNameA}</span>
                        </div>
                        <div className="space-y-2 max-h-[35vh] overflow-y-auto custom-scrollbar">
                          {viewingHistoryInsights.playersA.map(p => {
                            const rate = calculatePlayerLiveRating(p, false);
                            const style = getRatingColorClass(rate);
                            return (
                              <div key={p.id} className="flex justify-between items-center bg-[#070707] py-2 px-3 border border-neutral-900 rounded-xl">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-black border ${style.bg} ${style.text} ${style.border}`}>
                                    {rate.toFixed(1)}
                                  </span>
                                  <span className="text-neutral-200 font-bold text-xs">{p.name}</span>
                                </div>
                                <div className="flex gap-1.5 text-[9px] text-neutral-500 font-mono">
                                  <span>⚽ {p.stats.goals}</span>
                                  <span>🅰️ {p.stats.assists}</span>
                                  <span>🛡️ {p.stats.def_con}</span>
                                  <span>🧤 {p.stats.normal_saves + p.stats.penalty_saves}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Team B Roster */}
                      <div className="bg-[#111]/40 border border-neutral-900 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-900">
                          <span className="text-xs font-black text-amber-450">تشكيلة {viewingHistoryInsights.teamNameB}</span>
                        </div>
                        <div className="space-y-2 max-h-[35vh] overflow-y-auto custom-scrollbar font-sans">
                          {viewingHistoryInsights.playersB.map(p => {
                            const rate = calculatePlayerLiveRating(p, false);
                            const style = getRatingColorClass(rate);
                            return (
                              <div key={p.id} className="flex justify-between items-center bg-[#070707] py-2 px-3 border border-neutral-900 rounded-xl">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-black border ${style.bg} ${style.text} ${style.border}`}>
                                    {rate.toFixed(1)}
                                  </span>
                                  <span className="text-neutral-200 font-bold text-xs">{p.name}</span>
                                </div>
                                <div className="flex gap-1.5 text-[9px] text-neutral-500 font-mono">
                                  <span>⚽ {p.stats.goals}</span>
                                  <span>🅰️ {p.stats.assists}</span>
                                  <span>🛡️ {p.stats.def_con}</span>
                                  <span>🧤 {p.stats.normal_saves + p.stats.penalty_saves}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {historyModalTab === 'momentum' && (
                  <div className="space-y-4 text-right animate-fade-in">
                    <h4 className="font-extrabold text-[#fff] text-sm mb-3 flex items-center gap-1.5 pb-2 border-b border-neutral-900">
                      <Activity className="w-4 h-4 text-indigo-400" />
                      <span>منحنى الزخم والتحولات التكتيكية لضغط اللقاء</span>
                    </h4>

                    {(() => {
                      const mPoints = calculateMatchMomentum(viewingHistoryInsights.events || []);
                      const chartWidth = 460;
                      const chartHeight = 150;
                      const pad = 20;
                      const midY = chartHeight / 2;

                      const gapX = (chartWidth - pad * 2) / Math.max(1, mPoints.length - 1);
                      const maxAbsolute = Math.max(...mPoints.map(p => Math.abs(p.val)), 4);
                      const scaleMultiplier = (chartHeight / 2 - pad) / maxAbsolute;

                      return (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-[10px] text-neutral-400 font-black px-1 leading-normal">
                            <span className="text-emerald-450">▲ هجوم وسيطرة {viewingHistoryInsights.teamNameA}</span>
                            <span className="text-red-450">▼ هجوم وسيطرة {viewingHistoryInsights.teamNameB}</span>
                          </div>

                          <div className="bg-[#050505] border border-neutral-900 rounded-2xl p-4 overflow-hidden relative">
                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto max-h-[160px] overflow-visible">
                              {/* Central line */}
                              <line
                                x1={pad}
                                y1={midY}
                                x2={chartWidth - pad}
                                y2={midY}
                                stroke="#222"
                                strokeWidth="1.5"
                                strokeDasharray="3,3"
                              />

                              {/* Bars */}
                              {mPoints.map((item, idx) => {
                                const posX = pad + idx * gapX;
                                const valY = item.val * scaleMultiplier;
                                const barColor = item.val >= 0 ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)";
                                return (
                                  <g key={idx}>
                                    <line
                                      x1={posX}
                                      y1={midY}
                                      x2={posX}
                                      y2={midY - valY}
                                      stroke={barColor}
                                      strokeWidth="4"
                                      strokeLinecap="round"
                                      className="transition-all duration-300"
                                    />
                                    <circle
                                      cx={posX}
                                      cy={midY - valY}
                                      r="2.5"
                                      fill={barColor}
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                          </div>

                          <div className="bg-[#111]/45 border border-neutral-900 rounded-xl p-3 text-[11px] text-neutral-400 font-sans leading-relaxed">
                            💡 تم رصد منحنى الزخم والتوزيع التكتيكي للمباراة بناءً على تسلسل المعطيات والتعليقات الحية المسجلة بالصوت والذكاء الاصطناعي للمباراة بالكامل!
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-6 border-t border-[#1c1c1c] text-center text-xs text-neutral-500 bg-[#0f0f0f]/50 rounded-[2rem] mt-6 z-10" id="app-footer">
        <p className="font-semibold select-none">
          برنامج "الكورة" الذكي - جميع الحقوق محفوظة © {new Date().getFullYear()} ELKAWERA CO.
        </p>
        <p className="text-[10px] text-neutral-600 font-bold mt-1">
          تم التصميم والتطوير بنبض مصري حماسي. مبني على تكنولوجيا التعرف الصوتي الفوري من Google Gemini.
        </p>
      </footer>

    </div>
  );
}
