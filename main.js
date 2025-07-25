document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyzeButton');
    const resultsDiv = document.getElementById('analysisResults');

    if (!analyzeButton || !resultsDiv) {
        console.error('عناصر الواجهة غير موجودة');
        resultsDiv.innerHTML = '<p class="error">خطأ في تحميل الواجهة</p>';
        return;
    }

    analyzeButton.addEventListener('click', async () => {
        resultsDiv.innerHTML = '<p class="loading">جاري فلترة السوق وتحليل العملات...</p>';

        try {
            // Check if ElliottWaveAnalyzer is defined
            if (typeof ElliottWaveAnalyzer === 'undefined') {
                resultsDiv.innerHTML = '<p class="error">خطأ: ملف elliottWaveAnalyzer.js غير محمل أو يحتوي على أخطاء.</p>';
                console.error('ElliottWaveAnalyzer غير معرف');
                return;
            }

            // Fetch all trading pairs from Binance
            const exchangeInfo = await fetch('https://api.binance.com/api/v3/exchangeInfo', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }).then(res => res.json());

            // Filter pairs: include only USDT pairs, exclude BTC pairs
            const nonBtcPairs = exchangeInfo.symbols
                .filter(symbol => symbol.quoteAsset === 'USDT' && !symbol.baseAsset.includes('BTC') && !symbol.symbol.includes('BTC'))
                .map(symbol => symbol.symbol)
                .slice(0, 5); // Limit to 5 pairs for performance

            if (!nonBtcPairs.length) {
                resultsDiv.innerHTML = '<p class="error">لم يتم العثور على أزواج تداول غير بيتكوين.</p>';
                return;
            }

            resultsDiv.innerHTML = '';
            const analyzer = new ElliottWaveAnalyzer();

            // Analyze each pair
            for (const pair of nonBtcPairs) {
                try {
                    // Fetch K-line data for the pair
                    const klineData = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&limit=100`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    }).then(res => res.json());

                    if (!Array.isArray(klineData) || klineData.length < 20) {
                        console.warn(`بيانات غير كافية لـ ${pair}`);
                        continue;
                    }

                    // Analyze data
                    const analysis = analyzer.analyze(klineData);
                    if (analysis.status !== 'success') {
                        console.warn(`فشل تحليل ${pair}: ${analysis.message}`);
                        continue;
                    }

                    // Create currency card
                    const card = document.createElement('div');
                    card.className = 'currency-card';
                    card.innerHTML = `
                        <h3>${pair} (${analyzer.translateTrend(analysis.trend)})</h3>
                        <p><strong>السعر الحالي:</strong> ${analysis.currentPrice.toFixed(2)} USDT</p>
                        <p><strong>ملخص:</strong> ${analysis.summary}</p>
                    `;

                    // Current wave analysis
                    if (analysis.currentWaveAnalysis) {
                        card.innerHTML += `
                            <div class="pattern">
                                <h4>تحليل الموجة الحالية</h4>
                                <p><strong>نوع الموجة:</strong> ${analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave)}</p>
                                ${analysis.currentWaveAnalysis.expectedTarget ? `<p><strong>الهدف المتوقع:</strong> ${analysis.currentWaveAnalysis.expectedTarget.toFixed(2)} USDT</p>` : ''}
                                ${analysis.currentWaveAnalysis.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${analysis.currentWaveAnalysis.stopLoss.toFixed(2)} USDT</p>` : ''}
                                <p><strong>مستوى الثقة:</strong> ${analysis.currentWaveAnalysis.confidence.toFixed(1)}%</p>
                                <p><strong>الإطار الزمني:</strong> ${analysis.currentWaveAnalysis.timeframe}</p>
                            </div>
                        `;
                    }

                    // Detected patterns
                    if (analysis.patterns.length > 0) {
                        card.innerHTML += `<div class="pattern"><h4>الأنماط المكتشفة (${analysis.patterns.length})</h4>`;
                        analysis.patterns.slice(0, 2).forEach((pattern, index) => {
                            const percentage = pattern.waves && pattern.waves[0] && pattern.waves[0].percentage 
                                ? pattern.waves[0].percentage.toFixed(2) 
                                : ((pattern.points[pattern.points.length - 1][1] - pattern.points[0][1]) / pattern.points[0][1] * 100).toFixed(2);
                            card.innerHTML += `
                                <div>
                                    <h4>نمط ${index + 1}: ${pattern.type === 'motive' ? 'دافع' : 'تصحيحي'} (${pattern.direction === 'bullish' ? 'صاعد' : 'هابط'})</h4>
                                    <p><strong>مستوى الثقة:</strong> ${pattern.confidence.toFixed(1)}%</p>
                                    <p><strong>عدد النقاط:</strong> ${pattern.points.length}</p>
                                    <p><strong>نسبة التغيير:</strong> ${percentage}%</p>
                                    <p><strong>تحليل فيبوناتشي:</strong></p>
                                    <ul>
                                        ${Object.entries(pattern.fibonacciAnalysis).map(([wave, data]) => `
                                            <li>${wave}: نسبة ${data.retracement ? data.retracement.toFixed(3) : data.ratio.toFixed(3)}, مستوى فيبوناتشي ${data.fibLevel.toFixed(3)} (${data.isValid ? 'صالح' : 'غير صالح'})</li>
                                        `).join('')}
                                    </ul>
                                    <p><strong>الأهداف:</strong></p>
                                    <ul>
                                        ${Object.entries(pattern.targets)
                                            .filter(([key, value]) => typeof value === 'number' && key !== 'support' && key !== 'resistance')
                                            .map(([key, value]) => `<li>${key}: ${value.toFixed(2)} USDT</li>`).join('')}
                                    </ul>
                                    <p><strong>الدعم:</strong> ${pattern.targets.support.toFixed(2)} USDT</p>
                                    <p><strong>المقاومة:</strong> ${pattern.targets.resistance.toFixed(2)} USDT</p>
                                </div>
                            `;
                        });
                        card.innerHTML += `</div>`;
                    }

                    // Recommendations
                    if (analysis.recommendations.length > 0) {
                        card.innerHTML += `<div class="recommendation"><h4>التوصيات</h4>`;
                        analysis.recommendations.forEach((rec, index) => {
                            card.innerHTML += `
                                <div>
                                    <h4>توصية ${index + 1}</h4>
                                    <p><strong>النوع:</strong> ${rec.type === 'buy' ? 'شراء' : rec.type === 'sell' ? 'بيع' : rec.type === 'wait' ? 'انتظار' : 'حذر'}</p>
                                    <p><strong>الرسالة:</strong> ${rec.message}</p>
                                    <p><strong>مستوى الثقة:</strong> ${rec.confidence ? rec.confidence.toFixed(1) : 0}%</p>
                                    ${rec.entry ? `<p><strong>نقطة الدخول:</strong> ${rec.entry.toFixed(2)} USDT</p>` : ''}
                                    ${rec.targets ? `<p><strong>الأهداف:</strong> ${rec.targets.map(t => t.toFixed(2)).join(', ') + ' USDT'}</p>` : ''}
                                    ${rec.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${rec.stopLoss.toFixed(2)} USDT</p>` : ''}
                                </div>
                            `;
                        });
                        card.innerHTML += `</div>`;
                    }

                    // Dynamic levels fallback
                    const support = analysis.dynamicLevels.support.length > 0 
                        ? analysis.dynamicLevels.support.map(level => level.toFixed(2)).join(', ') 
                        : analysis.patterns[0]?.targets.support.toFixed(2) || 'غير متوفر';
                    const resistance = analysis.dynamicLevels.resistance.length > 0 
                        ? analysis.dynamicLevels.resistance.map(level => level.toFixed(2)).join(', ') 
                        : analysis.patterns[0]?.targets.resistance.toFixed(2) || 'غير متوفر';
                    card.innerHTML += `
                        <div class="pattern">
                            <h4>مستويات الدعم والمقاومة</h4>
                            <p><strong>الدعم:</strong> ${support} USDT</p>
                            <p><strong>المقاومة:</strong> ${resistance} USDT</p>
                        </div>
                    `;

                    resultsDiv.appendChild(card);
                } catch (pairError) {
                    console.warn(`خطأ في تحليل ${pair}: ${pairError.message}`);
                }
            }

            if (!resultsDiv.hasChildNodes()) {
                resultsDiv.innerHTML = '<p class="error">لم يتم العثور على تحليلات صالحة للعملات غير بيتكوين.</p>';
            }
        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">خطأ في تحليل السوق: ${error.message}</p>`;
            console.error('خطأ:', error);
        }
    });
});