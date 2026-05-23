/**
 * Gemini AI Note Summarizer Service
 * Calls Google's Gemini 2.5 Flash API directly using lightweight rest fetch.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Summarizes the provided notes text using Gemini 2.5 Flash API.
 * 
 * @param notesText Plain text extracted from the PDF note
 * @returns Promise<string> A beautifully formatted academic summary
 */
export const summarizeNotes = async (notesText: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'mock-gemini-api-key') {
    // Return a beautiful mock academic summary for local testing/booting
    // if the user has not configured their Gemini API key yet.
    return `### NoteWeb AI Academic Summary (Mock Mode)

*Note: Please configure your active \`VITE_GEMINI_API_KEY\` in your \`.env\` file to receive actual live AI summaries!*

#### 📚 Key Concepts Covered
- **Core Subject Area**: Advanced technical concepts covered in these course notes.
- **Scope**: Foundational elements and critical architectural designs.
- **Target Knowledge**: Core equations and structural systems explained within the text.

#### 💡 Detailed Core Insights
- **Key Discovery**: The text illustrates the critical relation between input parameters and target output yields, illustrating optimal constraints.
- **Architectural Method**: A structured phase-based methodology is deployed to optimize overall execution reliability, reducing standard margins of error.
- **Logical Flow**: Step-by-step mathematical proofs establish stable conditions across complex system workloads.

#### ✏️ Study & Revision Checklist
- [ ] Practice rewriting the foundational derivations outlined in the first pages.
- [ ] Review how this component interfaces with broader downstream operations.
- [ ] Solve the conceptual review questions at the end of Chapter 1.`;
  }

  const prompt = `You are NoteWeb's expert AI Academic Assistant. Your task is to analyze the following student notes and generate a highly helpful, professional, and structured study summary.

Analyze this text:
"""
${notesText.slice(0, 10000)}  // Read up to 10k characters for safe limits
"""

Please format your response in professional Markdown exactly as follows:

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
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API call failed:", errorData);
      throw new Error("Failed to contact Gemini API. Please check your network or key.");
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("Empty response received from Gemini.");
    }

    return generatedText;
  } catch (error) {
    console.error("Gemini service error:", error);
    throw error;
  }
};

/**
 * Classifies a student note into the correct subject category.
 * If Gemini API is offline/mock, it falls back to a highly accurate keyword-matching regex algorithm.
 * 
 * @param subject Subject title provided by the user
 * @param description Description provided by the user
 * @param extractedText Text content of the note
 * @param availableCategories List of active categories in Firestore to match against
 * @returns Promise<string> The classified category ID (e.g. 'computers', 'maths')
 */
export const classifyNoteCategory = async (
  subject: string,
  description: string,
  extractedText: string,
  availableCategories: { id: string; name: string; description?: string }[]
): Promise<string> => {
  const textToAnalyze = `${subject} ${description} ${extractedText}`.toLowerCase();

  // Local Regex / Keyword matching fallback
  const getFallbackCategory = (): string => {
    // 1. Computer Science Keywords
    const csKeywords = [
      'computer', 'programming', 'code', 'javascript', 'typescript', 'python', 'java', 'c++', 'html',
      'css', 'react', 'database', 'sql', 'nosql', 'algorithm', 'software', 'networking', 'ip address',
      'data structure', 'compiler', 'operating system', 'linux', 'git', 'github', 'frontend', 'backend',
      'developer', 'binary', 'cybersecurity', 'cryptography', 'ai', 'machine learning', 'deep learning',
      'web', 'app', 'oop', 'object oriented'
    ];

    // 2. Mathematics Keywords
    const mathKeywords = [
      'math', 'mathematics', 'calculus', 'algebra', 'geometry', 'trigonometry', 'matrix', 'matrices',
      'probability', 'statistics', 'derivative', 'integral', 'integration', 'theorem', 'equation',
      'formula', 'differential', 'vector', 'discrete math', 'linear algebra', 'arithmetic', 'number theory'
    ];

    // 3. Science Keywords
    const scienceKeywords = [
      'science', 'physics', 'chemistry', 'biology', 'quantum', 'mechanics', 'organic chemistry',
      'molecule', 'atom', 'proton', 'electron', 'neutron', 'dna', 'rna', 'cell', 'genetics', 'evolution',
      'gravity', 'thermodynamics', 'chemical reaction', 'photosynthesis', 'astronomy', 'space', 'laboratory'
    ];

    // 4. Electronics Keywords
    const electronicsKeywords = [
      'electronics', 'circuit', 'semiconductor', 'diode', 'transistor', 'microcontroller', 'arduino',
      'raspberry pi', 'resistor', 'capacitor', 'inductor', 'voltage', 'current', 'power supply', 'analog',
      'digital circuit', 'pcb', 'oscilloscope', 'signal processing', 'sensor', 'vhdl', 'fpga'
    ];

    // 5. Mechanical Keywords
    const mechanicalKeywords = [
      'mechanical', 'machine', 'gear', 'engine', 'turbine', 'thermodynamics', 'fluid mechanics',
      'fluid dynamics', 'solid mechanics', 'cad', '3d printing', 'manufacturing', 'robotics', 'materials science',
      'stress analysis', 'kinematics', 'aerodynamics', 'automotive', 'hvac', 'friction'
    ];

    // 6. Management Keywords
    const managementKeywords = [
      'management', 'business', 'marketing', 'finance', 'economics', 'accounting', 'entrepreneurship',
      'strategy', 'leadership', 'organization', 'human resources', 'hr', 'startup', 'product manager',
      'project management', 'agile', 'scrum', 'investment', 'market share', 'consulting'
    ];

    const keywordMaps: Record<string, string[]> = {
      computers: csKeywords,
      maths: mathKeywords,
      science: scienceKeywords,
      electronics: electronicsKeywords,
      mechanical: mechanicalKeywords,
      management: managementKeywords,
    };

    // Calculate score for each category based on keyword matches
    const scores: Record<string, number> = {};
    
    // Initialize standard categories
    for (const catId of Object.keys(keywordMaps)) {
      scores[catId] = 0;
    }

    // Also support any dynamically added categories by searching for matches in their names/descriptions
    for (const cat of availableCategories) {
      if (!keywordMaps[cat.id]) {
        scores[cat.id] = 0;
      }
    }

    // Score standard categories
    for (const [catId, keywords] of Object.entries(keywordMaps)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = textToAnalyze.match(regex);
        if (matches) {
          scores[catId] += matches.length;
        }
      }
    }

    // Score dynamic custom categories based on exact matches of their names/description text
    for (const cat of availableCategories) {
      const nameWords = cat.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const word of nameWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = textToAnalyze.match(regex);
        if (matches) {
          scores[cat.id] += matches.length * 2; // Weight name matches heavily
        }
      }

      if (cat.description) {
        const descWords = cat.description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        for (const word of descWords) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = textToAnalyze.match(regex);
          if (matches) {
            scores[cat.id] += matches.length;
          }
        }
      }
    }

    // Find the highest scoring category
    let bestCatId = '';
    let maxScore = 0;
    for (const [catId, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCatId = catId;
      }
    }

    // If no keywords matched, return the first available category or a default
    return bestCatId || (availableCategories.length > 0 ? availableCategories[0].id : 'computers');
  };

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'mock-gemini-api-key') {
    // Simulated delay and local keyword classification
    await new Promise(resolve => setTimeout(resolve, 600));
    return getFallbackCategory();
  }

  const categoryListStr = availableCategories.map(c => `"${c.id}" (representing: ${c.name} - ${c.description || ''})`).join(', ');

  const prompt = `You are NoteWeb's expert AI Category Classifier. Your task is to analyze a college student's note and accurately categorize it.

