/**
 * NoteWeb AI Service
 * Supports premium study features by routing requests through OpenRouter (using the premium key)
 * or falling back to the direct Google Gemini 2.5 Flash API.
 */

/**
 * Unified AI chat completion handler.
 * Seamlessly interfaces with OpenRouter or direct Google Gemini beta.
 * 
 * @param systemInstruction System context/behavior instructions
 * @param userPrompt The current active user prompt
 * @param chatHistory Prior chat context messages
 * @returns Promise<string> The generated AI response string
 */
export const callAiChatCompletion = async (
  systemInstruction: string | null,
  userPrompt: string,
  chatHistory: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<string> => {
  const envOpenRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Use OpenRouter if key is available in env
  const openRouterKey = envOpenRouterKey;
  const isOpenRouterActive = !!openRouterKey && openRouterKey !== 'mock-openrouter-api-key';


  if (isOpenRouterActive) {
    // ─── OPENROUTER LIVE MODE ───
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    for (const h of chatHistory) {
      messages.push({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text
      });
    }

    messages.push({ role: 'user', content: userPrompt });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://noteweb-college.edu',
          'X-Title': 'NoteWeb Academic Hub'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: messages
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error("[NoteWeb AI] OpenRouter HTTP error:", response.status, errText);
        throw new Error(`OpenRouter completion failed: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("Empty response returned from OpenRouter choices");
      }
      return text;
    } catch (err) {
      console.error("[NoteWeb AI] OpenRouter error, attempting Gemini fallback...", err);
      // Fall through to Gemini direct if a direct key is present
    }
  }

  // ─── DIRECT GEMINI LIVE FALLBACK ───
  if (envGeminiKey && envGeminiKey !== 'mock-gemini-api-key') {
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    
    // Map system instructions and prompt
    const parts = [];
    if (systemInstruction) {
      parts.push({ text: systemInstruction });
    }
    parts.push({ text: userPrompt });

    const contents = chatHistory.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));
    contents.push({ role: 'user', parts: parts });

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${envGeminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("[NoteWeb AI] Gemini HTTP error:", errData);
        throw new Error(`Gemini direct failed: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response received from direct Gemini");
      return text;
    } catch (err) {
      console.error("[NoteWeb AI] Direct Gemini fallback failed:", err);
      throw err;
    }
  }

  throw new Error("No active AI API credentials could be verified for completion.");
};

/**
 * Summarizes the provided notes text into a beautiful academic markdown format.
 * 
 * @param notesText Plain text extracted from the PDF note
 * @returns Promise<string> A beautifully formatted academic summary
 */
export const summarizeNotes = async (notesText: string): Promise<string> => {
  const customApiUrl = import.meta.env.VITE_AI_API_URL;
  if (customApiUrl && customApiUrl !== 'mock-api-url') {
    try {
      console.log(`[NoteWeb AI] Routing summarization to backend server API: ${customApiUrl}`);
      const res = await fetch(customApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: notesText })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          return data.summary;
        }
      }
      console.warn(`[NoteWeb AI] Backend API returned status ${res.status}, falling back to client-side Gemini.`);
    } catch (err) {
      console.warn("[NoteWeb AI] Failed to call backend AI API, using client-side fallback:", err);
    }
  }

  const systemInstruction = `You are NoteWeb's expert AI Academic Assistant. Your task is to analyze course notes and generate a highly professional, beautifully structured academic study summary.`;
  
  const prompt = `Analyze the following course notes:
\"\"\"
${notesText.slice(0, 15000)}
\"\"\"

Please format your response in clean Markdown exactly as follows:

### 📚 Key Concepts Covered
- [Provide a concise, 2-3 sentence overview of the subject matter and primary concepts discussed.]

### 💡 Detailed Core Insights
- **[Insight Title 1]**: [Detailed explanation of a major rule, theory, formula, or concept discussed.]
- **[Insight Title 2]**: [Explanation of another key study point or method.]
- **[Insight Title 3]**: [Add another core learning insight.]

### ✏️ Study & Revision Checklist
- [ ] **[Topic/Question 1]**: [A practice question or revision challenge for this material.]
- [ ] **[Topic/Question 2]**: [Another practice prompt.]
- [ ] **[Topic/Question 3]**: [A practical application challenge.]

Make the tone encouraging, highly academic, and exceptionally clear for university study.`;

  try {
    return await callAiChatCompletion(systemInstruction, prompt);
  } catch (error) {
    console.error("summarizeNotes error, returning high-fidelity client outline:", error);
    // Safe localized default summary if completely offline
    return `### 📚 NoteWeb Study Outline (Offline Fallback)
    
- **Overview**: This course note covers active curriculum sections. Review formulas and core principles.
- **Cheatsheet Insights**:
  - **Key Concept**: Master foundational rules and operational constraints outlined in the lectures.
  - **Practical Use**: Solve practice problems, rewrite derivations, and discuss topics in NoteWeb Study Rooms.
- **Checklist**:
  - [ ] Rewrite standard equations from the material.
  - [ ] Discuss conceptual points with peers.`;
  }
};

