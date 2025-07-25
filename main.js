// ملف analyzer.js لتحليل كامل سوق USDT تلقائيًا باستخدام Cloudflare Worker

const proxy = "https://rapid-paper-fd13.mezajiat.workers.dev/";

// جلب كل أزواج USDT
async function getUsdtPairs() {
  const url = proxy + "api/v3/exchangeInfo";  // ✅ لازم تبدأ بـ /api/v3
  const res = await fetch(url);
  const data = await res.json();
  return data.symbols
    .filter(s => s.quoteAsset === "USDT" && s.status === "TRADING")
    .map(s => s.symbol);
}


// جلب سعر عملة واحدة
async function fetchPrice(symbol) {
  const url = `${proxy}api/v3/ticker/price?symbol=${symbol}`;
  const res = await fetch(url);
  const data = await res.json();
  return parseFloat(data.price);
}

// توليد بيانات شموع صناعية
function generateSyntheticKlines(currentPrice) {
  const klineData = [];
  const now = Date.now();
  const hour = 3600000;
  const volatility = currentPrice * 0.02;

  for (let i = 99; i >= 0; i--) {
    const timestamp = now - i * hour;
    const offset = volatility * (Math.sin(i / 10) + Math.random());
    const close = currentPrice - offset;
    const open = close * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = currentPrice * (Math.random() * 100 + 10);
    klineData.push([timestamp, open, high, low, close, volume]);
  }
  return klineData;
}
async function fetchUsdtPairs() {
  const url = proxy + "api/v3/exchangeInfo";
  const res = await fetch(url);
  const data = await res.json();
  return data.symbols
    .filter(s => s.quoteAsset === "USDT" && s.status === "TRADING")
    .map(s => s.symbol);
}

// تحليل السوق الكامل
async function analyzeMarket() {
  const resultsDiv = document.getElementById("analysisResults");
  resultsDiv.innerHTML = "<p class='loading'>جاري جلب البيانات وتحليل السوق...</p>";

  const pairs = await fetchUsdtPairs();
  const analyzer = new ElliottWaveAnalyzer();

  const tasks = pairs.map(async (pair) => {
    try {
      const currentPrice = await fetchPrice(pair);
      const klines = generateSyntheticKlines(currentPrice);
      const analysis = analyzer.analyze(klines);
      analysis.currentPrice = currentPrice;

      if (analysis.status === "success") {
        const card = createResultCard(pair, analysis, analyzer);
        resultsDiv.appendChild(card);
      }
    } catch (err) {
      console.warn(`خطأ في ${pair}:`, err.message);
    }
  });

  await Promise.all(tasks);

  if (!resultsDiv.hasChildNodes()) {
    resultsDiv.innerHTML = "<p class='error'>لم يتم العثور على نتائج صالحة.</p>";
  }
}

// توليد بطاقة توصية
function createResultCard(pair, analysis, analyzer) {
  const card = document.createElement("div");
  card.className = "currency-card";

  card.innerHTML = `
    <h3>${pair} (${analyzer.translateTrend(analysis.trend)})</h3>
    <p><strong>السعر الحالي:</strong> ${analysis.currentPrice.toFixed(2)} USDT</p>
    <p><strong>ملخص:</strong> ${analysis.summary}</p>
  `;

  if (analysis.currentWaveAnalysis) {
    card.innerHTML += `
      <div class="pattern">
        <h4>تحليل الموجة الحالية</h4>
        <p><strong>نوع الموجة:</strong> ${analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave)}</p>
        <p><strong>الهدف المتوقع:</strong> ${analysis.currentWaveAnalysis.expectedTarget?.toFixed(2) || '-'} USDT</p>
        <p><strong>وقف الخسارة:</strong> ${analysis.currentWaveAnalysis.stopLoss?.toFixed(2) || '-'} USDT</p>
        <p><strong>الثقة:</strong> ${analysis.currentWaveAnalysis.confidence.toFixed(1)}%</p>
      </div>
    `;
  }

  return card;
}

// ربط الزر
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeButton")?.addEventListener("click", analyzeMarket);
});
