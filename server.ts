import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limit to handle base64 audio uploads
app.use(express.json({ limit: "25mb" }));

// Lazy initializer for Google GenAI to prevent start-up crashes if the key isn't provided yet
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it to Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient wrapping helper with automated retry logic, exponential backoff and model fallbacks
async function generateContentWithRetry(params: {
  model: string;
  contents: any;
  config?: any;
}, maxRetries = 3): Promise<any> {
  const modelsToTry = [params.model];
  if (params.model === "gemini-3.5-flash") {
    modelsToTry.push("gemini-flash-latest");
    modelsToTry.push("gemini-3.1-flash-lite");
  }

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    let attempt = 0;
    let delay = 1000; // start with 1 second delay
    
    while (attempt < maxRetries) {
      try {
        console.log(`[Gemini API] Requesting AI with model="${currentModel}" (attempt ${attempt + 1}/${maxRetries})`);
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        attempt++;
        lastError = err;
        const errorMessage = err.message || JSON.stringify(err) || "";
        
        const isQuotaExceeded = errorMessage.includes("302") || // just in case
                                errorMessage.includes("429") || 
                                errorMessage.includes("RESOURCE_EXHAUSTED") ||
                                errorMessage.includes("quota") ||
                                errorMessage.includes("Quota") ||
                                errorMessage.includes("limit") ||
                                errorMessage.includes("exceeded");
                                
        // Daily limits, free tier limits or resource exhaustions cannot be resolved by immediate retries
        const isDailyQuotaLimit = errorMessage.includes("Quota exceeded for metric") ||
                                 errorMessage.includes("current quota") ||
                                 errorMessage.includes("billing details") ||
                                 errorMessage.includes("GenerateRequestsPerDay") ||
                                 (errorMessage.includes("RESOURCE_EXHAUSTED") && !errorMessage.includes("RateLimit"));

        const isTransient = errorMessage.includes("503") || 
                            errorMessage.includes("UNAVAILABLE") || 
                            errorMessage.includes("demand") ||
                            errorMessage.includes("overloaded") ||
                            errorMessage.includes("temporary");

        if (isDailyQuotaLimit && modelsToTry.length > 1 && currentModel !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`[Gemini API] Model "${currentModel}" daily quota exhausted. Skipping remaining retries to proceed immediately to fallback.`);
          break; // Exit the while loop for this model to try the next model immediately
        }

        if ((isTransient || isQuotaExceeded) && attempt < maxRetries) {
          const waitTime = isQuotaExceeded ? delay * 2.5 : delay;
          console.warn(`[Gemini API] Temporary error or limit hit on model "${currentModel}" (attempt ${attempt}/${maxRetries}). Retrying in ${waitTime}ms... Error:`, errorMessage);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          delay = waitTime * 2; // exponential backoff
        } else {
          // Max retries reached or hard error for this model, fallback to next model
          console.error(`[Gemini API] Model "${currentModel}" failed or quota exhausted. Attempting next fallback model in line...`);
          break;
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models and fallback paths failed to return a response.");
}

// Normalize Arabic text to enable high-accuracy fuzzy/keyword matchups
function normalizeArabic(str: string): string {
  return str
    .replace(/[أإآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/\s+/g, " ")
    .replace(/[ًٌٍَُِّ]/g, "") // remove diacritics
    .trim();
}

// Rule-based Arabic NLP keyword parser for offline/temporary quota limitations
function localTextBackupParser(text: string, players: string[]): {
  transcription: string;
  success: boolean;
  unmatchedName?: string;
  events: Array<{
    player: string;
    stat: string;
    change: number;
    explanation: string;
  }>;
} {
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

  const events: any[] = [];
  
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
        explanation: explanation,
      });
    }

    return {
      transcription: textClean,
      success: true,
      events: events,
    };
  } else {
    // Best effort name extraction for unmatched entries
    const words = textClean.split(" ");
    const potentialName = words.find(w => w.length >= 3 && !["سجل", "هدف", "قطع", "صنع", "أسيست", "تصدى", "حارس"].includes(normalizeArabic(w))) || words[0] || "لاعب غير معروف";
    
    return {
      transcription: textClean,
      success: false,
      unmatchedName: potentialName,
      events: [],
    };
  }
}