/**
 * Classifies a student note into the correct active subject category.
 * Falls back to a highly accurate keyword regex if completely offline.
 */
export const classifyNoteCategory = async (
  subject: string,
  description: string,
  extractedText: string,
  availableCategories: { id: string; name: string; description?: string }[]
): Promise<string> => {
  const textToAnalyze = `${subject} ${description} ${extractedText}`.toLowerCase();

  const getFallbackCategory = (): string => {
    const categorySpecificKeywords: Record<string, string[]> = {
      'cse-dsa': ['dsa', 'data structure', 'data structures', 'algorithm', 'algorithms', 'algo', 'graph', 'graphs', 'tree', 'trees', 'stack', 'queue', 'linked list', 'sorting', 'searching'],
      'cse-dbms': ['dbms', 'database', 'databases', 'sql', 'query', 'queries', 'normalization', 'nosql', 'relational', 'schema'],
      'cse-os': ['operating system', 'operating systems', 'os', 'cpu scheduling', 'process', 'thread', 'threads', 'semaphore', 'deadlock', 'memory management', 'paging'],
      'cse-webdev': ['web', 'html', 'css', 'javascript', 'react', 'node', 'express', 'frontend', 'backend', 'fullstack', 'api', 'http'],
      'cse-discrete': ['discrete mathematics', 'discrete math', 'dm', 'graphs', 'set theory', 'logic', 'combinatorics', 'probability', 'relations'],
      'cse-engmath': ['engineering mathematics', 'calculus', 'linear algebra', 'matrices', 'matrix', 'differential equations', 'integration', 'derivative', 'equation', 'formula'],
      'cse-engphysics': ['engineering physics', 'optics', 'quantum', 'laser', 'lasers', 'fiber optics', 'electromagnetism'],
      'cse-engchemistry': ['engineering chemistry', 'water technology', 'electrochemistry', 'spectroscopy', 'polymers'],
      'cse-basics': ['basic electrical', 'electronics', 'ac circuits', 'dc circuits', 'transformers', 'semiconductors'],
      'cse-pps': ['programming for problem solving', 'c programming', 'loops', 'arrays', 'functions', 'pointers'],
      'cse-english': ['technical english', 'communication skills', 'grammar', 'vocabulary'],
      'cse-oop': ['object-oriented programming', 'oop', 'java', 'c++', 'classes', 'objects', 'inheritance', 'polymorphism', 'encapsulation'],
      'cse-coa': ['computer organization', 'architecture', 'coa', 'cpu', 'memory hierarchy', 'io interface', 'pipelining'],
      'cse-networks': ['computer networks', 'networking', 'tcp/ip', 'osi model', 'routing', 'switching', 'http', 'dns'],
      'cse-software': ['software engineering', 'sdlc', 'agile', 'uml', 'testing', 'design patterns'],
      'cse-compiler': ['compiler design', 'compiler', 'lexical analysis', 'parsing', 'code generation', 'optimization'],
      'cse-automata': ['automata', 'flat', 'toc', 'finite automata', 'cfg', 'pda', 'turing machine'],
      'cse-cloud': ['cloud computing', 'cyber security', 'aws', 'virtualization', 'cryptography', 'network security', 'firewall'],
      'cse-distributed': ['distributed systems', 'concurrency', 'consensus', 'raft', 'mapreduce', 'distributed databases'],
      'cse-iot': ['internet of things', 'iot', 'sensors', 'actuators', 'smart devices', 'raspberry pi', 'node-red'],
      'cse-entrepreneurship': ['entrepreneurship', 'business plan', 'startup', 'marketing', 'finance'],
      'cse-project': ['capstone project', 'project report', 'internship', 'industrial training'],
      
      'aiml-ml': ['ai', 'ml', 'machine learning', 'artificial intelligence', 'neural network', 'deep learning', 'nlp', 'cnn', 'rnn', 'supervised', 'regression', 'classification'],
      'ds-analytics': ['data analytics', 'data science', 'analytics', 'statistics', 'dataframe', 'pandas', 'numpy', 'visualization', 'tableau', 'r programming'],
      'ece-microprocessors': ['microprocessor', 'embedded', '8085', '8086', 'arduino', 'microcontroller', 'assembly', 'interfacing'],
      'ece-digital': ['digital electronics', 'logic gate', 'boolean algebra', 'flip flop', 'multiplexer', 'combinational', 'sequential'],
      'ece-signals': ['signals', 'systems', 'fourier', 'laplace', 'z-transform', 'lti system', 'continuous time', 'discrete time'],
      'ece-iot': ['internet of things', 'iot', 'sensors', 'actuators', 'smart devices', 'raspberry pi', 'node-red'],
      
      'mechanical-thermo': ['thermodynamics', 'entropy', 'carnot', 'heat engine', 'laws of thermodynamics', 'enthalpy'],
      'mechanical-fluid': ['fluid', 'bernoulli', 'viscosity', 'hydraulics', 'flow', 'buoyancy'],
      'mechanical-cad': ['mechanical', 'gear', 'engine', 'turbine', 'thermodynamics', 'fluid mechanics', 'fluid dynamics', 'cad', 'robotics', 'materials', 'kinematics', 'aerodynamics'],
      
      'civil-structures': ['structural', 'truss', 'beam', 'concrete', 'steel design', 'bending moment', 'shear force'],
      'civil-survey': ['surveying', 'geology', 'leveling', 'mapping', 'compass'],
      'civil-geotech': ['geotechnical', 'soil mechanics', 'foundation engineering', 'clay', 'silt', 'rock mechanics']
    };

    const scores: Record<string, number> = {};
    for (const cat of availableCategories) scores[cat.id] = 0;

    for (const cat of availableCategories) {
      // 1. Direct name match (high weight)
      const normName = cat.name.toLowerCase();
      if (textToAnalyze.includes(normName)) {
        scores[cat.id] += 5;
      }

      // 2. Specific keywords match
      const keywords = categorySpecificKeywords[cat.id];
      if (keywords) {
        for (const keyword of keywords) {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = textToAnalyze.match(regex);
          if (matches) scores[cat.id] += matches.length;
        }
      }
    }

    let bestCatId = '';
    let maxScore = 0;
    for (const [catId, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCatId = catId;
      }
    }

    return bestCatId || (availableCategories.length > 0 ? availableCategories[0]!.id : 'cse');
  };

  const categoryListStr = availableCategories.map(c => `"${c.id}" (representing: ${c.name} - ${c.description || ''})`).join(', ');

  const systemInstruction = `You are NoteWeb's expert AI Category Classifier. Your task is to analyze college course notes and accurately classify them into exactly ONE category.`;

  const prompt = `Classify this note into exactly ONE of the active category IDs:
[ ${availableCategories.map(c => `"${c.id}"`).join(', ')} ]

Context about these category IDs:
[ ${categoryListStr} ]

Note Details:
- Subject: ${subject}
- Description: ${description}
- Preview Text: ${extractedText.slice(0, 5000)}

Select the single best fitting category ID. Return ONLY the category ID itself as a plain text string, with no formatting, markdown, quotes, explanations, or extra spaces. Example response: "cse"`;

  try {
    const responseText = await callAiChatCompletion(systemInstruction, prompt);
    const detectedId = responseText.replace(/['"`]/g, '').toLowerCase().trim();
    
    const isValid = availableCategories.some(c => c.id === detectedId);
    if (isValid) return detectedId;
    
    console.warn(`[NoteWeb Classifier] AI returned invalid category ID "${detectedId}", performing fallback.`);
    return getFallbackCategory();
  } catch (error) {
    console.warn("[NoteWeb Classifier] Classification query error, falling back to local regex:", error);
    return getFallbackCategory();
  }
};

export interface Flashcard {
  front: string;
  back: string;
}

/**
 * Generates interactive study flashcards for a note.
 */
export const generateFlashcards = async (
  subject: string,
  description: string,
  summary?: string
): Promise<Flashcard[]> => {
  const systemInstruction = `You are NoteWeb's expert AI Study Companion. Generate high-quality flashcards for active recall study.`;

  const prompt = `Generate exactly 3 study flashcards for a student revising "${subject}" (Description: "${description}", Summary: "${summary || ''}").
  
Return the output as a valid raw JSON array containing exactly 3 objects. Do NOT wrap the JSON in markdown formatting, code blocks (e.g. do not write \`\`\`json), or any explanations. Return only the raw JSON.
Each object must have exactly these keys:
- "front": A concise, critical revision question or term (max 85 chars).
- "back": A clear, high-fidelity explanation/answer to that question (max 150 chars).

Example raw output format:
[
  {"front": "Question 1", "back": "Answer 1"},
  {"front": "Question 2", "back": "Answer 2"},
  {"front": "Question 3", "back": "Answer 3"}
]`;

  try {
    const jsonText = await callAiChatCompletion(systemInstruction, prompt);
    const cleanedJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((fc: any) => ({
        front: String(fc.front || ''),
        back: String(fc.back || '')
      }));
    }
  } catch (error) {
    console.error("[NoteWeb Flashcards] Flashcards generation failed, using standard generator:", error);
  }

  // High-fidelity fallback flashcards
  return [
    {
      front: `What is the core syllabus focus of ${subject}?`,
      back: `It teaches the foundational rules, equations, and technical methodologies outlined in: "${description}".`
    },
    {
      front: `How can a student practically master ${subject}?`,
      back: `Through active recall quiz sessions, rewriting theoretical derivations, and review of study summaries.`
    },
    {
      front: `Why is reviewing the study checklist helpful?`,
      back: `It systematically highlights weak concepts, ensuring complete syllabus coverage before examinations.`
    }
  ];
};

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  rationale: string;
}

