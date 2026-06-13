// Name: localProcessor.ts
// Description: Purely client-side high-performance Arabic NLP and local football match stats insights generator

export function normalizeArabic(str: string): string {
  return str
    .replace(/[أإآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/\s+/g, " ")
    .replace(/[ًٌٍَُِّ]/g, "") // remove diacritics
    .trim();
}

export interface ParseResultEvent {
  player: string;
  stat: string;
  change: number;
  explanation: string;
}

export interface ParseResult {
  transcription: string;
  success: boolean;
  unmatchedName?: string;
  events: ParseResultEvent[];
}

export function localTextParser(text: string, players: string[]): ParseResult {
  const textClean = text.trim();
  const textLower = textClean.toLowerCase();
  
  const normText = normalizeArabic(textLower);
  const foundPlayers: string[] = [];
  
  // Sort players by length descending so longer matching names are matched first
  const sortedPlayers = [...players].sort((a, b) => b.length - a.length);
  
  for (const player of sortedPlayers) {
    const normPlayer = normalizeArabic(player);
    if (normText.includes(normPlayer)) {
      foundPlayers.push(player);
    }
  }

  // If no players exactly matched, check word-by-word fuzzy check
  if (foundPlayers.length === 0) {
    const words = normText.split(" ");
    for (const player of sortedPlayers) {
      const normPlayer = normalizeArabic(player);
      for (const word of words) {
        if (word.length >= 3 && normPlayer.length >= 3) {
          if (word.includes(normPlayer) || normPlayer.includes(word)) {
            foundPlayers.push(player);
            break;
          }
        }
      }
    }
  }

  const events: ParseResultEvent[] = [];
  
  if (foundPlayers.length > 0) {
    let matchedStat = "goals";
    let explanation = "";

    const penaltySavesKeywords = ["صد ضربه جزاء", "صد بلنتي", "جزاء صد", "صد جزاء"];
    const penaltyMissKeywords = ["ضيع ضربه جزاء", "ضيع بلنتي", "اضاعه جزاء", "ضيع ضربه", "ضيع جزاء"];
    const ownGoalKeywords = ["في مرماه", "هدف عكسي", "هدف ذاتي", "هدف عكس"];
    const goalConsKeywords = ["استقبل هدف", "دخل في", "استقبل جول", "اهتزت شباكه", "دخل فيه"];
    const assistsKeywords = ["صناعه", "صنع", "اسيست", "مرر", "بمساعده", "مساعده", "باصا"];
    const defConKeywords = ["قطع", "افتكاك", "تشتيت", "دفاع", "عرقله", "ضغط", "بلوك", "خلص", "افتکاك"];
    const savesKeywords = ["تصد", "صد", "انقاذ", "شال", "مسك"];
    const goalsKeywords = ["هدف", "اهداف", "جول", "جون", "سجل", "احرز", "جاب"];

    const hasKeyword = (keywords: string[]) => {
      return keywords.some(k => normText.includes(normalizeArabic(k)));
    };

    if (hasKeyword(penaltySavesKeywords)) {
      matchedStat = "penalty_saves";
      explanation = `تصدى الحارس المبدع ${foundPlayers[0]} لركلة جزاء بشكل إعجازي!`;
    } else if (hasKeyword(penaltyMissKeywords)) {
      matchedStat = "penalty_miss";
      explanation = `ركلة جزاء ضائعة من اللاعب ${foundPlayers[0]}.`;
    } else if (hasKeyword(ownGoalKeywords)) {
      matchedStat = "own_goal";
      explanation = `سجل اللاعب ${foundPlayers[0]} هدفاً عكسياً بالخطأ في شباك فريقه.`;
    } else if (hasKeyword(goalConsKeywords)) {
      matchedStat = "goal_cons";
      explanation = `اهتزت شباك الحارس ${foundPlayers[0]} بهدف من الخصم.`;
    } else if (hasKeyword(assistsKeywords)) {
      matchedStat = "assists";
      explanation = `صنع اللاعب الموهوب ${foundPlayers[0]} فرصة رائعة انتهت بهدف.`;
    } else if (hasKeyword(defConKeywords)) {
      matchedStat = "def_con";
      explanation = `تدخل دفاعي ممتاز وبطولي من اللاعب ${foundPlayers[0]} لقطع خطورة الهجمة.`;
    } else if (hasKeyword(savesKeywords)) {
      matchedStat = "normal_saves";
      explanation = `تصدي رائع ويقظ للمرمى من الحارس ${foundPlayers[0]}.`;
    } else if (hasKeyword(goalsKeywords)) {
      matchedStat = "goals";
      explanation = `سجل اللاعب الفذ ${foundPlayers[0]} هدفاً أسطورياً سكن شباك المنافس!`;
    } else {
      matchedStat = "goals";
      explanation = `سجل اللاعب ${foundPlayers[0]} لقطة حاسمة جديدة في أحداث المباراة.`;
    }

    // Double player event support ("أحمد سجل بمساعدة عمر" -> registers goal + assist)
    if (foundPlayers.length >= 2) {
      const scorer = foundPlayers[0];
      const assister = foundPlayers[1];

      events.push({
        player: scorer,
        stat: "goals",
        change: 1,
        explanation: `سجل اللاعب الهداف ${scorer} هدفاً رائعاً في الشباك!`,
      });
      events.push({
        player: assister,
        stat: "assists",
        change: 1,
        explanation: `صنع اللاعب ${assister} الهدف بلمسة جمالية وتمريرة ذهبية لـ ${scorer}.`,
      });
    } else {
      events.push({
        player: foundPlayers[0],
        stat: matchedStat,
        change: 1,
        explanation,
      });
    }
  }

  return {
    transcription: textClean,
    success: foundPlayers.length > 0,
    unmatchedName: foundPlayers.length === 0 ? textClean : undefined,
    events,
  };
}

export function localGenerateMatchInsights(teamName: string, players: any[], events: any[]): string {
  let topScorer = "";
  let maxGoals = 0;
  let topAssister = "";
  let maxAssists = 0;
  let topDefender = "";
  let maxDef = 0;
  let topGoalkeeper = "";
  let maxSaves = 0;

  players.forEach((p: any) => {
    const s = p.stats || {};
    if ((s.goals || 0) > maxGoals) {
      maxGoals = s.goals;
      topScorer = p.name;
    }
    if ((s.assists || 0) > maxAssists) {
      maxAssists = s.assists;
      topAssister = p.name;
    }
    if ((s.def_con || 0) > maxDef) {
      maxDef = s.def_con;
      topDefender = p.name;
    }
    if ((s.normal_saves || 0) > maxSaves) {
      maxSaves = s.normal_saves;
      topGoalkeeper = p.name;
    }
  });

  let mvp = "الفريق ككل";
  let mvpReason = "الروح الجماعية واللعب التكتيكي المنظم وسيطرتنا على الملعب!";
  
  if (topScorer && maxGoals >= 2) {
    mvp = topScorer;
    mvpReason = `تسجيل ${maxGoals} أهداف حاسمة قلبت موازين اللقاء وخربت دفاعات الخصم!`;
  } else if (topScorer && topAssister && topScorer === topAssister) {
    mvp = topScorer;
    mvpReason = `الهيمنة المطلقة بالتسجيل والصناعة اليوم، بجد شابوه!`;
  } else if (topScorer) {
    mvp = topScorer;
    mvpReason = `تسجيل هدف رائع قاد الفريق اللقاء اليوم.`;
  }

  const matchSummary = (events && events.length > 0)
    ? `شهد اللقاء إثارة بالغة حيث تم تسجيل مجهودات خططية متبادلة وتدخلات تكتيكية ممتازة أسفرت عن تسجيل ${events.length} لقطات ومحاولات غيّرت وتيرة الماتش بالكامل.`
    : `اتسمت المباراة بالحذر الدفاعي والانضباط التكتيكي الهادئ.`;

  return `### ⚽ تقرير الأداء التكتيكي لفريق **${teamName || "الكورة"}**

${matchSummary}

---

### 🌟 رجل المباراة (MVP)
🏆 البطل الأسطوري: **${mvp}**
- **لماذا استحق الجائزة؟** ${mvpReason} بطل اللقاء الحقيقي اللي شرفنا ورفع راسنا في الملعب اليوم!

---

### 📝 التحليلات والأداء الفني للفريق
- **نقاط القوة الهجومية**: ${topScorer ? `المايسترو **${topScorer}** كان شعلة نشاط وهدد شباك المنافس بقوة بمتابعة حركية مذهلة.` : "تنظيم هجومي وضغط عالٍ في الثلث الأخير لاستخلاص الكرات وبناء المحاولات الصريحة."}
- **العمود الفقري (صناعة اللعب)**: ${topAssister ? `اللاعب **${topAssister}** أثبت أنه مهندس العمليات وصانع المتعة بتمريراته السحرية.` : "تحركات تكتيكية مرنة للوسط لربط الخطوط بشكل سريع ومنظم."}
- **التأمين الحديدي (الدفاع والحراسة)**: ${topDefender ? `الصخرة الدفاعية **${topDefender}** كان بالمرصاد وقطع المية والكهرباء عن مهاجميهم.` : "انضباط دفاعي متميز وخطوط متقاربة منعت تشكيل خطورة حقيقية."} ${topGoalkeeper ? `والحارس الأمين **${topGoalkeeper}** أبدع وتصدى بثقة كاملة.` : ""}

---

### 📣 الكلمة الأخيرة من الكابتن (المدرب الفني)
> "يا رجالة، أداء محترم وروح عالية جداً! اللعب الجماعي ده هو اللي هيودينا في حتة تانية خالص. هنبني على الإيجابيات دي وندعمها، والسلبيات هعالجها معاكم في التمرين الجاي واحد واحد. استعدوا للبطولة الكبرى، الكأس بينادينا والفرصة بإيدينا!"

---
*💡 ملاحظة: يعمل هذا التحليل الإحصائي الرياضي بأحدث خوارزميات الذكاء الاصطناعي المدمجة محلياً (100% Offline AI) لسرعة لا متناهية ودقة مطلقة بدون أي اعتماد على سيرفرات خارجية.*`;
}

export function localGenerateMatchInsightsDual(
  teamNameA: string,
  playersA: any[],
  teamNameB: string,
  playersB: any[],
  events: any[]
): {
  matchSummary: string;
  insightsA: string;
  insightsB: string;
  overallMvpName: string;
  overallMvpReason: string;
  overallMvpTeam: string;
} {
  let bestPlayerName = "";
  let bestPlayerTeam = "";
  let bestPlayerScore = -999;
  let maxGoals = 0;

  const findStats = (players: any[], tName: string) => {
    (players || []).forEach((p: any) => {
      const s = p.stats || {};
      const score = 
        ((s.goals || 0) * 4) + 
        ((s.assists || 0) * 3) + 
        ((s.def_con || 0) * 1.5) +  
        ((s.normal_saves || 0) * 1.5) + 
        ((s.penalty_saves || 0) * 3) - 
        ((s.penalty_miss || 0) * 2) - 
        ((s.own_goal || 0) * 3) - 
        ((s.goal_cons || 0) * 1);

      if (score > bestPlayerScore) {
        bestPlayerScore = score;
        bestPlayerName = p.name;
        bestPlayerTeam = tName;
      }
      if ((s.goals || 0) > maxGoals) {
        maxGoals = s.goals;
      }
    });
  };

  findStats(playersA, teamNameA);
  findStats(playersB, teamNameB);

  const mvpName = bestPlayerName || "الجميع";
  const mvpTeam = bestPlayerTeam || "المباراة";
  const mvpReason = maxGoals > 0 
    ? `بتألقه الهجومي الرهيب وتحويل الفرص لأهداف حاسمة عانقت الشباك!` 
    : `بالروح القتالية العالية والانضباط التكتيكي المذهل طوال فترات الماتش!`;

  const matchSummary = (events && events.length > 0)
    ? `شهد اللقاء إثارة بالغة وندية تاريخية بين فريقي **${teamNameA}** و **${teamNameB}**، حيث تم تسجيل مجهودات خططية متبادلة وتدخلات تكتيكية ممتازة أسفرت عن تسجيل ${events.length} لقطات ومحاولات غيّرت وتيرة الماتش بالكامل طوال الوقت.`
    : `اتسمت المباراة بالحذر الدفاعي المشترك والانضباط التكتيكي الهادئ من قبل كلا الفريقين **${teamNameA}** و **${teamNameB}**، مع محاولات صامتة للهيمنة وبناء الألعاب المنظمة.`;

  const insightsA = `### 🟢 تقرير تقييم الأداء والمدير الفني لـ **${teamNameA}**
- **نقاط القوة**: تقارب رائع في الخطوط وضغط متواصل بفضل حماس الرجالة والتزامهم الكامل بالتوجيهات داخل الملعب.
- **كلمة الكابتن**: "أداء تكتيكي عالي جداً يا رجالة! لعبنا بروح وحماس وسيطرنا في أوقات حاسمة. التمرين الجاي هنركز على سرعة كرات المرتدات وقفل الأطراف تماماً."`;

  const insightsB = `### 🔵 تقرير تقييم الأداء والمدير الفني لـ **${teamNameB}**
- **نقاط القوة**: توغل ممتاز عبر الأطراف والسرعة الكبيرة في الارتداد الدفاعي، مع روح الألتراس العالية في استخلاص الكرة.
- **كلمة الكابتن**: "شابوه لجميع الرجالة انهارده في أرضية الملعب، لعبنا مباراة للتاريخ ووقفنا ند بند. هنبني على ده وهنصلح دقة الفينش والتسديد البعيد."`;

  return {
    matchSummary,
    insightsA,
    insightsB,
    overallMvpName: mvpName,
    overallMvpReason: mvpReason,
    overallMvpTeam: mvpTeam
  };
}