// Dynamic Egyptian Coach Match Insights generator
function localMatchInsights(teamName: string, players: any[], events: any[]): string {
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
    mvpReason = `الهيمنة المطلقة بالتسجيل والصناعة اليوم، بجد شابوه يا عم الكل!`;
  } else if (topScorer) {
    mvp = topScorer;
    mvpReason = `إحراز هدف رائع هز الشباك ومثّل نقطة تحول أسطورية للفرقة!`;
  } else if (topGoalkeeper && maxSaves >= 3) {
    mvp = topGoalkeeper;
    mvpReason = `جدار تكتيكي حديدي وتصديه لـ ${maxSaves} كرات خطيرة منعوا أهداف محققة!`;
  } else if (topDefender && maxDef >= 3) {
    mvp = topDefender;
    mvpReason = `افتكاك الكرات وقهر مهاجمي الخصم بكل فدائية ورجولة في الخطوط الخلفية!`;
  } else if (topAssister) {
    mvp = topAssister;
    mvpReason = `توزيع الهدايا وصناعة الكرات الذهبية لزملائه بمهارة تفوق الخيال!`;
  }

  const matchSummary = events.length > 0 
    ? `كانت مباراة حامية الوطيس، تكللت بـ ${events.length} لقطات كروية أسطورية هزت الأرجاء وحركت المدرجات.`
    : "شهدت المباراة انضباطاً تكتيكياً ومحاولات استراتيجية حذرة للهيمنة وبناء الهجمات المنظمة.";

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
*💡 ملاحظة: تم تفعيل نظام التحليل الرياضي الإحصائي المحلي والذكي لضمان استمرارية الإحصائيات بكفاءة عالية دائمًا لتخطي قيود الحوسبة السحابية المؤقتة.*`;
}

// REST API Endpoints

// Heartbeat
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Process voice action with Gemini
app.post("/api/process-audio", async (req, res) => {
  try {
    const { audio, mimeType, players } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Missing sound data" });
    }
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "No players list provided for fuzzy routing" });
    }
    
    // Prepare Audio block
    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: audio,
      },
    };

    const promptText = `
أنت مسجل إحصائيات مباريات ذكي لمشروع "الكورة" (El-Kawera).
قم بتحليل الصوت المسجل بدقة واستخرج الحدث الكروي وقم بمطابقته بأسماء اللاعبين المسجلين في هذا الماتش.

مسرد اللاعبين المسجلين في هذه المباراة (استخدمهم فقط للمطابقة، وحاول التقريب في حالة اللكنة أو الهمزة أو ال التعريف):
[${players.join(", ")}]

المهام المطلوبة منك:
1. قم بنسخ الكلام المسجل صوتياً بدقة باللغة العربية (transcription).
2. حدد اللاعب الذي قام بالحدث، ومواصفات الحدث الرياضي.
3. طابق الحدث بأحد المفاتيح الإحصائية الرسمية التالية بدقة:
   - "goals" : تسجيل هدف (جون / هدف / أحرز هدف)
   - "assists" : صناعة هدف (أسيست / مرر لعمر جاب جول / صنع جول)
   - "def_con" : إسهام دفاعي (قطع كورة / افتكاك / تشتيت دفاعي / دفاع رائع / عرقلة نظيفة / ضغط ناجح)
   - "normal_saves" : تصدي عادي لحارس المرمى (شال الكورة / صد الكروة / حارس مسك الكورة)
   - "penalty_saves" : تصدي لضربة جزاء (صد ضربة جزاء / بلنتي ضاع بصد الحارس)
   - "penalty_miss" : إضاعة ضربة جزاء (ضيع ضربة جزاء / رماها برا / البلنتي ضاع في القائم)
   - "own_goal" : هدف عكسي في مرماه (أحرز هدف في مرماه / سجل بالخطأ في فريقه)
   - "goal_cons" : استقبال هدف في الحارس (دخل فيه جول / استقبل هدف)

