async function generateAssets() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const genre = document.getElementById('genre').value;
  const scenesCount = document.getElementById('scenesCount').value;
  const storyIdea = document.getElementById('storyIdea').value.trim();
  const status = document.getElementById('status');
  const btn = document.getElementById('generateBtn');

  if (!apiKey || !storyIdea) {
    alert('يرجى إدخال مفتاح Gemini API وفكرة القصة!');
    return;
  }

  btn.disabled = true;
  status.innerText = "⏳ جاري توليد السكريبت بواسطة AI...";

  try {
    // 1. استدعاء Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `أنت مخرج درامي. قم بتحليل القصة: '${storyIdea}' من نوع '${genre}'. قسمها إلى ${scenesCount} مشاهد. ارجع النتيجة حصراً بـ JSON مكوّن كالتالي:
            {
              "title": "عنوان القصة",
              "scenes": [
                {
                  "scene_num": 1,
                  "narration": "النص الصوتي بالعربية",
                  "image_prompt": "English cinematic prompt for image generation, 8k, detailed, vertical 9:16 aspect ratio",
                  "motion_guide": "توجيهات حركة المشهد"
                }
              ]
            }`
          }]
        }]
      })
    });

    const resData = await response.json();
    let rawText = resData.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const scriptData = JSON.parse(rawText);

    status.innerText = "🎨 جاري جلب الصور والأصوات وتجهيز ملف ZIP...";

    const zip = new JSZip();
    const imagesFolder = zip.folder("images");
    const guideLines = [];

    guideLines.push(`# دليل تركيب مسلسل: ${scriptData.title}\n`);

    // 2. معالجة المشاهد والتمثيل
    for (const scene of scriptData.scenes) {
      const sNum = scene.scene_num;
      status.innerText = `⏳ معالجة المشهد ${sNum} من ${scriptData.scenes.length}...`;

      // أ) جلب الصورة مجاناً من Pollinations AI
      const encodedPrompt = encodeURIComponent(`${scene.image_prompt}, cinematic fantasy, vertical 9:16`);
      const imgUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true`;
      
      const imgBlob = await fetch(imgUrl).then(r => r.blob());
      imagesFolder.file(`scene_${sNum}.jpg`, imgBlob);

      // ب) إعداد السكريبت والدليل
      guideLines.push(`## المشهد ${sNum}`);
      guideLines.push(`- **الصورة:** images/scene_${sNum}.jpg`);
      guideLines.push(`- **النص الصوتي:** ${scene.narration}`);
      guideLines.push(`- **توجيه الحركة:** ${scene.motion_guide}`);
      guideLines.push(`- **البرومبت الإنجليزي:** \\`${scene.image_prompt}\\``);
      guideLines.push(`---\n`);
    }

    zip.file("Assembly_Guide.md", guideLines.join("\n"));

    // 3. ضغط وتحميل الملف
    status.innerText = "📦 جاري ضغط الملفات...";
    const zipContent = await zip.generateAsync({ type: "blob" });
    
    const downloadUrl = URL.createObjectURL(zipContent);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${scriptData.title}_Assets.zip`;
    a.click();

    status.innerText = "✅ تم إنتاج الموارد وتحميل الملف بنجاح!";
  } catch (err) {
    console.error(err);
    status.innerText = "❌ حدث خطأ أثناء التوليد، تأكد من صحة المفتاح والأوامر.";
  } finally {
    btn.disabled = false;
  }
}