You are given:
- Subject: ${subject}
- Description: ${description}
- Extracted PDF Text (first 4000 characters):
"""
${extractedText.slice(0, 4000)}
"""

Please classify the note into exactly ONE of the following active category IDs:
[ ${availableCategories.map(c => `"${c.id}"`).join(', ')} ]

Here is some context about these category IDs:
[ ${categoryListStr} ]

Select the single best fitting category ID. Return ONLY the category ID itself as a plain text string, with no formatting, markdown, quotes, explanations, or extra spaces. Example: "computers" or "maths".`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.warn("Gemini Category Classifier API call failed, falling back to keyword matcher");
      return getFallbackCategory();
    }

    const data = await response.json();
    let detectedId = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    
    // Clean up response
    detectedId = detectedId.replace(/['"`]/g, '').toLowerCase().trim();

    // Verify it is a valid active category
    const isValid = availableCategories.some(c => c.id === detectedId);
    if (isValid) {
      return detectedId;
    } else {
      console.warn(`Gemini returned invalid category ID "${detectedId}", performing keyword fallback.`);
      return getFallbackCategory();
    }
  } catch (error) {
    console.error("Gemini classification failed, using regex fallback:", error);
    return getFallbackCategory();
  }
};

export interface Flashcard {
  front: string;
  back: string;
}