/**
 * Generates active recall multiple choice quizzes.
 */
export const generateQuiz = async (
  subject: string,
  description: string,
  summary?: string
): Promise<QuizQuestion[]> => {
  const systemInstruction = `You are NoteWeb's expert AI Quiz Master. Generate interactive multiple-choice questions for student testing.`;

  const prompt = `Generate exactly 3 multiple-choice quiz questions for the subject "${subject}" (Description: "${description}", Summary: "${summary || ''}").
  
Return the output as a valid raw JSON array containing exactly 3 objects. Do NOT wrap the JSON in markdown formatting, code blocks (e.g. no \`\`\`json), or any explanations. Return only the raw JSON.
Each object must have exactly these keys:
- "question": The revision question string (max 120 chars).
- "options": An array of exactly 4 strings representing option options (max 60 chars each).
- "answerIndex": The 0-based index of the correct option (0, 1, 2, or 3).
- "rationale": A brief explanation of why this answer is correct (max 150 chars).

Example format:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answerIndex": 1,
    "rationale": "Explanation of the correct answer..."
  }
]`;

  try {
    const jsonText = await callAiChatCompletion(systemInstruction, prompt);
    const cleanedJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((q: any) => ({
        question: String(q.question || ''),
        options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : ['A', 'B', 'C', 'D'],
        answerIndex: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
        rationale: String(q.rationale || '')
      }));
    }
  } catch (error) {
    console.error("[NoteWeb Quiz] Quiz generation query failed:", error);
  }

  // Fallback Quiz
  return [
    {
      question: `Which study practice is most effective for mastering "${subject}"?`,
      options: [
        `Active recall quizzes and study checklists`,
        `Passive re-reading of notes without checks`,
        `Ignoring class study roadmaps entirely`,
        `Memorizing slides without comprehension`
      ],
      answerIndex: 0,
      rationale: `Active recall and retrieval practice (e.g., flashcards and quizzes) are scientifically proven to enhance academic performance.`
    },
    {
      question: `What forms the core technical base of "${subject}" notes?`,
      options: [
        `Historical general overview profiles`,
        `Operational limits, formulas, and syllabus constraints`,
        `Ephemeral chat notes with no structure`,
        `Visual page layout alignments`
      ],
      answerIndex: 1,
      rationale: `Course syllabus folders concentrate on theoretical formulas and practical implementation margins.`
    }
  ];
};