قواعد هامة جداً:
- إذا قال المستخدم "عمر سجل جول بمساعدة أحمد"، فيجب توجيه (+1 goals) للاعب عمر، وتوجيه (+1 assists) للاعب أحمد.
- إذا لم تذكر الكلمة اسم لاعب مسجل أو كان لاعب غير معروف، اكتب اسمه في "unmatchedName" واجعل الـ "success" قيمتها false.
- قم بعمل مطابقة مرنة (fuzzy match) للأسماء، مثلاً: "احمد" تطابق "أحمد"، "ابو الدهب" تطابق "أبو الدهب"، "ميدو" تطابق "محمد" إذا كان وحيداً وهكذا.
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [audioPart, { text: promptText }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: {
              type: Type.STRING,
              description: "النص المنقول من الصوت بدقة باللغة العربية",
            },
            success: {
              type: Type.BOOLEAN,
              description: "هل تم استخلاص حدث حقيقي بنجاح لأحد اللاعبين؟",
            },
            unmatchedName: {
              type: Type.STRING,
              description: "اسم اللاعب الذي لم نتمكن من مطابقته بقائمة اللاعبين الرسمية إذا وجد",
            },
            events: {
              type: Type.ARRAY,
              description: "الأحداث الرياضية المستخلصة الناتجة عن التفريغ",
              items: {
                type: Type.OBJECT,
                properties: {
                  player: {
                    type: Type.STRING,
                    description: "الاسم المطابق للاعب من القائمة المسجلة حصراً",
                  },
                  stat: {
                    type: Type.STRING,
                    description: "المفتاح الإحصائي: goals, assists, def_con, normal_saves, penalty_saves, penalty_miss, own_goal, goal_cons",
                  },
                  change: {
                    type: Type.INTEGER,
                    description: "مقدار التغير الرقمي للمهارة (عادة 1)",
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "شرح مبسط وممتع باللغة العربية للحدث (مثال: أحرز عمر هدف رائع)",
                  },
                },
                required: ["player", "stat", "change", "explanation"],
              },
            },
          },
          required: ["transcription", "success", "events"],
        },
      },
    });

    const outputText = response.text || "{}";
    res.json(JSON.parse(outputText));
  } catch (err: any) {
    console.error("Error processing audio in backend, returning graceful quota fallback response:", err);
    const errorMessage = err.message || JSON.stringify(err) || "";
    const isQuotaOrTransient = errorMessage.includes("429") || 
                               errorMessage.includes("RESOURCE_EXHAUSTED") || 
                               errorMessage.includes("quota") || 
                               errorMessage.includes("Quota") ||
                               errorMessage.includes("503") || 
                               errorMessage.includes("UNAVAILABLE") ||
                               errorMessage.includes("limit");
    
    // Return a 200 OK graceful response indicating audio couldn't be parsed, but avoiding queue blocking 
    res.json({
      transcription: "[حصة صوتية معطلة مؤقتاً]",
      success: false,
      unmatchedName: isQuotaOrTransient 
        ? "تعذر معالجة الصوت لامتلاء حصة الخادم المجانية اليوم. برجاء كتابة الحدث يدوياً لتسجيله بنجاح!"
        : "عذراً، لم تكتمل معالجة الصوت بالذكاء الاصطناعي بسبب مشاكل بالاتصال السحابي.",
      events: []
    });
  }
});