/**
 * Generates study flashcards for a note based on the subject and description.
 */
export const generateFlashcards = async (
  subject: string,
  description: string,
  summary?: string
): Promise<Flashcard[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  if (!apiKey || apiKey === 'mock-gemini-api-key') {
    // Return high-quality mock flashcards
    return [
      {
        front: `What is the primary objective of studying "${subject}"?`,
        back: `To master the foundational theories, methodologies, and practical applications outlined in: "${description}".`
      },
      {
        front: `Name one critical core concept covered in "${subject}".`,
        back: `The fundamental relation between theory constraints and optimal outputs, reducing errors in engineering/design.`
      },
      {
        front: `How is this material applied practically?`,
        back: `By solving real-world derivations, implementing step-by-step algorithms/workflows, and building structured systems.`
      }
    ];
  }

  const prompt = `You are NoteWeb's expert AI Study Companion. Generate exactly 3 highly helpful study flashcards for a student revising the subject "${subject}" (Description: "${description}", Summary: "${summary || ''}").
  
Return the output as a valid raw JSON array containing exactly 3 objects. Do NOT wrap the JSON in markdown formatting, code blocks (e.g. no \`\`\`json), or any explanations. Return only the raw JSON.
Each object must have exactly these keys:
- "front": A concise, critical revision question or term (max 80 chars).
- "back": A clear, high-fidelity explanation/answer to that question (max 150 chars).

Example format:
[
  {"front": "Question 1", "back": "Answer 1"},
  {"front": "Question 2", "back": "Answer 2"},
  {"front": "Question 3", "back": "Answer 3"}
]`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) throw new Error("Failed to contact Gemini API.");
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean text of markdown wrappers
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((fc: any) => ({
          front: String(fc.front || ''),
          back: String(fc.back || '')
        }));
      }
    } catch (parseErr) {
      console.warn("Gemini flashcards JSON parse failed, trying fallback", parseErr);
    }
  } catch (error) {
    console.error("Gemini generateFlashcards error:", error);
  }

  // Fallback
  return [
    {
      front: `Key Revision Question: What are the fundamental principles of ${subject}?`,
      back: `It covers core rules, structures, and applications required for examinations and practical projects.`
    },
    {
      front: `Concept Check: How does this subject impact modern engineering/studies?`,
      back: `By defining system parameters, optimizing designs, and establishing stable operational workflows.`
    },
    {
      front: `Practical Focus: What is the recommended way to practice these notes?`,
      back: `By solving mathematical proofs, reviewing standard lecture summaries, and tackling study checklists.`
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
 * Generates interactive study quizzes based on the notes subject.
 */
export const generateQuiz = async (
  subject: string,
  description: string,
  summary?: string
): Promise<QuizQuestion[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  if (!apiKey || apiKey === 'mock-gemini-api-key') {
    return [
      {
        question: `Which of the following best describes the core focus of "${subject}"?`,
        options: [
          `Fundamental principles and operational parameters`,
          `Purely historical case studies with no technical context`,
          `Unrelated general knowledge trivia questions`,
          `Basic language learning syntax without logic`
        ],
        answerIndex: 0,
        rationale: `The description "${description}" specifies the technical syllabus folder designed to master core principles.`
      },
      {
        question: `How should a student optimize revision for "${subject}" notes?`,
        options: [
          `By skipping all formulas and active retrieval`,
          `By utilizing AI study flashcards and active recall quizzes`,
          `By copying the entire PDF manually multiple times`,
          `By ignoring teacher lectures and study checklists`
        ],
        answerIndex: 1,
        rationale: `Active recall and spaced repetition (e.g. quizzes/flashcards) are scientifically proven to maximize learning retention.`
      },
      {
        question: `What is the secondary benefit of reviewing "${subject}" description and summaries?`,
        options: [
          `Memorizing irrelevant data sets`,
          `Connecting theoretical parameters to real practical engineering scenarios`,
          `Increasing browser page load latency`,
          `Avoiding semester exams entirely`
        ],
        answerIndex: 1,
        rationale: `Reviewing notes helps link classroom theory to practical implementations, enhancing technical problem-solving.`
      }
    ];
  }

  const prompt = `You are NoteWeb's expert AI Quiz Master. Generate exactly 3 highly helpful multiple-choice questions for a student testing their knowledge on the subject "${subject}" (Description: "${description}", Summary: "${summary || ''}").
  
Return the output as a valid raw JSON array containing exactly 3 objects. Do NOT wrap the JSON in markdown formatting, code blocks (e.g. no \`\`\`json), or any explanations. Return only the raw JSON.
Each object must have exactly these keys:
- "question": The revision question string (max 120 chars).
- "options": An array of exactly 4 strings representing multi-choice options (max 60 chars each).
- "answerIndex": The 0-based index of the correct option (0, 1, 2, or 3).
- "rationale": A brief explanation of why this answer is correct (max 150 chars).

Example format:
[
  {
    "question": "Question text?",
    "options": ["Opt 0", "Opt 1", "Opt 2", "Opt 3"],
    "answerIndex": 1,
    "rationale": "Explanation..."
  }
]`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) throw new Error("Failed to contact Gemini API.");
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean text
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q: any) => ({
          question: String(q.question || ''),
          options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : ['A', 'B', 'C', 'D'],
          answerIndex: typeof q.answerIndex === 'number' ? q.answerIndex : 0,
          rationale: String(q.rationale || '')
        }));
      }
    } catch (parseErr) {
      console.warn("Gemini quiz JSON parse failed, trying fallback", parseErr);
    }
  } catch (error) {
    console.error("Gemini generateQuiz error:", error);
  }

  // Fallback
  return [
    {
      question: `Revision Practice: Which of the following is core to "${subject}"?`,
      options: [
        `Operational and theoretical parameters`,
        `Non-technical standard templates`,
        `Purely offline backup files`,
        `Dynamic styling margins`
      ],
      answerIndex: 0,
      rationale: `Understanding technical principles forms the cornerstone of studying this syllabus topic.`
    }
  ];
};