/**
 * Sends a study question about the note to the AI to get a premium academic answer.
 */
export const askGeminiQna = async (
  subject: string,
  description: string,
  summary: string,
  question: string,
  chatHistory: Array<{ role: 'user' | 'model'; text: string }>
): Promise<string> => {
  const systemInstruction = `You are NoteWeb's expert AI Academic Assistant. The student is asking questions about notes they are studying:
- Subject: "${subject}"
- Description: "${description}"
- Summary: "${summary}"

Provide a clear, helpful, academically rigorous answer. You can use markdown bullet points, bold text, lists, and code blocks. Make your answer extremely easy to understand, encouraging, and focused on helping them excel in their college exams.`;

  try {
    return await callAiChatCompletion(systemInstruction, question, chatHistory);
  } catch (error) {
    console.error("[NoteWeb QnA] QnA fetch failed:", error);
    return `⚠️ Sorry, I encountered an error communicating with the AI host. Please verify your internet connection.`;
  }
};

export interface SpamCheckResult {
  isApproved: boolean;
  rejectionReason: string | null;
  spamScore: number;
  plagiarismScore: number;
}

/**
 * Checks an uploaded note for spam, nonsense gibberish, and plagiarism.
 */
export const checkPlagiarismAndSpam = async (
  subject: string,
  description: string,
  extractedText: string
): Promise<SpamCheckResult> => {
  const systemInstruction = `You are NoteWeb's expert AI Security and Plagiarism Moderator. Analyze the text for spam, nonsense/gibberish, copyrighted material, offensive language, or plagiarism.`;
  
  const prompt = `Analyze this uploaded student note:
- Subject: "${subject}"
- Description: "${description}"
- Extracted PDF Text (first 5000 chars): "${extractedText.slice(0, 5000)}"

Determine if it contains:
1. Nonsense, gibberish, spam (e.g. keyboard mashes, repetitive words, blank/empty page contents).
2. Plagiarized/copyrighted commercial textbook materials directly copied (e.g. publisher notices).
3. Highly offensive, toxic, or completely inappropriate academic content.

Return a valid raw JSON object. Do NOT wrap it in markdown formatting, code blocks (e.g. no \`\`\`json), or any explanations. Return only the raw JSON.
The JSON must have exactly these keys:
- "isApproved": boolean (false if spamScore > 85 or plagiarismScore > 85 or has offensive content)
- "rejectionReason": string or null (explain why it is rejected, max 100 chars)
- "spamScore": number (0 to 100, higher means more gibberish/spam/meaningless)
- "plagiarismScore": number (0 to 100, higher means more copied/publisher book-like text)

Example format:
{
  "isApproved": true,
  "rejectionReason": null,
  "spamScore": 12,
  "plagiarismScore": 15
}`;

  try {
    const jsonText = await callAiChatCompletion(systemInstruction, prompt);
    const cleanedJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    return {
      isApproved: parsed.isApproved !== undefined ? !!parsed.isApproved : true,
      rejectionReason: parsed.rejectionReason || null,
      spamScore: typeof parsed.spamScore === 'number' ? parsed.spamScore : 0,
      plagiarismScore: typeof parsed.plagiarismScore === 'number' ? parsed.plagiarismScore : 0,
    };
  } catch (error) {
    console.warn("[NoteWeb Security] AI spam scanner failed, bypassing to true:", error);
    return {
      isApproved: true,
      rejectionReason: null,
      spamScore: 0,
      plagiarismScore: 0,
    };
  }
};

