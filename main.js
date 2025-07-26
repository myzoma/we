const proxy = "https://pt-x64v.onrender.com";

async function fetchUsdtPairs() {
  try {
    console.log('Fetching USDT pairs...');
    const url = `${proxy}/api/binance/exchange-info`;
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Exchange info response:', data);

    if (!data.success || !data.symbols) {
      throw new Error('Invalid data structure from server');
    }

    const usdtPairs = data.symbols
      .filter(s => s.quoteAsset === "USDT" && s.status === "TRADING")
      .map(s => s.symbol);
    
    console.log('Filtered USDT pairs:', usdtPairs);
    return usdtPairs;
  } catch (error) {
    console.error('Error in fetchUsdtPairs:', error);
    // إرجاع قائمة افتراضية في حالة الخطأ
    return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
  }
}

// تحسين analyzeMarket مع إدارة حالة التحميل
async function analyzeMarket() {
  const resultsDiv = document.getElementById("analysisResults");
  const analyzeBtn = document.getElementById("analyzeButton");
  
  try {
    // عرض حالة التحميل
    resultsDiv.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>جاري تحليل السوق، الرجاء الانتظار...</p>
      </div>
    `;
    analyzeBtn.disabled = true;

    const pairs = await fetchUsdtPairs();
    console.log('Pairs to analyze:', pairs);
    
    if (!pairs || pairs.length === 0) {
      throw new Error('No trading pairs available');
    }

    const analyzer = new ElliottWaveAnalyzer();
    const analysisResults = [];

    // تحليل أول 5 أزواج فقط لتحسين الأداء
    for (const pair of pairs.slice(0, 5)) {
      try {
        const currentPrice = await fetchPrice(pair);
        const klines = generateSyntheticKlines(currentPrice);
        const analysis = analyzer.analyze(klines);
        analysis.pair = pair;
        analysis.currentPrice = currentPrice;
        analysisResults.push(analysis);
      } catch (err) {
        console.warn(`Error analyzing ${pair}:`, err);
      }
    }

    // عرض النتائج
    resultsDiv.innerHTML = '';
    if (analysisResults.length === 0) {
      resultsDiv.innerHTML = `
        <div class="error-state">
          <p>⚠️ لم نتمكن من تحليل أي أزواج تداول</p>
          <button onclick="analyzeMarket()">إعادة المحاولة</button>
        </div>
      `;
    } else {
      analysisResults.forEach(analysis => {
        if (analysis.status === "success") {
          const card = createResultCard(analysis.pair, analysis, analyzer);
          resultsDiv.appendChild(card);
        }
      });
    }
  } catch (error) {
    console.error('Error in analyzeMarket:', error);
    resultsDiv.innerHTML = `
      <div class="error-state">
        <p>❌ حدث خطأ في التحليل: ${error.message}</p>
        <button onclick="analyzeMarket()">إعادة المحاولة</button>
      </div>
    `;
  } finally {
    analyzeBtn.disabled = false;
  }
}
