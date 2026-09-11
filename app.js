// ===== مصنع الحكايات — app.js =====

// ---- عناصر الواجهة ----
const apiKeyInput   = document.getElementById('apiKey');
const genreSelect   = document.getElementById('genre');
const sceneCountEl  = document.getElementById('sceneCount');
const sceneCountVal = document.getElementById('sceneCountValue');
const ideaInput     = document.getElementById('idea');
const generateBtn   = document.getElementById('generateBtn');

const progressCard  = document.getElementById('progressCard');
const progressBar   = document.getElementById('progressBar');
const statusText    = document.getElementById('statusText');
const logEl         = document.getElementById('log');

const resultsCard   = document.getElementById('resultsCard');
const storyTitleEl  = document.getElementById('storyTitle');
const scenesGridEl  = document.getElementById('scenesGrid');
const downloadBtn   = document.getElementById('downloadBtn');

sceneCountEl.addEventListener('input', () => {
  sceneCountVal.textContent = sceneCountEl.value;
});

// يحتفظ بآخر حزمة تم توليدها لتحميلها لاحقًا
let lastPackage = null;

function log(msg, type = '') {
  const line = document.createElement('div');
  if (type) line.className = type;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(percent, text) {
  progressBar.style.width = percent + '%';
  if (text) statusText.textContent = text;
}

function setBusy(isBusy) {
  generateBtn.disabled = isBusy;
  generateBtn.querySelector('span:last-child').textContent =
    isBusy ? 'جارٍ الإنتاج...' : 'بدء إنتاج حزمة الموارد';
}

// ---- توليد الطلب لـ Gemini ----
function buildGeminiPrompt(genre, sceneCount, idea) {
  return `أنت كاتب سيناريو محترف متخصص في تحويل القصص الكلاسيكية والمواضيع الدرامية إلى مسلسلات ريلز قصيرة (فورمات عمودي 9:16) بأسلوب سينمائي جذاب.

النوع المطلوب: ${genre}
عدد المشاهد المطلوب بالضبط: ${sceneCount}
فكرة المسلسل من المستخدم: "${idea}"

المطلوب: قسّم الفكرة إلى ${sceneCount} مشاهد متتالية تحكي قصة متكاملة ومشوقة، ثم أعد النتيجة بصيغة JSON فقط بدون أي نص إضافي أو علامات ماركداون، وفق هذا الهيكل بالضبط:

{
  "title": "عنوان القصة بالعربية",
  "scenes": [
    {
      "scene_number": 1,
      "voiceover_ar": "نص التعليق الصوتي الكامل بالعربية الفصحى لهذا المشهد، بأسلوب حكواتي جذاب",
      "image_prompt_en": "detailed cinematic image generation prompt in English, vertical 9:16 composition, describing setting, characters, lighting, mood and art style",
      "motion_direction_ar": "توجيه حركة الكاميرا والانتقال المقترح لهذا المشهد (مثال: تكبير بطيء، حركة بانورامية، اهتزاز خفيف) لاستخدامه في أدوات مثل CapCut أو Kling AI"
    }
  ]
}

تأكد أن عدد عناصر مصفوفة scenes يساوي بالضبط ${sceneCount}، وأن الأسلوب متوافق مع نوع "${genre}".`;
}

// ---- استدعاء Gemini API ----
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.9
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`فشل استدعاء Gemini (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('لم يُرجع Gemini أي محتوى صالح.');

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('تعذّر تحليل استجابة Gemini كـ JSON صالح.');
  }

  if (!parsed.title || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('استجابة Gemini لا تحتوي على البنية المتوقعة.');
  }

  return parsed;
}

// ---- توليد صورة عبر Pollinations (مجاني، بدون مفتاح) ----
async function fetchPollinationsImage(promptEn, seed) {
  const encoded = encodeURIComponent(promptEn);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=1360&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`فشل توليد الصورة (${res.status})`);
  return await res.blob();
}

// ---- بناء ملف دليل التركيب Markdown ----
function buildAssemblyGuide(story, genre, sceneImages) {
  const lines = [];
  lines.push(`# ${story.title}`);
  lines.push('');
  lines.push(`**النوع:** ${genre}`);
  lines.push(`**عدد المشاهد:** ${story.scenes.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## السكريبت الكامل والتوجيهات');
  lines.push('');

  story.scenes.forEach((scene, i) => {
    const num = scene.scene_number || (i + 1);
    lines.push(`### المشهد ${num}`);
    lines.push('');
    lines.push(`**ملف الصورة:** \`images/scene_${num}.jpg\``);
    lines.push('');
    lines.push('**النص الصوتي (Voiceover):**');
    lines.push('');
    lines.push('> ' + (scene.voiceover_ar || '').replace(/\n/g, '\n> '));
    lines.push('');
    lines.push('**Image Prompt (English):**');
    lines.push('');
    lines.push('```');
    lines.push(scene.image_prompt_en || '');
    lines.push('```');
    lines.push('');
    lines.push('**توجيه الحركة (CapCut / Kling AI):**');
    lines.push('');
    lines.push(scene.motion_direction_ar || '');
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  lines.push('## ملاحظات التجميع العامة');
  lines.push('');
  lines.push('1. رتّب الصور في مجلد `images/` حسب رقم المشهد داخل محرر الفيديو (CapCut / Premiere / Kling AI).');
  lines.push('2. سجّل أو ولّد التعليق الصوتي لكل مشهد بأداة تحويل نص إلى كلام عربية، والتزم بترتيب النصوص أعلاه.');
  lines.push('3. طبّق توجيه الحركة المذكور لكل مشهد لإضفاء حيوية على الصورة الثابتة (Ken Burns / Parallax).');
  lines.push('4. اضبط توقيت كل مشهد وفق مدة التعليق الصوتي المقابل له.');
  lines.push('5. أضف موسيقى خلفية وانتقالات ناعمة بين المشاهد بما يتناسب مع نوع القصة.');
  lines.push('');

  return lines.join('\n');
}

// ---- عرض المعاينة في الواجهة ----
function renderPreview(story, sceneImageUrls) {
  storyTitleEl.textContent = story.title;
  scenesGridEl.innerHTML = '';

  story.scenes.forEach((scene, i) => {
    const num = scene.scene_number || (i + 1);
    const card = document.createElement('div');
    card.className = 'scene-card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'scene-img-wrap';
    const imgUrl = sceneImageUrls[i];
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = `مشهد ${num}`;
      imgWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'placeholder';
      ph.textContent = 'تعذّر توليد الصورة';
      imgWrap.appendChild(ph);
    }

    const body = document.createElement('div');
    body.className = 'scene-body';
    const numEl = document.createElement('div');
    numEl.className = 'scene-num';
    numEl.textContent = `المشهد ${num}`;
    const voiceEl = document.createElement('div');
    voiceEl.className = 'scene-voice';
    voiceEl.textContent = scene.voiceover_ar || '';

    body.appendChild(numEl);
    body.appendChild(voiceEl);
    card.appendChild(imgWrap);
    card.appendChild(body);
    scenesGridEl.appendChild(card);
  });

  resultsCard.hidden = false;
}