// Process text action with Gemini (Text fallback in case microphone is disabled or in noisy setup)
app.post("/api/process-text", async (req, res) => {
  const { text, players } = req.body;
  try {
    if (!text) {
      return res.status(400).json({ error: "Missing text instruction" });
    }
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "No players list provided for fuzzy routing" });
    }

    const promptText = `
أنت مسجل إحصائيات مباريات ذكي لمشروع "الكورة" (El-Kawera).
قم بتحليل النص المدخل بدقة واستخرج الحدث الكروي وقم بمطابقته بأسماء اللاعبين المسجلين في هذا الماتش.

مسرد اللاعبين المسجلين في هذه مباراة (استخدمهم فقط للمطابقة، وحاول التقريب):
[${players.join(", ")}]

النص المدخل من قبل المستخدم:
"${text}"

المهام المطلوبة منك:
1. حدد اللاعب الذي قام بالحدث، ومواصفات الحدث الرياضي.
2. طابق الحدث بأحد المفاتيح الإحصائية الرسمية التالية بدقة:
   - "goals" : تسجيل هدف
   - "assists" : صناعة هدف (أسيست)
   - "def_con" : إسهام دفاعي (افتکاک / قطع كورة)
   - "normal_saves" : تصدي عادي لحارس المرمى
   - "penalty_saves" : تصدي لضربة جزاء
   - "penalty_miss" : إضاعة ضربة جزاء
   - "own_goal" : هدف عكسي في مرماه
   - "goal_cons" : استقبال هدف في الحارس

قوانين هامة:
- إذا كانت الجملة "عمر سجل جول بمساعدة أحمد"، فيجب توجيه (+1 goals) للاعب عمر، وتوجيه (+1 assists) للاعب أحمد.
- إذا لم تذكر الجملة اسم لاعب مسجل أو كان لاعب غير معروف، اكتب اسمه في "unmatchedName" واجعل الـ "success" قيمتها false.
- قم بعمل مطابقة مرنة (fuzzy match) للأسماء.
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [{ text: promptText }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.0,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: {
              type: Type.STRING,
              description: "النص المعالج كما هو",
            },
            success: {
              type: Type.BOOLEAN,
              description: "هل تم استخلاص حدث حقيقي بنجاح لأحد اللاعبين؟",
            },
            unmatchedName: {
              type: Type.STRING,
              description: "اسم اللاعب الذي لم نتمكن من مطابقته إذا وجد",
            },
            events: {
              type: Type.ARRAY,
              description: "الأحداث الرياضية المستخلصة",
              items: {
                type: Type.OBJECT,
                properties: {
                  player: {
                    type: Type.STRING,
                    description: "الاسم المطابق للاعب من القائمة المسجلة",
                  },
                  stat: {
                    type: Type.STRING,
                    description: "goals, assists, def_con, normal_saves, penalty_saves, penalty_miss, own_goal, goal_cons",
                  },
                  change: {
                    type: Type.INTEGER,
                    description: "مقدار التغير الرقمي للمهارة",
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "شرح مبسط وممتع باللغة العربية للحدث",
                  },
                },
                required: ["player", "stat", "change", "explanation"],
              },
            },
          },
          required: ["transcription", "success", "events"],
        },
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    console.warn("Error processing text in backend. Falling back to high-performance local NLP fuzzy parser...", err);
    try {
      const localResult = localTextBackupParser(text, players);
      // Prepend electric symbol to differentiate local real-time processing
      localResult.transcription = `⚡ ${localResult.transcription}`;
      return res.json(localResult);
    } catch (fallbackErr) {
      console.error("Extreme fallback text error:", fallbackErr);
      return res.status(200).json({
        transcription: text,
        success: false,
        unmatchedName: "حدث خطأ غير متوقع أثناء المعالجة البديلة",
        events: []
      });
    }
  }
});

// Generate professional match statistics insight and Twin-Coach/Match summaries in Arabic
app.post("/api/generate-insights", async (req, res) => {
  const { teamNameA, playersA, teamNameB, playersB, events } = req.body;
  try {
    const formattedPlayersA = (playersA || [])
      .map((p: any) => {
        const s = p.stats || {};
        return `- ${p.name}: أهداف [${s.goals || 0}], أسيست [${s.assists || 0}], دفاع [${s.def_con || 0}], تصديات حارس [${s.normal_saves || 0}], تصدي جزائيات [${s.penalty_saves || 0}], إضاعة جزائيات [${s.penalty_miss || 0}], هدف عكسي [${s.own_goal || 0}], أهداف مستقبلة [${s.goal_cons || 0}]`;
      })
      .join("\n");

    const formattedPlayersB = (playersB || [])
      .map((p: any) => {
        const s = p.stats || {};
        return `- ${p.name}: أهداف [${s.goals || 0}], أسيست [${s.assists || 0}], دفاع [${s.def_con || 0}], تصديات حارس [${s.normal_saves || 0}], تصدي جزائيات [${s.penalty_saves || 0}], إضاعة جزائيات [${s.penalty_miss || 0}], هدف عكسي [${s.own_goal || 0}], أهداف مستقبلة [${s.goal_cons || 0}]`;
      })
      .join("\n");

    const formattedEvents = (events || [])
      .map((ev: any) => `[${ev.timestamp}] ${ev.explanation} (${ev.transcription})`)
      .join("\n");

    const promptText = `
أنت محلل رياضي محترف ومديران فنيان متميزان وعريقان في كرة القدم المصرية.
أمامك التقرير الرقمي الشامل للمباراة وجدول الأحداث المشترك لكلا الفريقين:
الفريق الأول (صاحب الأرض): "${teamNameA || "الفريق الأول"}"
كتيبة الفريق الأول إحصائياً:
${formattedPlayersA}

الفريق الثاني (الضيف): "${teamNameB || "الفريق الثاني"}"
كتيبة الفريق الثاني إحصائياً:
${formattedPlayersB}

شريط أحداث وتفاصيل اللقاء كاملاً:
${formattedEvents}

المطلوب منك تحليل اللقاء بدقة متناهية وإرسال الإجابة بصيغة JSON نظيفة جداً تحتوي على العناصر التالية باللغة العربية:
1. "matchSummary": تقرير فني شامل وممتع ومحايد يسرد مجريات الماتش وما حدث فيه لكلا الفريقين ككل (شرح أحداث وتغير اللقاء والروح الرياضية والندية)، مع استبعاد رأي أو اقتباسات المدربين الفنيين تماماً من هذه الفقرة.
2. "insightsA": تقرير الأداء والمدير الفني لـ "${teamNameA || "الفريق الأول"}" بأسلوب طريف وتحفيزي ومصري أصيل (نقاط قوتهم، نقاط ضعفهم، وتوجيهات الكابتن للتمارين القادمة وجملة مشعلة للحماس).
3. "insightsB": تقرير الأداء والمدير الفني لـ "${teamNameB || "الفريق الثاني"}" بأسلوب طريف وتحفيزي ومصري أصيل (نقاط قوتهم، نقاط ضعفهم، وتوجيهات الكابتن للتمارين القادمة وجملة مشعلة للحماس).
4. "overallMvpName": الاسم لمطابقة أفضل لاعب (MVP) على الإطلاق في هذه مباراة من بين الفريقين.
5. "overallMvpReason": تعليق ممتع وكوميدي يوضح لماذا يستحق الجائزة بناءً على أرقامه وإحصائياته الليلة.
6. "overallMvpTeam": اسم الفريق الذي ينتمي إليه بطل اللقاء (إما "${teamNameA}" أو "${teamNameB}").

