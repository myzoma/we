const proxy = "https://pt-x64v.onrender.com/"; // لاحظ إضافة / في النهاية

async function fetchUsdtPairs() {
  try {
    const url = proxy + "api/binance/exchange-info"; // تعديل المسار
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log("📦 Response from exchangeInfo:", data);

    if (!data.symbols) {
      throw new Error("❌ Binance API لم تُرجع بيانات رموز (symbols)، قد تكون رسالة خطأ: " + JSON.stringify(data));
    }

    return data.symbols
      .filter(s => s.quoteAsset === "USDT" && s.status === "TRADING")
      .map(s => s.symbol);
  } catch (error) {
    console.error("Error fetching USDT pairs:", error);
    throw error; // أو يمكنك إرجاع قائمة افتراضية
  }
}

async function fetchPrice(symbol) {
  try {
    const url = `${proxy}api/binance/spot-price/${symbol}`; // تعديل المسار
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    return parseFloat(data.data.price); // تعديل حسب هيكل الاستجابة
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw error;
  }
}

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

async function analyzeMarket() {
  const resultsDiv = document.getElementById("analysisResults");
  resultsDiv.innerHTML = "<p class='loading'>جاري جلب البيانات وتحليل السوق...</p>";

  try {
    const pairs = await fetchUsdtPairs();
    const analyzer = new ElliottWaveAnalyzer();

    const tasks = pairs.slice(0, 10).map(async (pair) => { // تحديد عدد الأزواج لتحسين الأداء
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

    if (resultsDiv.children.length === 1 && resultsDiv.querySelector('.loading')) {
      resultsDiv.innerHTML = "<p class='error'>لم يتم العثور على نتائج صالحة.</p>";
    }
  } catch (error) {
    console.error("Error in market analysis:", error);
    resultsDiv.innerHTML = `<p class='error'>حدث خطأ في التحليل: ${error.message}</p>`;
  }
}

// توليد بطاقة توصية (محسنة)
function createResultCard(pair, analysis, analyzer) {
  const card = document.createElement("div");
  card.className = "currency-card";

  const trendClass = analysis.trend === 'up' ? 'trend-up' : analysis.trend === 'down' ? 'trend-down' : 'trend-neutral';
  
  card.innerHTML = `
    <div class="card-header ${trendClass}">
      <h3>${pair}</h3>
      <span class="trend-indicator">${analyzer.translateTrend(analysis.trend)}</span>
    </div>
    <div class="card-body">
      <p><strong>السعر الحالي:</strong> ${analysis.currentPrice.toFixed(2)} USDT</p>
      <p><strong>ملخص:</strong> ${analysis.summary}</p>
      ${analysis.currentWaveAnalysis ? `
      <div class="pattern">
        <h4>تحليل الموجة الحالية</h4>
        <p><strong>نوع الموجة:</strong> ${analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave)}</p>
        <p><strong>الهدف المتوقع:</strong> ${analysis.currentWaveAnalysis.expectedTarget?.toFixed(2) || '-'} USDT</p>
        <p><strong>وقف الخسارة:</strong> ${analysis.currentWaveAnalysis.stopLoss?.toFixed(2) || '-'} USDT</p>
        <p><strong>الثقة:</strong> <span class="confidence">${analysis.currentWaveAnalysis.confidence.toFixed(1)}%</span></p>
      </div>
      ` : ''}
    </div>
  `;

  return card;
}

// تحسين تهيئة الصفحة
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeButton");
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", function() {
      this.disabled = true;
      analyzeMarket().finally(() => {
        this.disabled = false;
      });
    });
  }
});
