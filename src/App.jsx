import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Settings2, Sparkles, Copy, Check, 
  RefreshCw, History, Heart, Type, ChevronDown, ChevronUp,
  SlidersHorizontal, Edit3, X, AlertCircle, Quote, Maximize2, Share2
} from 'lucide-react';

// Helper to call Gemini API for both image understanding and text generation
const API_URL = "/api/gemini";

async function analyzeImageWithAI(base64Image) {
  const prompt = `
    Analyze this image objectively, deeply, and comprehensively.
    Pay equal attention to BOTH the physical objects AND any text/words written anywhere in the image (signs, packaging, t-shirts, posters, logos, menus, screens, quotes, overlay text, handwritten notes, etc.).

    Return ONLY a JSON object with the following structure. Do NOT include markdown formatting like \`\`\`json.
    {
      "primarySubject": "Main subject (e.g., Person, Coffee cup, Building, Signboard)",
      "secondarySubjects": ["List of supporting elements"],
      "visibleText": "ALL exact text, words, brand names, slogans, or quotes visible in the image. Be thorough and precise. If no text is present, return 'None'.",
      "action": "What is happening? (e.g., Sitting, Reading a sign, Holding a mug with text)",
      "environment": "Setting (e.g., Outdoor cafe, Urban street, Indoor studio)",
      "visualMood": "Lighting and atmosphere (e.g., Warm, Moody, Bright)",
      "overallStory": "A comprehensive summary synthesizing BOTH the text found in the photo and the visual elements to explain the full context, story, and core message of the image.",
      "confidence": "HIGH, MEDIUM, or LOW based on clarity",
      "summaryTags": ["3-5 brief keywords summarizing the visual facts and text content"]
    }
  `;

  // Remove data:image/xxx;base64, prefix for the API
  const base64Data = base64Image.split(',')[1];
  const mimeType = base64Image.split(';')[0].split(':')[1];

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `API request failed (${response.status})`);
    }
    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       const text = data.candidates[0].content.parts[0].text;
       try {
           return JSON.parse(text);
       } catch (e) {
           console.error("Failed to parse visual analysis JSON", text);
           return null;
       }
    }
    return null;
  } catch (error) {
    console.error("API Error during analysis:", error);
    return null;
  }
}

