import { useState } from "react";
import { TournamentGroup, GroupTeam, GroupMatch } from "../types";
import { Trophy, Users, Edit3, Settings, Play, RefreshCw, Sparkles, Check, ChevronLeft, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GroupsDashboardProps {
  groups: TournamentGroup[];
  onUpdateGroups: (groups: TournamentGroup[]) => void;
  onStartGroupMatch: (teamNameA: string, teamNameB: string, groupId: string, matchId: string) => void;
  activeTheme: any;
  currentMatchContext?: { groupId: string; matchId: string } | null;
}

export function recalculateGroupStandings(group: TournamentGroup): TournamentGroup {
  // Reset team stats
  const teams = group.teams.map(t => ({
    ...t,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  // Iterate over matches and update stats
  group.matches.forEach(m => {
    if (m.played && m.scoreA !== null && m.scoreA !== undefined && m.scoreB !== null && m.scoreB !== undefined) {
      const teamA = teams.find(t => t.id === m.teamAId);
      const teamB = teams.find(t => t.id === m.teamBId);

      if (teamA && teamB) {
        teamA.played += 1;
        teamB.played += 1;
        teamA.goalsFor += m.scoreA;
        teamB.goalsFor += m.scoreB;
        teamA.goalsAgainst += m.scoreB;
        teamB.goalsAgainst += m.scoreA;

        if (m.scoreA > m.scoreB) {
          teamA.won += 1;
          teamA.points += 3;
          teamB.lost += 1;
        } else if (m.scoreA < m.scoreB) {
          teamB.won += 1;
          teamB.points += 3;
          teamA.lost += 1;
        } else {
          teamA.drawn += 1;
          teamB.drawn += 1;
          teamA.points += 1;
          teamB.points += 1;
        }
      }
    }
  });

  // Calculate goal differences and sort teams strictly aligned with World Cup standards: Points -> GD -> GoalsFor -> Alphabetical
  teams.forEach(t => {
    t.goalDifference = t.goalsFor - t.goalsAgainst;
  });

  teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  return {
    ...group,
    teams,
  };
}

export const INITIAL_GROUPS = (): TournamentGroup[] => {
  const groupNames = ["المجموعة أ (Group A)", "المجموعة ب (Group B)", "المجموعة ج (Group C)", "المجموعة د (Group D)"];
  const groupIds = ["A", "B", "C", "D"];
  
  const defaultTeams: { [key: string]: string[] } = {
    A: ["مصر 🇪🇬", "السعودية 🇸🇦", "المغرب 🇲🇦", "تونس 🇹🇳"],
    B: ["البرازيل 🇧🇷", "الأرجنتين 🇦🇷", "فرنسا 🇫🇷", "ألمانيا 🇩🇪"],
    C: ["إسبانيا 🇪🇸", "إيطاليا 🇮🇹", "إنجلترا 🏴󠁧󠁢󠁥󠁮󠁧󠁿", "البرتغال 🇵🇹"],
    D: ["اليابان 🇯🇵", "كوريا الجنوبية 🇰🇷", "السنغال 🇸🇳", "البرازيل (الشباب) ⭐️"]
  };

  return groupIds.map(id => {
    const teams = defaultTeams[id].map((name, idx) => ({
      id: `${id}${idx + 1}`,
      name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }));

    // Scheduled matches: 6 per group of 4 teams
    const matches: GroupMatch[] = [
      { id: `${id}-m1`, teamAId: teams[0].id, teamBId: teams[1].id, played: false },
      { id: `${id}-m2`, teamAId: teams[2].id, teamBId: teams[3].id, played: false },
      { id: `${id}-m3`, teamAId: teams[0].id, teamBId: teams[2].id, played: false },
      { id: `${id}-m4`, teamAId: teams[1].id, teamBId: teams[3].id, played: false },
      { id: `${id}-m5`, teamAId: teams[0].id, teamBId: teams[3].id, played: false },
      { id: `${id}-m6`, teamAId: teams[1].id, teamBId: teams[2].id, played: false },
    ];

    return {
      id,
      name: groupNames[groupIds.indexOf(id)],
      teams,
      matches,
    };
  });
};

export default function GroupsDashboard({ 
  groups, 
  onUpdateGroups, 
  onStartGroupMatch, 
  activeTheme,
  currentMatchContext
}: GroupsDashboardProps) {
  
  const [activeGroupId, setActiveGroupId] = useState<string>("A");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  
  // Local edit team state
  const [editedTeamNames, setEditedTeamNames] = useState<{ [id: string]: string }>({});

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  // Manual score input values state
  const [manualScores, setManualScores] = useState<{ 
    [matchId: string]: { scoreA: string; scoreB: string } 
  }>({});

  const startEditingTeams = (group: TournamentGroup) => {
    setEditingGroupId(group.id);
    const names: { [id: string]: string } = {};
    group.teams.forEach(t => {
      names[t.id] = t.name;
    });
    setEditedTeamNames(names);
  };

  const saveEditedTeams = () => {
    if (!editingGroupId) return;
    
    const updatedGroups = groups.map(g => {
      if (g.id === editingGroupId) {
        const nextTeams = g.teams.map(t => ({
          ...t,
          name: editedTeamNames[t.id]?.trim() || t.name
        }));
        return {
          ...g,
          teams: nextTeams
        };
      }
      return g;
    });

    onUpdateGroups(updatedGroups);
    setEditingGroupId(null);
  };

  const updateManualScoreInputs = (matchId: string, side: 'scoreA' | 'scoreB', value: string) => {
    // Only permit digits
    const cleaned = value.replace(/\D/g, "");
    setManualScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: cleaned
      }
    }));
  };

  const saveManualMatchResult = (matchId: string, teamAId: string, teamBId: string) => {
    const scores = manualScores[matchId];
    if (!scores || scores.scoreA === "" || scores.scoreB === "") return;

    const gScoreA = parseInt(scores.scoreA, 10);
    const gScoreB = parseInt(scores.scoreB, 10);

    const updatedGroups = groups.map(g => {
      if (g.id === activeGroupId) {
        const nextMatches = g.matches.map(m => {
          if (m.id === matchId) {
            return {
              ...m,
              scoreA: gScoreA,
              scoreB: gScoreB,
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

    onUpdateGroups(updatedGroups);
  };

  const resetAllGroups = () => {
    if (confirm("هل أنت متأكد من تصفير وإعادة تهيئة جميع المجموعات والفرق والنتائج؟")) {
      onUpdateGroups(INITIAL_GROUPS());
      setManualScores({});
    }
  };

  const getTeamNameById = (teamId: string, group: TournamentGroup) => {
    const team = group.teams.find(t => t.id === teamId);
    return team ? team.name : "فريق مجهول";
  };

  return (
    <div className="flex flex-col gap-6" style={{ direction: "rtl" }}>
      {/* Top action header info */}
      <div className="bento-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${activeTheme.badgeColor} flex items-center justify-center`}>
            <Trophy className={`w-6 h-6 ${activeTheme.textAccent}`} />
          </div>
          <div className="text-right">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>داشبورد المجموعات التكتيكي</span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                نظام عالمي متكامل 🌍
              </span>
            </h2>
            <p className="text-xs text-neutral-500 mt-1 font-sans">
              خطط، أدخل الفرق قبل البطولة، وتابع مجريات المباريات والنقاط المسجلة تلقائياً بالتنسيق مع الحكام والمعلقين!
            </p>
          </div>
        </div>

        <button 
          onClick={resetAllGroups}
          className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>إعادة ضبط وتصفير المجموعات 🧹</span>
        </button>
      </div>

      {/* Groups Selection Tabs */}
      <div className="flex flex-wrap gap-2">
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => {
              setActiveGroupId(g.id);
              setEditingGroupId(null);
            }}
            className={`px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
              activeGroupId === g.id
                ? `${activeTheme.badgeLight} text-[#0a0a0a] border-transparent scale-102 font-extrabold shadow-lg`
                : "bg-neutral-900 border-neutral-850 text-neutral-400 hover:text-white hover:border-neutral-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{g.name}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Right side Standings layout */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bento-card bg-[#0b0b0b] border border-[#1a1a1a] rounded-[2.5rem] p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-550/2 bg-emerald-500/2 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${activeTheme.bgAccent}`} />
                <h3 className="font-extrabold text-[#fff] text-sm">جدول ترتيب {activeGroup.name}</h3>
              </div>

              {/* Edit teams setup triggers */}
              {editingGroupId !== activeGroup.id ? (
                <button
                  onClick={() => startEditingTeams(activeGroup)}
                  className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-bold text-[11px] px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الأسماء قبل البطولة ✍️</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveEditedTeams}
                    className="flex items-center gap-1 bg-emerald-500 text-black font-black text-[11px] px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ التعديل</span>
                  </button>
                  <button
                    onClick={() => setEditingGroupId(null)}
                    className="text-neutral-400 hover:text-white text-[11px] font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            {/* Standings Table Rendering */}
            {editingGroupId === activeGroup.id ? (
              <div className="bg-neutral-950 p-4 border border-neutral-900 rounded-2xl flex flex-col gap-3">
                <p className="text-[10px] text-amber-500 font-bold">⚠️ أدخل أسماء الفرق المشاركة في المجموعة لتخصيص جدول البطولة ثم اضغط حفظ:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeGroup.teams.map((t, idx) => (
                    <div key={t.id} className="flex flex-col gap-1 text-right">
                      <label className="text-[10px] text-neutral-400 font-bold">الفريق رقم {idx + 1}</label>
                      <input
                        type="text"
                        value={editedTeamNames[t.id] || ""}
                        onChange={(e) => setEditedTeamNames(prev => ({ ...prev, [t.id]: e.target.value }))}
                        className="bg-[#111] border border-neutral-850 px-3 py-2 rounded-xl text-white text-xs font-bold outline-none focus:border-emerald-500 transition-colors placeholder:text-neutral-700"
                        placeholder="البلد أو الفريق"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-neutral-850">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#141414] text-neutral-400 font-bold border-b border-neutral-900">
                      <th className="py-3 px-3 text-center w-12 font-mono">الترتيب</th>
                      <th className="py-3 px-3">الفريق</th>
                      <th className="py-3 px-2 text-center w-10 font-mono">لعب</th>
                      <th className="py-3 px-2 text-center w-10 font-mono">فوز</th>
                      <th className="py-3 px-2 text-center w-10 font-mono">تعادل</th>
                      <th className="py-3 px-2 text-center w-10 font-mono">خسارة</th>
                      <th className="py-3 px-2 text-center w-12 font-mono">له / عليه</th>
                      <th className="py-3 px-2 text-center w-12 font-mono">الفرق</th>
                      <th className="py-3 px-3 text-center w-14 font-mono font-extrabold text-emerald-400">النقاط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {activeGroup.teams.map((team, idx) => {
                      const isTopTwo = idx < 2;
                      return (
                        <tr key={team.id} className="hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3.5 px-3 text-center">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold font-mono text-[11px] mx-auto ${
                              isTopTwo ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-neutral-900 text-neutral-500"
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-extrabold text-[#fff]">
                            <div className="flex items-center gap-2">
                              {isTopTwo && <span className="text-[10px] text-emerald-500" title="متأهل">🟢</span>}
                              <span>{team.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-center font-mono text-neutral-300">{team.played}</td>
                          <td className="py-3.5 px-2 text-center font-mono text-emerald-500">{team.won}</td>
                          <td className="py-3.5 px-2 text-center font-mono text-neutral-400">{team.drawn}</td>
                          <td className="py-3.5 px-2 text-center font-mono text-amber-500">{team.lost}</td>
                          <td className="py-3.5 px-2 text-center font-mono text-neutral-400 text-[10px]">
                            {team.goalsFor} - {team.goalsAgainst}
                          </td>
                          <td className={`py-3.5 px-2 text-center font-mono font-bold ${
                            team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-neutral-500"
                          }`}>
                            {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-black text-emerald-400 bg-emerald-500/2 text-sm">{team.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>يتأهل صاحبا المركزين الأول والثاني للدور ربع النهائي من البطولة تلقائياً!</span>
            </div>
          </div>
        </div>

        {/* Left side Scheduled Match entries simulation */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bento-card bg-[#0b0b0b] border border-[#1a1a1a] rounded-[2.5rem] p-5 sm:p-6 shadow-xl flex flex-col gap-4">
            <div className="border-b border-[#1c1c1c] pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#10b981]" />
              <h3 className="font-extrabold text-[#fff] text-sm">مباريات {activeGroup.name} (6 مواجهات)</h3>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[550px] custom-scrollbar pl-1">
              {activeGroup.matches.map((m, mIdx) => {
                const teamAName = getTeamNameById(m.teamAId, activeGroup);
                const teamBName = getTeamNameById(m.teamBId, activeGroup);
                const scoreAInput = manualScores[m.id]?.scoreA ?? "";
                const scoreBInput = manualScores[m.id]?.scoreB ?? "";

                return (
                  <div key={m.id} className="border border-neutral-900 rounded-2xl p-3.5 bg-neutral-950/30 space-y-3 relative hover:border-neutral-800 transition">
                    <div className="flex justify-between items-center text-[10px] text-neutral-500 font-medium pb-2 border-b border-neutral-900">
                      <span>مواجهة {mIdx + 1} ⏱️</span>
                      {m.played ? (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-extrabold">انتهت</span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-500 font-bold">مجدولة</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-xs">
                      <div className="flex-1 text-right font-bold truncate text-[#fff]" title={teamAName}>
                        {teamAName}
                      </div>
                      
                      {m.played ? (
                        <div className="flex items-center gap-1.5 font-mono px-3 py-1 bg-[#141414] border border-neutral-850 rounded-xl font-black">
                          <span className="text-emerald-400 text-sm">{m.scoreA}</span>
                          <span className="text-[9px] text-neutral-600">:</span>
                          <span className="text-emerald-400 text-sm">{m.scoreB}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-600 font-black">ضد</span>
                      )}

                      <div className="flex-1 text-left font-bold truncate text-[#fff]" title={teamBName}>
                        {teamBName}
                      </div>
                    </div>

                    {/* Simulation buttons & Manual inputs */}
                    {!m.played && (
                      <div className="space-y-2.5 pt-1.5 border-t border-neutral-900/60">
                        {/* Interactive dynamic Simulation inputs */}
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center justify-center gap-1 w-full font-mono">
                            <input
                              type="text"
                              maxLength={2}
                              value={scoreAInput}
                              onChange={(e) => updateManualScoreInputs(m.id, 'scoreA', e.target.value)}
                              placeholder="0"
                              className="w-8 h-8 text-center bg-neutral-900 border border-neutral-850 hover:border-neutral-800 focus:border-emerald-500 text-[#fff] font-bold text-xs rounded-lg outline-none transition"
                            />
                            <span className="text-neutral-700 text-[10px] font-bold">-</span>
                            <input
                              type="text"
                              maxLength={2}
                              value={scoreBInput}
                              onChange={(e) => updateManualScoreInputs(m.id, 'scoreB', e.target.value)}
                              placeholder="0"
                              className="w-8 h-8 text-center bg-neutral-900 border border-neutral-850 hover:border-neutral-800 focus:border-emerald-500 text-[#fff] font-bold text-xs rounded-lg outline-none transition"
                            />
                          </div>

                          <button
                            onClick={() => saveManualMatchResult(m.id, m.teamAId, m.teamBId)}
                            className="bg-neutral-800 hover:bg-[#10b981] disabled:opacity-50 hover:text-[#0c0c0c] text-white text-[10px] font-black px-2.5 py-2 rounded-xl transition cursor-pointer"
                            disabled={scoreAInput === "" || scoreBInput === ""}
                          >
                            حفظ
                          </button>
                        </div>

                        {/* Direct Play in stadium click */}
                        <button
                          onClick={() => onStartGroupMatch(teamAName, teamBName, activeGroupId, m.id)}
                          className="w-full flex items-center justify-center gap-1.5 bg-[#10b981]/10 hover:bg-[#10b981]/15 text-[#10b981] text-[10px] font-black py-2 rounded-xl border border-[#10b981]/15 transition cursor-pointer active:scale-98"
                        >
                          <Play className="w-3 h-3 fill-[#10b981]" />
                          <span>خوض المباراة بالتعليق الصوتي 🎙️</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