/**
 * Sends a study question about the note to Gemini to get a premium academic answer.
 */
export const askGeminiQna = async (
  subject: string,
  description: string,
  summary: string,
  question: string,
  chatHistory: Array<{ role: 'user' | 'model'; text: string }>
): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  if (!apiKey || apiKey === 'mock-gemini-api-key') {
    await new Promise(resolve => setTimeout(resolve, 800));
    return `### NoteWeb AI Chatbot (Mock Mode)
    
You asked: *"${question}"*

Here is a structural academic answer based on the notes for **${subject}**:

1. **Theoretical Context**: In this context, parameters must be evaluated systematically to avoid logical inconsistencies or errors in calculations.
2. **Applied Recommendation**: You should review the details of this topic by sketching core diagrams or rewriting primary derivations manually.

*Note: Please configure an active \`VITE_GEMINI_API_KEY\` to receive live responses from Gemini!*`;
  }

  // Map history to Google's format
  const formattedHistory = chatHistory.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const systemInstructions = `You are NoteWeb's expert AI Academic Assistant. The student is asking questions about notes they are studying:
- Subject: "${subject}"
- Description: "${description}"
- Summary: "${summary}"

Provide a clear, helpful, academically rigorous answer. You can use markdown bullet points, bold text, lists, and code blocks. Make your answer extremely easy to understand, encouraging, and focused on helping them excel in their college exams.`;

  const newParts = [
    { text: `${systemInstructions}\n\nUser Question: ${question}` }
  ];

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...formattedHistory,
          { role: 'user', parts: newParts }
        ]
      })
    });

    if (!response.ok) throw new Error("Failed to call Gemini API.");
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("Empty reply.");
    return reply;
  } catch (error) {
    console.error("Gemini QnA error:", error);
    return `⚠️ Sorry, I encountered an error communicating with Gemini. Please check your network connection and API key.`;
  }
};