الرجاء عدم تهيئة أي نص خارج صيغة الـ JSON المطلوبة.
`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: [{ text: promptText }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchSummary: {
              type: Type.STRING,
              description: "تقرير فني عام وشامل لوصف مجريات المباراة لكلتا الفرقتين بالتفصيل دون أي ذكر لآراء أو تقرير المدرب الفني."
            },
            insightsA: {
              type: Type.STRING,
              description: "تقرير تقييم الأداء والمدير الفني لفريق A بأسلوبه."
            },
            insightsB: {
              type: Type.STRING,
              description: "تقرير تقييم الأداء والمدير الفني لفريق B بأسلوبه."
            },
            overallMvpName: {
              type: Type.STRING,
              description: "اسم رجل المباراة الكلي الحقيقي."
            },
            overallMvpReason: {
              type: Type.STRING,
              description: "شرح كوميدي ومحترف لتبرير اختيار اللاعب كرجل الماتش."
            },
            overallMvpTeam: {
              type: Type.STRING,
              description: "اسم فريق اللاعب الفائز."
            }
          },
          required: ["matchSummary", "insightsA", "insightsB", "overallMvpName", "overallMvpReason", "overallMvpTeam"]
        }
      }
    });

    const outputText = response.text || "{}";
    res.json(JSON.parse(outputText));
  } catch (err: any) {
    console.warn("Error generating dual insights in backend, falling back to local twin-coach analyzer...", err);
    try {
      const fbResult = localGenerateMatchInsightsDual(
        teamNameA || "الفريق الأول",
        playersA || [],
        teamNameB || "الفريق الثاني",
        playersB || [],
        events || []
      );
      return res.json(fbResult);
    } catch (fallbackErr) {
      console.error("Extreme insight fallback error:", fallbackErr);
      return res.status(500).json({
        error: "عذراً، لم نتمكن من توليد التحليل الكلي حالياً.",
        matchSummary: "المباراة انتهت وأبهرنا اللاعبون بمستواهم العالي والبحث مستمر عن تطوير المهارات التكتيكية.",
        insightsA: "فخور بالرجالة وتصميمهم في الملعب.",
        insightsB: "مستوى طيب، والقابل أفضل بالعمل الجماعي.",
        overallMvpName: "الجميع",
        overallMvpReason: "بسبب الروح الطيبة والتعاون.",
        overallMvpTeam: "اللقاء ككل"
      });
    }
  }
});

// Helper for local dual insights generation fallback
function localGenerateMatchInsightsDual(
  teamNameA: string,
  playersA: any[],
  teamNameB: string,
  playersB: any[],
  events: any[]
) {
  let bestPlayerName = "";
  let bestPlayerTeam = "";
  let bestPlayerScore = -999;
  let maxGoals = 0;

  const findStats = (players: any[], tName: string) => {
    (players || []).forEach((p: any) => {
      const s = p.stats || {};
      const score = 
        (s.goals * 4) + 
        (s.assists * 3) + 
        (s.def_con * 1.5) +  
        (s.normal_saves * 1.5) + 
        (s.penalty_saves * 3) - 
        (s.penalty_miss * 2) - 
        (s.own_goal * 3) - 
        (s.goal_cons * 1);

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
- **كلمة الكابتن**: "أداء تكتيكي عالي جداً يا رجالة! لعبنا بروح وحماس وسيطرنا في أوقات حاسمة. التمرين الجاي هنركز على سرعة كرات المرتدات وقفل الأطراف تمماً."`;

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

// Catch-all Express JSON error handler to prevent returning HTML on backend errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global express error caught:", err);
  res.status(err.status || 500).json({
    error: err.message || "عذراً، حدث خطأ داخلي في الخادم",
    details: process.env.NODE_ENV !== "production" ? err.stack : undefined
  });
});

// Vite middleware setup to mount or serve the front-end application
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
  });
}

startServer();