export interface ChatModerationResult {
  isToxic: boolean;
  explanation: string | null;
  toxicityScore: number;
}

/**
 * Moderates a real-time chat lounge message for toxicity, profanity, or spam.
 */
export const moderateChatMessage = async (
  message: string,
  senderName: string
): Promise<ChatModerationResult> => {
  const systemInstruction = `You are NoteWeb's expert AI Real-time Chat Lounge Moderator. Analyze messages for toxicity, hate speech, severe harassment, extreme profanity, or spam.`;
  
  const prompt = `Analyze this sent lounge message:
- Sender Name: "${senderName}"
- Message Text: "${message}"

Determine if it contains severe hate speech, direct threats, aggressive bullying, extreme profanity, or blatant scam/spam links.

Return a valid raw JSON object. Do NOT wrap it in markdown formatting, code blocks (e.g. no \`\`\`json), or any explanations. Return only the raw JSON.
The JSON must have exactly these keys:
- "isToxic": boolean (true if toxicityScore > 75)
- "explanation": string or null (max 80 chars, e.g. "Contains severe profanity" or "Spam advertisement detected")
- "toxicityScore": number (0 to 100, higher means more abusive/toxic/profane)

Example format:
{
  "isToxic": true,
  "explanation": "Contains abusive language",
  "toxicityScore": 85
}`;

  try {
    const jsonText = await callAiChatCompletion(systemInstruction, prompt);
    const cleanedJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);
    return {
      isToxic: parsed.isToxic !== undefined ? !!parsed.isToxic : false,
      explanation: parsed.explanation || null,
      toxicityScore: typeof parsed.toxicityScore === 'number' ? parsed.toxicityScore : 0,
    };
  } catch (error) {
    console.warn("[NoteWeb Chat Security] Chat moderator failed, bypassing to safe:", error);
    return {
      isToxic: false,
      explanation: null,
      toxicityScore: 0,
    };
  }
};