async function generateCaptionsWithAI(visualContext, userContext, settings, isRefinement = false, refinementPrompt = "") {
  let languageInstruction = "";
  if (settings.language === 'indonesian') languageInstruction = "Write entirely in natural Indonesian.";
  else if (settings.language === 'english') languageInstruction = "Write entirely in natural English.";
  else {
    languageInstruction = `Write in a bilingual mix of Indonesian and English. The mix should be approximately ${settings.languageMix}% English and ${100 - settings.languageMix}% Indonesian. Blend them naturally like a native speaker on social media.`;
  }

  let styleInstruction = "";
  switch(settings.style) {
    case 'Premium': styleInstruction = "Sophisticated, elegant, refined, minimal. Avoid clichés."; break;
    case 'Casual': styleInstruction = "Relaxed, natural, friendly, conversational. Sounds like a real person."; break;
    case 'Youth': styleInstruction = "Contemporary, playful, short punchy phrases, internet-native."; break;
    case 'Fun': styleInstruction = "Humorous, clever, playful, unexpected. Might use light wordplay."; break;
  }

  let basePrompt = `
    You are an expert social media copywriter for 'DJOURNAL CAPTION STUDIO'.
    Your task is to generate captions grounded deeply in the FULL meaning of the photo (combining both visual objects AND any text/words written inside the photo).
    
    CRITICAL RULES FOR HOLISTIC RECOGNITION:
    1. INTEGRATE TEXT IN IMAGE: If the photo contains visible text, quotes, signs, packaging text, or brand names ("visibleText"), make sure your captions directly reference, build upon, or incorporate that text naturally into the narrative!
    2. FULL CONTEXT SYNTHESIS: Do NOT just describe objects (e.g. don't just say 'a person holding a cup'). Synthesize the story of the photo by combining the visible text, the emotion, the setting, and the action.
    3. VISUAL & TEXTUAL GROUNDING: Stay true to the facts extracted from the photo.
    4. ANTI-CLICHÉ: Avoid generic filler like "Sometimes you need to...", "More than just...", "Elevate your...". Be specific to what is actually written and shown in this exact photo.
    5. HUMANIZATION: Make it sound like an organic, engaging post written by a creative human.

    INPUT DATA:
    - Detected Text/Words in Image: "${visualContext?.visibleText || 'None'}"
    - Overall Story & Context of Image: "${visualContext?.overallStory || 'N/A'}"
    - Visual Facts: ${JSON.stringify(visualContext)}
    - User Intended Context: "${userContext || 'None provided'}"
    - Specific Caption Theme/Topic: "${settings.captionTheme || 'Auto-detect based on visual context'}"
    - Tone/Style: ${styleInstruction}
    - Language: ${languageInstruction}
    - Length: ${settings.length} (Short: 1-2 sentences, Medium: 3-5, Long: 6-10)
    - Industry/Niche: ${settings.industry}
    - Brand Name: ${settings.brandName || 'N/A'}
    - Brand Tagline: ${settings.brandTagline || 'N/A'}
    - Call to Action (CTA): ${settings.cta}
    - Emoji usage: ${settings.emojiLevel}
    - Hashtags count: ${settings.hashtags}

    ${isRefinement ? `\nREFINEMENT REQUEST: This is a regeneration. Adjust the output based on this feedback: "${refinementPrompt}" while keeping the factual context the same.` : ''}

    Output ONLY a JSON object with this exact structure:
    {
      "primary": { "text": "The strongest, most fitting caption", "angle": "Description of the creative angle used (e.g., 'Text & Visual Synthesis')" },
      "alternatives": [
        { "text": "Alternative caption 1", "angle": "Different creative angle" },
        { "text": "Alternative caption 2", "angle": "Different creative angle" },
        { "text": "Alternative caption 3", "angle": "Different creative angle" }
      ]
    }
  `;

  const payload = {
    contents: [{ role: "user", parts: [{ text: basePrompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `API request failed (${response.status})`);
    }
    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       const text = data.candidates[0].content.parts[0].text;
       try {
           return JSON.parse(text);
       } catch (e) {
           console.error("Failed to parse caption JSON", text);
           return null;
       }
    }
    return null;
  } catch (error) {
    console.error("API Error during generation:", error);
    return null;
  }
}

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon }) => {
  const baseStyle = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-95";
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 px-6 py-3",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-50 px-6 py-3",
    outline: "border border-gray-200 text-gray-700 hover:border-gray-900 hover:text-black px-4 py-2",
    ghost: "text-gray-500 hover:text-black hover:bg-gray-50 px-3 py-2"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('generator'); // generator, quotes, history, saved
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);

  // Load from local storage on mount
  useEffect(() => {
    const localHistory = localStorage.getItem('djournal_history');
    const localSaved = localStorage.getItem('djournal_saved');
    if (localHistory) setHistory(JSON.parse(localHistory));
    if (localSaved) setSaved(JSON.parse(localSaved));
  }, []);

  const saveToHistory = (item) => {
    const newHistory = [item, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('djournal_history', JSON.stringify(newHistory));
  };

  const toggleSave = (item) => {
    const isSaved = saved.some(s => s.id === item.id);
    let newSaved;
    if (isSaved) {
      newSaved = saved.filter(s => s.id !== item.id);
    } else {
      newSaved = [{...item, savedAt: Date.now()}, ...saved];
    }
    setSaved(newSaved);
    localStorage.setItem('djournal_saved', JSON.stringify(newSaved));
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-black selection:text-white pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DJ</span>
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight leading-none">DJOURNAL CAPTION STUDIO</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mt-0.5">by Agung Adhiyaksa</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
            {['generator', 'quotes', 'history', 'saved'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab 
                    ? 'bg-white shadow-sm text-black border border-gray-200/50' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'generator' && <GeneratorFlow onComplete={saveToHistory} savedItems={saved} onToggleSave={toggleSave} />}
        {activeTab === 'quotes' && <QuotesFlow />}
        {activeTab === 'history' && <HistoryView items={history} />}
        {activeTab === 'saved' && <SavedView items={saved} onToggleSave={toggleSave} />}
      </main>
      
      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 flex justify-around z-50 pb-safe">
         {[
           {id: 'generator', icon: Sparkles, label: 'Create'},
           {id: 'quotes', icon: Quote, label: 'Quotes'},
           {id: 'history', icon: History, label: 'History'},
           {id: 'saved', icon: Heart, label: 'Saved'}
         ].map(({ id, icon: Icon, label }) => (
           <button
             key={id}
             onClick={() => setActiveTab(id)}
             className={`flex flex-col items-center justify-center p-2 w-16 ${activeTab === id ? 'text-black' : 'text-gray-400'}`}
           >
             <Icon className={`w-5 h-5 mb-1 ${activeTab === id ? 'fill-current opacity-20' : ''}`} />
             <span className="text-[10px] font-medium">{label}</span>
           </button>
         ))}
      </div>
    </div>
  );
}

function GeneratorFlow({ onComplete, savedItems, onToggleSave }) {
  const [appState, setAppState] = useState('idle'); // idle, analyzing, ready, generating, results
  const [image, setImage] = useState(null);
  const [visualContext, setVisualContext] = useState(null);
  const [userContext, setUserContext] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [settings, setSettings] = useState({
    captionTheme: '',
    style: 'Casual',
    language: 'mix',
    languageMix: 50, // 0 = Indo, 100 = English
    industry: 'Lifestyle',
    length: 'Medium',
    brandName: '',
    brandTagline: '',
    cta: 'None',
    emojiLevel: 'Minimal',
    hashtags: '3'
  });

  const fileInputRef = useRef(null);

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      setImage(base64);
      setAppState('analyzing');
      setError(null);
      
      // Step 1: Vision Analysis
      const analysis = await analyzeImageWithAI(base64);
      if (analysis) {
        setVisualContext(analysis);
        setAppState('ready');
      } else {
        setError("Failed to analyze image. Please try again.");
        setAppState('idle');
        setImage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => processFile(e.target.files[0]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleGenerate = async (isRefinement = false, refinementPrompt = "") => {
    setAppState('generating');
    setError(null);

    const generatedData = await generateCaptionsWithAI(visualContext, userContext, settings, isRefinement, refinementPrompt);
    
    if (generatedData) {
      const resultObj = {
        id: Date.now().toString(),
        image,
        visualContext,
        userContext,
        settings,
        results: generatedData,
        createdAt: new Date().toISOString()
      };
      setResults(resultObj);
      setAppState('results');
      if (!isRefinement) onComplete(resultObj);
    } else {
      setError("Failed to generate captions. Please try again.");
      setAppState('ready');
    }
  };

  const resetFlow = () => {
    setAppState('idle');
    setImage(null);
    setVisualContext(null);
    setResults(null);
    setUserContext('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Hero Section (Only visible when idle) */}
      {appState === 'idle' && (
        <div className="text-center py-10 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            Turn Your Visuals<br/>
            <span className="text-gray-400">Into Words.</span>
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-lg">
            Upload a photo or drop an idea. Our Vision-First engine finds the real story behind it.
          </p>
        </div>
      )}

      {/* Main Interactive Area */}
      {appState !== 'results' ? (
        <Card className="p-6 md:p-8">
          
          {/* Uploader / Image Preview */}
          <div className="mb-8">
            {!image ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center transition-colors cursor-pointer group ${isDragging ? 'border-black bg-gray-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
              >
                <div className={`w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 transition-transform ${isDragging ? 'scale-110' : 'group-hover:scale-105'}`}>
                  <Upload className={`w-6 h-6 ${isDragging ? 'text-black' : 'text-gray-400'}`} />
                </div>
                <p className={`font-medium ${isDragging ? 'text-black' : 'text-gray-700'}`}>
                  {isDragging ? 'Drop photo here' : 'Click or drag a photo here'}
                </p>
                <p className="text-sm text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 group">
                <img src={image} alt="Uploaded" className="w-full max-h-80 object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                     Change Photo
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </div>
              </div>
            )}
          </div>

          {/* Analysis Status */}
          {appState === 'analyzing' && (
            <div className="flex items-center space-x-3 p-4 bg-blue-50 text-blue-700 rounded-xl mb-8 animate-pulse">
              <Sparkles className="w-5 h-5 animate-spin" />
              <span className="font-medium">Analyzing visual context...</span>
            </div>
          )}

          {/* Grounding Context (Visible after analysis) */}
          {(appState === 'ready' || appState === 'generating') && visualContext && (
            <div className="mb-8 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-start justify-between bg-green-50/50 border border-green-100 p-4 rounded-xl">
                <div>
                  <div className="flex items-center space-x-2 text-green-700 mb-2">
                     <Check className="w-4 h-4" />
                     <span className="font-semibold text-sm uppercase tracking-wide">Vision & Text Analysis Complete</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2.5 py-1 bg-white border border-green-200 text-green-800 text-xs rounded-full font-medium shadow-sm">
                      Subject: {visualContext.primarySubject}
                    </span>
                    {visualContext.visibleText && visualContext.visibleText !== 'None' && (
                      <span className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-full font-semibold shadow-sm">
                        Text in photo: "{visualContext.visibleText}"
                      </span>
                    )}
                    <span className="px-2.5 py-1 bg-white border border-green-200 text-green-800 text-xs rounded-full font-medium shadow-sm">
                      Mood: {visualContext.visualMood}
                    </span>
                    {visualContext.summaryTags?.slice(0,3).map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-white border border-green-200 text-green-800 text-xs rounded-full font-medium shadow-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Context (Optional but recommended)
                </label>
                <textarea
                  value={userContext}
                  onChange={(e) => setUserContext(e.target.value)}
                  placeholder="e.g., This is our new seasonal menu launching tomorrow..."
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none transition-all resize-none h-24 text-gray-700"
                />
                <p className="text-xs text-gray-500 mt-2 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Your text will be combined with the visual facts to create a grounded story.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tema / Topik Caption (Opsional)
                </label>
                <input
                  type="text"
                  value={settings.captionTheme}
                  onChange={(e) => setSettings({...settings, captionTheme: e.target.value})}
                  placeholder="e.g., Promo Tanggal Kembar, Weekend Vibe, Motivation Monday, Behind The Scenes..."
                  className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none transition-all text-sm text-gray-700 bg-white"
                />
              </div>

              {/* Style Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Writing Style
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Premium', 'Casual', 'Youth', 'Fun'].map(style => (
                    <button
                      key={style}
                      onClick={() => setSettings({...settings, style})}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        settings.style === style 
                          ? 'border-black bg-black text-white shadow-md scale-[1.02]' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold">{style}</div>
                      <div className={`text-[10px] mt-1 ${settings.style === style ? 'text-gray-300' : 'text-gray-400'}`}>
                        {style === 'Premium' && 'Sophisticated & refined'}
                        {style === 'Casual' && 'Natural & friendly'}
                        {style === 'Youth' && 'Punchy & contemporary'}
                        {style === 'Fun' && 'Clever & playful'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Accordion */}
              <AdvancedSettings settings={settings} setSettings={setSettings} />

              <Button 
                onClick={() => handleGenerate()} 
                disabled={appState === 'generating'}
                className="w-full mt-4 h-14 text-lg"
                icon={appState === 'generating' ? RefreshCw : Sparkles}
              >
                {appState === 'generating' ? 'Writing Captions...' : 'Generate Captions'}
              </Button>
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
            </div>
          )}
        </Card>
      ) : (
        /* Results View */
        <ResultsView 
          data={results} 
          onRegenerate={handleGenerate} 
          onReset={resetFlow}
          isGenerating={appState === 'generating'}
          savedItems={savedItems}
          onToggleSave={onToggleSave}
        />
      )}
    </div>
  );
}

function AdvancedSettings({ settings, setSettings }) {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center text-sm font-medium text-gray-700">
          <Settings2 className="w-4 h-4 mr-2 text-gray-500" />
          Advanced Settings
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      
      {isOpen && (
        <div className="p-4 space-y-6 border-t border-gray-100 bg-white animate-in slide-in-from-top-2">
          {/* Language mix */}
          <div className="space-y-3">
             <label className="block text-sm font-medium text-gray-700">Language</label>
             <div className="flex space-x-2">
               {['indonesian', 'english', 'mix'].map(lang => (
                 <button
                   key={lang}
                   onClick={() => updateSetting('language', lang)}
                   className={`flex-1 py-2 px-3 text-xs rounded-lg border ${settings.language === lang ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                 >
                   {lang.charAt(0).toUpperCase() + lang.slice(1)}
                 </button>
               ))}
             </div>
             
             {settings.language === 'mix' && (
               <div className="pt-2 px-1">
                 <div className="flex justify-between text-xs text-gray-500 mb-2">
                   <span>More Indo</span>
                   <span>More English</span>
                 </div>
                 <input 
                   type="range" 
                   min="0" max="100" 
                   value={settings.languageMix}
                   onChange={(e) => updateSetting('languageMix', parseInt(e.target.value))}
                   className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                 />
               </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Industry</label>
              <select 
                value={settings.industry}
                onChange={(e) => updateSetting('industry', e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-black outline-none"
              >
                {['Lifestyle', 'Food & Beverage', 'Fashion', 'Corporate', 'Travel', 'Photography', 'E-commerce', 'Personal'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Length</label>
              <select 
                value={settings.length}
                onChange={(e) => updateSetting('length', e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-black outline-none"
              >
                <option value="Short">Short (1-2 lines)</option>
                <option value="Medium">Medium (3-5 lines)</option>
                <option value="Long">Long (6+ lines)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Brand Name (Optional)</label>
               <input 
                 type="text" 
                 value={settings.brandName}
                 onChange={(e) => updateSetting('brandName', e.target.value)}
                 className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-black outline-none"
                 placeholder="e.g., Kopi Kenangan"
               />
            </div>
             <div>
               <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Call to Action</label>
               <select 
                value={settings.cta}
                onChange={(e) => updateSetting('cta', e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-black outline-none"
              >
                {['None', 'Engagement (Ask question)', 'Visit Link in Bio', 'Shop Now', 'Book Now'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Emojis</label>
              <select 
                value={settings.emojiLevel}
                onChange={(e) => updateSetting('emojiLevel', e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-black outline-none"
              >
                {['None', 'Minimal', 'Moderate', 'Playful'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Hashtags</label>
              <select 
                value={settings.hashtags}
                onChange={(e) => updateSetting('hashtags', e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-black outline-none"
              >
                {['None', '3', '5', '10'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function ResultsView({ data, onRegenerate, onReset, isGenerating, savedItems, onToggleSave }) {
  if (!data || !data.results) return null;
  const { primary, alternatives } = data.results;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // Simple visual feedback could be added here
  };

  const isSaved = savedItems.some(s => s.id === data.id);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
         <button onClick={onReset} className="flex items-center text-sm font-medium text-gray-500 hover:text-black transition-colors">
            <X className="w-4 h-4 mr-1" /> Start Over
         </button>
         <div className="flex items-center space-x-2">
            <button 
              onClick={() => onToggleSave(data)}
              className={`p-2 rounded-full border transition-all ${isSaved ? 'bg-red-50 border-red-100 text-red-500' : 'bg-white border-gray-200 text-gray-400 hover:text-black hover:border-gray-300'}`}
            >
               <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
         </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Image Context Reference */}
        <div className="md:col-span-1 space-y-4">
           <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
             <img src={data.image} alt="Reference" className="w-full h-48 object-cover" />
             <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md uppercase tracking-wider font-medium">
               Vision Context
             </div>
           </div>
           
           <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm space-y-3">
              <div>
                <span className="text-gray-500 text-xs uppercase font-semibold block mb-1">Detected Facts</span>
                <p className="text-gray-800">{data.visualContext.summaryTags?.join(' · ')}</p>
              </div>
              {data.visualContext.visibleText && data.visualContext.visibleText !== 'None' && (
                <div>
                  <span className="text-amber-700 text-xs uppercase font-semibold block mb-1">Detected Text in Photo</span>
                  <p className="text-gray-900 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs leading-relaxed">
                    "{data.visualContext.visibleText}"
                  </p>
                </div>
              )}
              {data.visualContext.overallStory && (
                <div>
                  <span className="text-gray-500 text-xs uppercase font-semibold block mb-1">Overall Story & Meaning</span>
                  <p className="text-gray-700 text-xs leading-relaxed">{data.visualContext.overallStory}</p>
                </div>
              )}
              {data.userContext && (
                <div>
                  <span className="text-gray-500 text-xs uppercase font-semibold block mb-1">Your Context</span>
                  <p className="text-gray-800 italic">"{data.userContext}"</p>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200">
                 <span className="text-gray-500 text-xs uppercase font-semibold block mb-1">Applied Style & Theme</span>
                 <p className="text-gray-800 font-medium">
                   {data.settings.captionTheme ? `Tema: "${data.settings.captionTheme}" • ` : ''}
                   {data.settings.style} • {data.settings.language}
                 </p>
              </div>
           </div>
        </div>

        {/* Right Column: Captions */}
        <div className="md:col-span-2 space-y-6">
           
           {/* Primary Caption */}
           <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                  Primary Caption
                </h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  Angle: {primary.angle}
                </span>
              </div>
              <Card className="p-6 relative group border-black/10 shadow-md">
                 <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{primary.text}</p>
                 <button 
                   onClick={() => handleCopy(primary.text)}
                   className="absolute top-4 right-4 p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all border border-gray-200"
                   title="Copy to clipboard"
                 >
                   <Copy className="w-4 h-4" />
                 </button>
              </Card>
           </div>

           {/* Alternatives */}
           <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">More Ways To Say It</h3>
              <div className="space-y-3">
                {alternatives.map((alt, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 relative group hover:border-gray-300 transition-colors">
                     <span className="block text-[10px] font-bold uppercase text-gray-400 mb-2">{alt.angle}</span>
                     <p className="text-sm text-gray-700 whitespace-pre-wrap pr-8">{alt.text}</p>
                     <button 
                        onClick={() => handleCopy(alt.text)}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                  </div>
                ))}
              </div>
           </div>

           {/* Refinement */}
           <div className="pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Refine Direction</h3>
              <div className="flex flex-wrap gap-2">
                 {[
                   { label: 'Make it more Premium', value: 'Make the tone much more premium, elegant, and sophisticated. Use higher-end vocabulary.' },
                   { label: 'Make it Shorter', value: 'Make all captions significantly shorter and punchier.' },
                   { label: 'More Conversational', value: 'Make it sound more like a casual chat with a friend.' },
                   { label: 'Add more Humor', value: 'Inject clever humor or lighthearted observations.' }
                 ].map(refinement => (
                   <button
                     key={refinement.label}
                     disabled={isGenerating}
                     onClick={() => onRegenerate(true, refinement.value)}
                     className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-50"
                   >
                     {refinement.label}
                   </button>
                 ))}
                 {isGenerating && <span className="text-sm text-gray-500 animate-pulse flex items-center ml-2"><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Refining...</span>}
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}

function HistoryView({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No generation history yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold mb-6">Recent Generations</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col h-full">
            <div className="h-32 bg-gray-100 relative">
              <img src={item.image} alt="History" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                 <span className="text-white text-xs font-medium">
                   {new Date(item.createdAt).toLocaleDateString()}
                 </span>
              </div>
            </div>
            <div className="p-4 flex-grow flex flex-col">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{item.settings.style} Style</span>
               <p className="text-sm text-gray-800 line-clamp-3 mb-4 flex-grow">
                 {item.results?.primary?.text}
               </p>
               <button 
                 onClick={() => navigator.clipboard.writeText(item.results?.primary?.text)}
                 className="mt-auto flex items-center justify-center w-full py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium rounded-lg transition-colors border border-gray-200"
               >
                 <Copy className="w-4 h-4 mr-2" /> Copy Primary
               </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SavedView({ items, onToggleSave }) {
   if (!items || items.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No saved captions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold mb-6">Saved Captions</h2>
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="p-4 flex gap-4">
            <img src={item.image} alt="Saved" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
            <div className="flex-grow">
               <div className="flex justify-between items-start mb-2">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.settings.style}</span>
                 <button onClick={() => onToggleSave(item)} className="text-red-500 p-1 hover:bg-red-50 rounded-md">
                   <Heart className="w-4 h-4 fill-current" />
                 </button>
               </div>
               <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.results?.primary?.text}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function QuotesFlow() {
  const [topic, setTopic] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateQuotes = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    
    const prompt = `
      You are an expert copywriter for Djournal Caption Studio.
      Generate 5 highly original, thoughtful, and aesthetic quotes based on this topic: "${topic}".
      Do NOT use generic internet clichés. Make them sound modern and premium.
      Output ONLY a JSON array of strings. Example: ["Quote 1", "Quote 2"]
    `;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `API request failed (${response.status})`);
    }
    const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
         const text = data.candidates[0].content.parts[0].text;
         setQuotes(JSON.parse(text));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in">
      <div className="text-center space-y-2">
         <h2 className="text-3xl font-bold">Aesthetic Quotes</h2>
         <p className="text-gray-500">Need a quick thought instead of a full caption? Just type a mood or topic.</p>
      </div>

      <Card className="p-6">
         <div className="flex gap-2">
           <input 
             type="text" 
             value={topic}
             onChange={(e) => setTopic(e.target.value)}
             placeholder="e.g., slow mornings in the city, coffee lovers, moving on..."
             className="flex-grow p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none"
             onKeyDown={(e) => e.key === 'Enter' && handleGenerateQuotes()}
           />
           <Button onClick={handleGenerateQuotes} disabled={isGenerating || !topic.trim()}>
             {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Generate'}
           </Button>
         </div>
      </Card>

      {quotes.length > 0 && (
        <div className="space-y-4">
          {quotes.map((quote, idx) => (
             <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between group">
               <p className="text-lg text-gray-800 font-medium italic pr-8 leading-relaxed">"{quote}"</p>
               <button 
                  onClick={() => navigator.clipboard.writeText(`"${quote}"`)}
                  className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
