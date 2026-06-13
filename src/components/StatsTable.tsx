import { Player, PlayerStats } from "../types";
import { Plus, Minus, User, Shield, Info, Download, Image as ImageIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { calculatePlayerLiveRating, getRatingColorClass } from "../utils/playerRatings";

interface StatsTableProps {
  players: Player[];
  onUpdateStat: (playerId: string, stat: keyof PlayerStats, change: number) => void;
  teamName?: string;
  textAccent?: string;
  bgAccent?: string;
  hoverAccent?: string;
  borderAccent?: string;
  badgeColor?: string;
  badgeLight?: string;
  iconColor?: string;
}

export default function StatsTable({ 
  players, 
  onUpdateStat, 
  teamName,
  textAccent = "text-emerald-400",
  bgAccent = "bg-emerald-500",
  hoverAccent = "hover:bg-emerald-400",
  borderAccent = "border-emerald-500/20",
  badgeColor = "text-emerald-400",
  badgeLight = "bg-emerald-500",
  iconColor = "text-emerald-400"
}: StatsTableProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isImageExporting, setIsImageExporting] = useState(false);

  // Custom dictionary to translate stats keys into Arabic with clear descriptions
  const statMetadata: { [key in keyof PlayerStats]: { ar: string; desc: string; abbrev: string; color: string } } = {
    goals: { ar: "الأهداف", desc: "أحرز هدفاً للفريق", abbrev: "GOALS", color: textAccent },
    assists: { ar: "الأسيست", desc: "صنع فرصة أدت لهدف", abbrev: "ASSISTS", color: "text-cyan-400" },
    def_con: { ar: "الدفاع", desc: "افتكاك أو تشتيت كرة ناجح", abbrev: "DEF. CON.", color: "text-blue-400" },
    normal_saves: { ar: "تصدي عادي", desc: "تصدى لفرصة محققة من حارس المرمى", abbrev: "SAVES", color: "text-amber-400" },
    penalty_saves: { ar: "تصدي لجزاء", desc: "تصدى لضربة جزاء من الخصم", abbrev: "PEN. SAVES", color: "text-yellow-400" },
    penalty_miss: { ar: "جزاء ضائع", desc: "أضاع ضربة جزاء في العارضة أو الخارج", abbrev: "PEN. MISS", color: "text-orange-400" },
    own_goal: { ar: "هدف عكسي", desc: "أحرز هدف في مرمى فريقه بالخطأ", abbrev: "OWN GOAL", color: "text-red-400" },
    goal_cons: { ar: "استقبل هدف", desc: "اهتزت شباكه بهدف", abbrev: "GOAL CONS.", color: "text-red-500" },
  };

  // Sum up totals across all players
  const calculateTotals = () => {
    const totals: PlayerStats = {
      goals: 0,
      assists: 0,
      def_con: 0,
      normal_saves: 0,
      penalty_saves: 0,
      penalty_miss: 0,
      own_goal: 0,
      goal_cons: 0,
    };

    players.forEach(p => {
      Object.keys(totals).forEach(k => {
        const key = k as keyof PlayerStats;
        totals[key] += p.stats[key] || 0;
      });
    });

    return totals;
  };

  const totals = calculateTotals();

  const handleDownloadImage = async () => {
    if (players.length === 0) return;
    
    setIsImageExporting(true);
    
    try {
      // 1. Create a beautiful temporary off-screen element
      const tempContainer = document.createElement("div");
      tempContainer.id = "temp-capture-container";
      
      // Fixed positioning at 0, 0 with zero opacity to calculate exact dimensions without rendering black or offscreen blank spots
      tempContainer.style.position = "fixed";
      tempContainer.style.left = "0";
      tempContainer.style.top = "0";
      tempContainer.style.zIndex = "-999999";
      tempContainer.style.opacity = "0";
      tempContainer.style.pointerEvents = "none";
      tempContainer.style.width = "1024px";
      tempContainer.style.backgroundColor = "#070707";
      tempContainer.style.color = "#ffffff";
      tempContainer.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, sans-serif";
      tempContainer.style.padding = "40px";
      tempContainer.style.borderRadius = "24px";
      tempContainer.style.border = "1px solid rgba(16, 185, 129, 0.25)";
      tempContainer.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.6)";
      tempContainer.style.direction = "ltr"; 
      
      // 2. Format localized English date
      const todayString = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const tName = (teamName || "شياطين الجزيرة").trim();
      const statsKeys = Object.keys(statMetadata) as (keyof PlayerStats)[];

      // Build rows for players with clean English styles
      const tableRowsHtml = players.map((player, idx) => {
        const cellsHtml = statsKeys.map(statKey => {
          const val = player.stats[statKey] || 0;
          const isPositive = val > 0;
          return `
            <td style="padding: 14px 6px; border-bottom: 1px solid #141414; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: ${isPositive ? '#10b981' : '#4b5563'}; font-weight: ${isPositive ? '800' : '500'};">
              ${val}
            </td>
          `;
        }).join("");

        return `
          <tr style="background-color: ${idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent'};">
            <td style="padding: 14px 6px; border-bottom: 1px solid #141414; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #4b5563;">
              ${idx + 1}
            </td>
            <td style="padding: 14px 16px; border-bottom: 1px solid #141414; text-align: right; font-size: 14px; font-weight: bold; color: #e5e7eb; direction: rtl; min-width: 140px;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981; margin-left: 8px; vertical-align: middle;"></span>
              <span class="arabic-text" style="vertical-align: middle; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; letter-spacing: 0 !important;">${player.name}</span>
            </td>
            ${cellsHtml}
          </tr>
        `;
      }).join("");

      // Header row columns
      const headersHtml = statsKeys.map(statKey => {
        return `
          <th style="padding: 16px 6px; border-bottom: 2px solid #1f2937; color: #9ca3af; font-size: 11px; font-weight: 800; text-align: center; font-family: system-ui, sans-serif;">
            <div style="color: #ffffff; font-size: 12px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px;">${statMetadata[statKey].abbrev}</div>
          </th>
        `;
      }).join("");

      // Totals row columns
      const totalsCellsHtml = statsKeys.map(statKey => {
        const tVal = totals[statKey] || 0;
        return `
          <td style="padding: 16px 6px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 15px; color: ${tVal > 0 ? '#10b981' : '#4b5563'}; font-weight: 900; background-color: rgba(16, 185, 129, 0.03);">
            ${tVal}
          </td>
        `;
      }).join("");

      // Assemble final premium scorecard container HTML
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
        <div style="position: absolute; top: 0; right: 0; width: 250px; height: 250px; background-color: rgba(16, 185, 129, 0.04); border-radius: 50%; filter: blur(60px); pointer-events: none;"></div>
        <div style="position: absolute; bottom: 0; left: 0; width: 200px; height: 200px; background-color: rgba(6, 182, 212, 0.02); border-radius: 50%; filter: blur(60px); pointer-events: none;"></div>

        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2937; padding-bottom: 24px; margin-bottom: 24px; position: relative; z-index: 10;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="background-color: #10b981; color: #050505; font-weight: 950; font-size: 11px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">EL-KAWERA AI</span>
              <h1 style="font-size: 26px; font-weight: 900; margin: 0; color: #ffffff;">
                <span class="arabic-text" dir="rtl" lang="ar" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; letter-spacing: 0 !important;">${tName}</span>
              </h1>
            </div>
            <p style="font-size: 13px; color: #9ca3af; margin: 0;">Match Scorecard • Real-Time Voice Guided Statistics & Analytics</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; font-weight: 900; color: #10b981; margin-bottom: 4px;">PERFORMANCE EXPORT</div>
            <div style="font-size: 12px; color: #6b7280; font-weight: 500;">${todayString}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; background-color: rgba(15, 15, 15, 0.85); position: relative; z-index: 10;">
          <thead>
            <tr style="background-color: #0c0c0c;">
              <th style="padding: 16px 6px; border-bottom: 2px solid #1f2937; color: #4b5563; font-size: 11px; font-weight: 800; width: 50px; text-align: center; font-family: 'JetBrains Mono', monospace;">#</th>
              <th style="padding: 16px 16px; border-bottom: 2px solid #1f2937; color: #9ca3af; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-align: left;">PLAYER NAME</th>
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr style="background-color: #0a0a0a; font-weight: 900; border-top: 2px solid #1f2937;">
              <td style="padding: 16px 6px; text-align: center; color: #10b981; font-size: 13px; font-family: 'JetBrains Mono', monospace; font-weight: 900; background-color: rgba(16, 185, 129, 0.03);">∑</td>
              <td style="padding: 16px 16px; text-align: left; color: #10b981; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; background-color: rgba(16, 185, 129, 0.03);">TEAM TOTALS</td>
              ${totalsCellsHtml}
            </tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #1f2937; opacity: 0.8; position: relative; z-index: 10;">
          <div style="font-size: 10px; color: #4b5563; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px;">
            REPORT VERIFICATION CODE: OK-KWR-PRO • STABLE EXPORT
          </div>
          <div style="font-size: 11px; color: #10b981; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; gap: 4px;">
            🏆 EL-KAWERA SCORECARD ENGINE
          </div>
        </div>
      `;

      // 5. Append offscreen container
      document.body.appendChild(tempContainer);

      // Force a momentary layout paint pause
      await new Promise(resolve => setTimeout(resolve, 150));

      const imgData = await toPng(tempContainer, {
        backgroundColor: "#070707",
        width: 1024,
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

      // 6. Clean up offscreen node immediately
      document.body.removeChild(tempContainer);

      // 7. Fire download flow
      const link = document.createElement("a");
      const normalizedTeam = tName.replace(/[\/\\?%*:|"<>\s]/g, "_");
      const todayNumString = new Date().toLocaleDateString('en-US').replace(/\//g, "-");
      
      link.download = `Match_Scorecard_${normalizedTeam}_${todayNumString}.png`;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Failed to generate scorecard image:", err);
    } finally {
      setIsImageExporting(false);
    }
  };

  const handleDownloadCSV = () => {
    // 1. Column headers
    const headers = [
      "اسم اللاعب",
      "الأهداف (GOALS)",
      "الأسيست (ASSISTS)",
      "إسهامات دفاعية (DEF. CON.)",
      "تصدي عادي (SAVES)",
      "تصدي لجزاء (PEN. SAVES)",
      "ضربات جزاء مهدرة (PEN. MISS)",
      "أهداف عكسية (OWN GOAL)",
      "أهداف استقبلها (GOAL CONS.)"
    ];

    // 2. Rows of player data
    const rows = players.map(p => [
      p.name,
      p.stats.goals || 0,
      p.stats.assists || 0,
      p.stats.def_con || 0,
      p.stats.normal_saves || 0,
      p.stats.penalty_saves || 0,
      p.stats.penalty_miss || 0,
      p.stats.own_goal || 0,
      p.stats.goal_cons || 0
    ]);

    // 3. Totals row calculation
    const teamTotals = calculateTotals();
    const totalsRow = [
      "إجمالي الفريق (TOTALS)",
      teamTotals.goals,
      teamTotals.assists,
      teamTotals.def_con,
      teamTotals.normal_saves,
      teamTotals.penalty_saves,
      teamTotals.penalty_miss,
      teamTotals.own_goal,
      teamTotals.goal_cons
    ];

    // 4. Combine headers, rows, and totals into standard CSV format with escaped double quotes
    const allLines = [headers, ...rows, totalsRow];
    const csvContent = allLines
      .map(line => line.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // 5. Create UTF-8 blob with BOM (\uFEFF) to make Arabic characters load flawlessly in Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // File name format
    const normalizedTeam = (teamName || "شياطين الجزيرة").trim().replace(/[\/\\?%*:|"<>\s]/g, "_");
    const today = new Date().toLocaleDateString('ar-EG').replace(/\//g, "-");
    link.setAttribute("download", `إحصائيات_مباراة_${normalizedTeam}_${today}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  let colorDotBg = "bg-[#10b981]";
  let rawColorHex = "#10b981";
  if (bgAccent && bgAccent.includes("bg-red-")) {
    colorDotBg = "bg-red-500";
    rawColorHex = "#ef4444";
  } else if (bgAccent && bgAccent.includes("bg-amber-")) {
    colorDotBg = "bg-amber-550 bg-amber-500";
    rawColorHex = "#f59e0b";
  } else if (bgAccent && bgAccent.includes("bg-cyan-")) {
    colorDotBg = "bg-cyan-500";
    rawColorHex = "#06b6d4";
  } else if (bgAccent && bgAccent.includes("bg-blue-")) {
    colorDotBg = "bg-blue-500";
    rawColorHex = "#3b82f6";
  }

  return (
    <div 
      ref={cardRef} 
      className="w-full flex flex-col bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl md:rounded-[2.5rem] p-4 md:p-6 shadow-2xl relative overflow-hidden animate-fade-in" 
      style={{ 
        width: isImageExporting ? "1024px" : "auto", 
        maxWidth: "none" 
      }}
      id="stats-dashboard-card"
    >
      
      {/* Decorative center radial background */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: rawColorHex }} />

      {/* Table Title, download and Mobile Hint */}
      {isImageExporting ? (
        <div className="w-full text-center py-2 flex flex-col items-center gap-1 border-b border-[#1c1c1c]/60 pb-4 mb-4" style={{ direction: "ltr" }}>
          <div className={`flex items-center gap-2 ${textAccent} font-black tracking-widest uppercase text-lg sm:text-xl`}>
            <Shield className="w-6 h-6 animate-pulse" style={{ color: rawColorHex }} />
            <span>{teamName || "شياطين الجزيرة"} • MATCH PERFORMANCE</span>
          </div>
          <span className="text-xs text-neutral-400 font-mono font-extrabold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-3 mb-4 border-b border-[#1c1c1c]/60 pb-3" style={{ direction: "rtl" }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full xl:w-auto">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-5 ${bgAccent} rounded-full`} />
              <h2 className="text-sm md:text-base font-extrabold text-white tracking-wide">
                إحصائيات فريق {teamName || "المنافس"} • {teamName || "Team"} Scorecard
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-neutral-400 font-medium bg-neutral-900 border border-neutral-850 px-2.5 py-1 rounded-full self-start leading-none">
              <Info className={`w-3 h-3 ${textAccent} shrink-0`} />
              <span>اسحب الجدول أفقياً للتصفح ↔</span>
            </div>
          </div>
          
          {players.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 xl:self-center self-stretch shrink-0">
              <button
                type="button"
                onClick={handleDownloadCSV}
                className={`flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 hover:${borderAccent} ${textAccent} hover:text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer`}
                id="download-csv-btn"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>تحميل ملف البيانات (CSV) 📥</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isImageExporting}
                className={`flex items-center justify-center gap-2 ${bgAccent} ${hoverAccent} disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-black text-xs px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-xl disabled:shadow-none`}
                id="download-image-btn"
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                <span>{isImageExporting ? "جاري تحضير الصورة... ⚡" : "تحميل الجدول كصورة (English) 📸"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-neutral-800 rounded-xl" id="empty-table-state" style={{ direction: "rtl" }}>
          <User className="w-12 h-12 text-neutral-600 mb-2 animate-pulse" />
          <p className="text-neutral-400 text-sm font-bold">لا يوجد لاعبون مسجلون حالياً.</p>
        </div>
      ) : (
        <div 
          className={`w-full ${isImageExporting ? "overflow-visible" : "overflow-x-auto rounded-xl border border-neutral-850 bg-[#090909]/40 custom-scrollbar"}`} 
          id="stats-responsive-wrapper"
        >
          <table className="w-full min-w-[850px] border-collapse text-center text-xs font-mono select-none" style={{ direction: "rtl" }}>
            <thead>
              <tr className="bg-[#0b0b0b] text-neutral-400 border-b border-neutral-900 headings-row">
                <th className="py-3 px-2 text-center border-l border-neutral-900/60 font-sans w-10 font-bold font-mono">#</th>
                <th className={`py-3 px-3 border-l border-neutral-900/60 font-sans text-right font-extrabold min-w-[130px] max-w-[150px] ${isImageExporting ? "" : "sticky right-0 bg-[#0b0b0b] z-10"}`}>
                  {isImageExporting ? "Player Name" : "اسم اللاعب"}
                </th>
                {Object.keys(statMetadata).map((key) => {
                  const statKey = key as keyof PlayerStats;
                  return (
                    <th key={statKey} className="py-3 px-2 border-l border-neutral-900/60 font-sans font-bold">
                      <span className="block text-white font-extrabold text-[10px] tracking-tight">{statMetadata[statKey].abbrev}</span>
                      {!isImageExporting && (
                        <span className="block text-[9px] text-neutral-400 font-normal mt-0.5">{statMetadata[statKey].ar}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => {
                const liveRating = calculatePlayerLiveRating(player);
                const ratingColors = getRatingColorClass(liveRating);
                return (
                  <tr 
                    key={player.id} 
                    className="hover:bg-neutral-900/20 transition-colors border-b border-neutral-900 players-row"
                  >
                    {/* Row index */}
                    <td className="py-3 px-2 text-center text-neutral-500 font-bold border-l border-neutral-900/40 bg-[#0b0b0b]/10 font-mono">
                      {index + 1}
                    </td>

                    {/* Player Name */}
                    <td className={`py-3 px-3 border-l border-neutral-900/40 text-right font-sans text-xs md:text-sm font-bold text-gray-200 ${isImageExporting ? "" : "sticky right-0 bg-[#0f0f0f] z-10"}`}>
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full ${colorDotBg} shrink-0`} />
                          <span className="truncate">{player.name}</span>
                        </div>
                        {!isImageExporting && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-black shrink-0 ${ratingColors.bg} ${ratingColors.text} border ${ratingColors.border}`}>
                            {liveRating.toFixed(1)} ⭐
                          </span>
                        )}
                      </div>
                    </td>

                  {/* Interactive Stats Cells */}
                  {Object.keys(statMetadata).map((key) => {
                    const statKey = key as keyof PlayerStats;
                    const val = player.stats[statKey] || 0;
                    return (
                      <td 
                        key={statKey} 
                        className={`py-2 px-1 border-l border-neutral-900/40 text-center transition-all ${
                          val > 0 
                            ? "bg-white/[0.015] font-bold" 
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 h-8 max-w-[90px] mx-auto">
                          {/* Decrement trigger */}
                          {!isImageExporting && (
                            <button
                              type="button"
                              onClick={() => onUpdateStat(player.id, statKey, -1)}
                              disabled={val <= 0}
                              className="w-5 h-5 rounded flex items-center justify-center bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-850 hover:border-red-500/20 disabled:opacity-20 disabled:hover:text-neutral-400 disabled:hover:bg-neutral-900/50 disabled:cursor-not-allowed text-[10px] cursor-pointer shrink-0 transition-colors"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Raw Value */}
                          <motion.span 
                            key={val}
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className={`w-5 text-center font-bold text-xs inline-block font-mono ${val > 0 ? textAccent : "text-neutral-600"}`}
                          >
                            {val}
                          </motion.span>

                          {/* Increment trigger */}
                          {!isImageExporting && (
                            <button
                              type="button"
                              onClick={() => onUpdateStat(player.id, statKey, 1)}
                              className={`w-5 h-5 rounded flex items-center justify-center bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:${textAccent} border border-neutral-850 hover:${borderAccent} text-[10px] cursor-pointer shrink-0 transition-colors`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )})}

              {/* Totals Row */}
              <tr className="bg-[#0b0b0b] text-white font-extrabold border-t-2 border-neutral-900 totals-bar">
                <td className="py-3 px-2 text-center border-l border-neutral-900/40 font-sans" colSpan={2}>
                  <div className={`flex items-center justify-start gap-1.5 ${textAccent}`}>
                    <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: rawColorHex }} />
                    <span className="font-bold text-xs">
                      {isImageExporting ? "TEAM TOTALS (TOTALS):" : "إجمالي الفريق (TOTALS):"}
                    </span>
                  </div>
                </td>
                {Object.keys(statMetadata).map((key) => {
                  const statKey = key as keyof PlayerStats;
                  const totalVal = totals[statKey] || 0;
                  return (
                    <td 
                      key={statKey} 
                      className={`py-3 px-2 border-l border-neutral-900/60 text-center text-xs font-black ${
                        totalVal > 0 ? `${textAccent} bg-white/[0.02]` : "text-neutral-600"
                      }`}
                    >
                      {totalVal}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Assistive Input Note */}
      {players.length > 0 && !isImageExporting && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-neutral-500 font-sans" style={{ direction: "rtl" }}>
          <Info className={`w-3.5 h-3.5 ${textAccent} shrink-0`} />
          <span>تظهر الإحصائيات تلقائياً بفضل الـ AI والتعرف الصوتي، مع إمكانية التعديل يدوياً في أي وقت.</span>
        </div>
      )}

    </div>
  );
}
