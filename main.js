document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyzeButton');
    const resultsDiv = document.getElementById('analysisResults');

    if (!analyzeButton || !resultsDiv) {
        console.error('عناصر الواجهة غير موجودة: تحقق من وجود analyzeButton وanalysisResults');
        resultsDiv.innerHTML = '<p class="error">خطأ في تحميل الواجهة</p>';
        return;
    }

    analyzeButton.addEventListener('click', async () => {
        resultsDiv.innerHTML = '<p class="loading">جاري جلب البيانات وتحليل السوق...</p>';

        try {
            // Check if ElliottWaveAnalyzer is defined
            if (typeof ElliottWaveAnalyzer === 'undefined') {
                resultsDiv.innerHTML = '<p class="error">خطأ: ملف elliottWaveAnalyzer.js غير محمل أو يحتوي على أخطاء. تأكد من وجود الملف وصحته.</p>';
                console.error('ElliottWaveAnalyzer غير معرف. تحقق من ملف elliottWaveAnalyzer.js');
                return;
            }

            // Attempt to fetch K-line data from Binance API (BTC/USDT, 1h timeframe, last 100 candles)
            let klineData;
            try {
                const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10 seconds timeout
                });

                if (!response.ok) {
                    throw new Error(`فشل جلب البيانات من Binance: ${response.status}`);
                }
                klineData = await response.json();
            } catch (apiError) {
                console.warn('فشل جلب البيانات من Binance:', apiError.message);
                resultsDiv.innerHTML = '<p class="error">فشل في جلب بيانات السوق من Binance، جاري استخدام بيانات احتياطية...</p>';

                // Fallback to sample data
                klineData = [
                    [1697059200000, 26800, 26950, 26700, 26850, 1000],
                    [1697062800000, 26850, 27000, 26750, 26900, 1200],
                    [1697066400000, 26900, 27100, 26800, 27050, 1500],
                    [1697070000000, 27050, 27200, 26950, 27150, 1300],
                    ...Array(96).fill().map((_, i) => [
                        1697073600000 + i * 3600000,
                        27150 + Math.random() * 100,
                        27200 + Math.random() * 150,
                        27100 + Math.random() * 50,
                        27150 + Math.random() * 100,
                        1000 + Math.random() * 500
                    ])
                ];
            }

            if (!Array.isArray(klineData) || klineData.length < 20) {
                resultsDiv.innerHTML = '<p class="error">البيانات غير كافية للتحليل (مطلوب 20 شمعة على الأقل)</p>';
                return;
            }

            // Initialize ElliottWaveAnalyzer
            const analyzer = new ElliottWaveAnalyzer();
            const analysis = analyzer.analyze(klineData);

            // Clear previous results
            resultsDiv.innerHTML = '';

            // Display results based on analysis status
            if (analysis.status !== 'success') {
                resultsDiv.innerHTML = `<p class="error">${analysis.message || 'خطأ في التحليل'}</p>`;
                return;
            }

            // Display general analysis summary
            resultsDiv.innerHTML += `<h3>ملخص التحليل</h3>`;
            resultsDiv.innerHTML += `<p><strong>الحالة:</strong> ناجح</p>`;
            resultsDiv.innerHTML += `<p><strong>السعر الحالي:</strong> ${analysis.currentPrice.toFixed(2)} USDT</p>`;
            resultsDiv.innerHTML += `<p><strong>الاتجاه العام:</strong> ${analyzer.translateTrend(analysis.trend)}</p>`;
            resultsDiv.innerHTML += `<p><strong>ملخص:</strong> ${analysis.summary}</p>`;

            // Display current wave analysis if available
            if (analysis.currentWaveAnalysis) {
                resultsDiv.innerHTML += `<h3>تحليل الموجة الحالية</h3>`;
                resultsDiv.innerHTML += `<p><strong>نوع الموجة:</strong> ${analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave)}</p>`;
                if (analysis.currentWaveAnalysis.expectedTarget) {
                    resultsDiv.innerHTML += `<p><strong>الهدف المتوقع:</strong> ${analysis.currentWaveAnalysis.expectedTarget.toFixed(2)} USDT</p>`;
                }
                if (analysis.currentWaveAnalysis.stopLoss) {
                    resultsDiv.innerHTML += `<p><strong>وقف الخسارة:</strong> ${analysis.currentWaveAnalysis.stopLoss.toFixed(2)} USDT</p>`;
                }
                resultsDiv.innerHTML += `<p><strong>مستوى الثقة:</strong> ${analysis.currentWaveAnalysis.confidence.toFixed(1)}%</p>`;
                resultsDiv.innerHTML += `<p><strong>الإطار الزمني:</strong> ${analysis.currentWaveAnalysis.timeframe}</p>`;
                if (analysis.currentWaveAnalysis.riskReward) {
                    resultsDiv.innerHTML += `<p><strong>نسبة المخاطرة/العائد:</strong> ${analysis.currentWaveAnalysis.riskReward}</p>`;
                }
            }

            // Display detected patterns
            if (analysis.patterns.length > 0) {
                resultsDiv.innerHTML += `<h3>الأنماط المكتشفة (${analysis.patterns.length})</h3>`;
                analysis.patterns.slice(0, 3).forEach((pattern, index) => {
                    const patternDiv = document.createElement('div');
                    patternDiv.className = 'pattern';
                    const percentage = pattern.waves && pattern.waves[0] && pattern.waves[0].percentage ? pattern.waves[0].percentage.toFixed(2) : 'غير متوفر';
                    patternDiv.innerHTML = `
                        <h3>نمط ${index + 1}: ${pattern.type === 'motive' ? 'دافع' : 'تصحيحي'} (${pattern.direction === 'bullish' ? 'صاعد' : 'هابط'})</h3>
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
                    `;
                    resultsDiv.appendChild(patternDiv);
                });
            } else {
                resultsDiv.innerHTML += `<p>لا توجد أنماط مكتشفة</p>`;
            }

            // Display dynamic levels
            resultsDiv.innerHTML += `<h3>مستويات الدعم والمقاومة</h3>`;
            resultsDiv.innerHTML += `<p><strong>الدعم:</strong> ${analysis.dynamicLevels.support.length > 0 ? analysis.dynamicLevels.support.map(level => level.toFixed(2)).join(', ') : 'غير متوفر'} USDT</p>`;
            resultsDiv.innerHTML += `<p><strong>المقاومة:</strong> ${analysis.dynamicLevels.resistance.length > 0 ? analysis.dynamicLevels.resistance.map(level => level.toFixed(2)).join(', ') : 'غير متوفر'} USDT</p>`;
            resultsDiv.innerHTML += `<p><strong>الأهداف:</strong> ${analysis.dynamicLevels.targets.length > 0 ? analysis.dynamicLevels.targets.map(target => target.toFixed(2)).join(', ') : 'غير متوفر'} USDT</p>`;

            // Display recommendations
            if (analysis.recommendations.length > 0) {
                resultsDiv.innerHTML += `<h3>التوصيات</h3>`;
                analysis.recommendations.forEach((rec, index) => {
                    const recDiv = document.createElement('div');
                    recDiv.className = 'pattern';
                    recDiv.innerHTML = `
                        <h3>توصية ${index + 1}</h3>
                        <p><strong>النوع:</strong> ${rec.type === 'buy' ? 'شراء' : rec.type === 'sell' ? 'بيع' : rec.type === 'wait' ? 'انتظار' : 'حذر'}</p>
                        <p><strong>الرسالة:</strong> ${rec.message}</p>
                        <p><strong>مستوى الثقة:</strong> ${rec.confidence ? rec.confidence.toFixed(1) : 0}%</p>
                        ${rec.entry ? `<p><strong>نقطة الدخول:</strong> ${rec.entry.toFixed(2)} USDT</p>` : ''}
                        ${rec.targets ? `<p><strong>الأهداف:</strong> ${rec.targets.map(t => t.toFixed(2)).join(', ') + ' USDT'}</p>` : ''}
                        ${rec.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${rec.stopLoss.toFixed(2)} USDT</p>` : ''}
                        ${rec.expectedCompletion ? `<p><strong>التكملة المتوقعة:</strong> ${rec.expectedCompletion.toFixed(2)} USDT</p>` : ''}
                    `;
                    resultsDiv.appendChild(recDiv);
                });
            } else {
                resultsDiv.innerHTML += `<p>لا توجد توصيات حاليًا</p>`;
            }

            // Display nested patterns if available
            if (analysis.nestedPatterns.length > 0) {
                resultsDiv.innerHTML += `<h3>الأنماط المتداخلة (${analysis.nestedPatterns.length})</h3>`;
                analysis.nestedPatterns.slice(0, 3).forEach((nested, index) => {
                    const nestedDiv = document.createElement('div');
                    nestedDiv.className = 'pattern';
                    nestedDiv.innerHTML = `
                        <h3>نمط متداخل ${index + 1}</h3>
                        <p><strong>الاتجاه:</strong> ${nested.direction === 'up' ? 'صاعد' : 'هابط'}</p>
                        <p><strong>الطول:</strong> ${nested.length.toFixed(2)} USDT</p>
                        <p><strong>نسبة التغيير:</strong> ${nested.percentage.toFixed(2)}%</p>
                        <p><strong>الإطار الزمني:</strong> ${(nested.timeframe / (1000 * 60 * 60)).toFixed(2)} ساعة</p>
                    `;
                    resultsDiv.appendChild(nestedDiv);
                });
            } else {
                resultsDiv.innerHTML += `<p>لا توجد أنماط متداخلة</p>`;
            }

        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">خطأ في تحليل السوق: ${error.message}</p>`;
            console.error('خطأ:', error);
        }
    });
});