// ---- التدفق الرئيسي ----
async function handleGenerate() {
  const apiKey = apiKeyInput.value.trim();
  const genre = genreSelect.value;
  const sceneCount = parseInt(sceneCountEl.value, 10);
  const idea = ideaInput.value.trim();

  if (!apiKey) { alert('الرجاء إدخال مفتاح Gemini API.'); return; }
  if (!idea) { alert('الرجاء إدخال فكرة المسلسل.'); return; }

  setBusy(true);
  progressCard.hidden = false;
  resultsCard.hidden = true;
  downloadBtn.hidden = true;
  logEl.innerHTML = '';
  setProgress(5, 'جاري الاتصال بـ Gemini لتحليل الفكرة...');
  log('إرسال الفكرة إلى Gemini 2.5 Flash...');

  try {
    const prompt = buildGeminiPrompt(genre, sceneCount, idea);
    const story = await callGemini(apiKey, prompt);
    log(`تم استلام القصة: "${story.title}" (${story.scenes.length} مشاهد)`, 'ok');
    setProgress(20, 'تم تحليل القصة، جاري توليد الصور...');

    const zip = new JSZip();
    const imagesFolder = zip.folder('images');
    const sceneImageUrls = [];

    const total = story.scenes.length;
    for (let i = 0; i < total; i++) {
      const scene = story.scenes[i];
      const num = scene.scene_number || (i + 1);
      setProgress(20 + Math.round((i / total) * 65), `جاري توليد صورة المشهد ${num} من ${total}...`);
      log(`توليد صورة المشهد ${num}...`);

      try {
        const seed = Math.floor(Math.random() * 1000000);
        const blob = await fetchPollinationsImage(scene.image_prompt_en || story.title, seed);
        imagesFolder.file(`scene_${num}.jpg`, blob);
        sceneImageUrls.push(URL.createObjectURL(blob));
        log(`تم توليد صورة المشهد ${num} بنجاح.`, 'ok');
      } catch (imgErr) {
        log(`تعذّر توليد صورة المشهد ${num}: ${imgErr.message}`, 'err');
        sceneImageUrls.push(null);
      }
    }

    setProgress(88, 'جاري إنشاء دليل التركيب...');
    const guide = buildAssemblyGuide(story, genre, sceneImageUrls);
    zip.file('Assembly_Guide.md', guide);

    setProgress(95, 'جاري ضغط الملفات...');
    log('جاري إنشاء ملف ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    lastPackage = {
      blob: zipBlob,
      fileName: `${story.title.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '_') || 'حزمة_المسلسل'}.zip`
    };

    setProgress(100, 'اكتمل الإنتاج بنجاح!');
    log('تم الانتهاء من إنتاج حزمة الموارد بنجاح.', 'ok');

    renderPreview(story, sceneImageUrls);
    downloadBtn.hidden = false;

  } catch (err) {
    console.error(err);
    setProgress(0, 'حدث خطأ أثناء الإنتاج.');
    log(`خطأ: ${err.message}`, 'err');
    alert(`حدث خطأ: ${err.message}`);
  } finally {
    setBusy(false);
  }
}

function handleDownload() {
  if (!lastPackage) return;
  const url = URL.createObjectURL(lastPackage.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastPackage.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

generateBtn.addEventListener('click', handleGenerate);
downloadBtn.addEventListener('click', handleDownload);

// ---- تسجيل Service Worker لدعم PWA ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('تعذّر تسجيل Service Worker:', err);
    });
  });
}
