import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function ResultsPage() {
  const { baselineId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  useEffect(() => {
    if (baselineId) {
      loadResults();
    }
  }, [baselineId]);

  const loadResults = async () => {
    try {
      // Get baseline data
      const { data: baseline, error: baselineError } = await supabase
        .from('product_baselines')
        .select('*')
        .eq('id', baselineId)
        .single();

      if (baselineError) throw baselineError;

      // Get pricing results
      const { data: results, error: resultsError } = await supabase
        .from('pricing_results')
        .select('*')
        .eq('baseline_id', baselineId)
        .single();

      if (resultsError) throw resultsError;

      // Get competitor data
      const { data: competitors, error: compError } = await supabase
        .from('competitor_prices')
        .select('*')
        .eq('baseline_id', baselineId);

      if (compError) throw compError;

      setData({ baseline, results, competitors });
    } catch (error) {
      console.error('Failed to load results:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pricing analysis',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshCompetitors = async () => {
    if (!baselineId) return;
    
    setIsRefreshing(true);
    
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('refresh-competitors', {
        body: { baseline_id: baselineId }
      });

      if (functionError) throw functionError;

      if (functionData.success) {
        setLastRefreshed(functionData.refreshed_at);
        
        toast({
          title: 'Success',
          description: 'Competitor prices refreshed successfully!',
        });
        
        // Reload page data
        await loadResults();
      } else {
        throw new Error('Failed to refresh competitor prices');
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh competitor data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    const { baseline, results} = data;

    const csvContent = `AI TRUEST Pricing Analysis Report
Generated: ${new Date().toLocaleString()}

PRODUCT INFORMATION
Product Name,${baseline.product_name}
Category,${baseline.category}
Currency,${baseline.currency}

PRICING RECOMMENDATION
Current Price,${baseline.current_price}
Optimal Price,${results.optimal_price}
Suggested Price,${results.suggested_price}
Price Change,${(((results.suggested_price - baseline.current_price) / baseline.current_price) * 100).toFixed(2)}%

PROFIT ANALYSIS
Current Monthly Profit,${(baseline.current_price - baseline.cost_per_unit) * baseline.current_quantity}
Expected Monthly Profit,${results.expected_monthly_profit || 0}
Profit Increase,${results.profit_increase_amount || 0}
Profit Increase %,${results.profit_increase_percent || 0}%

ELASTICITY CALCULATION
Base Elasticity,${results.base_elasticity}
SAMA Inflation Rate,${(results.inflation_rate * 100).toFixed(2)}%
Inflation Adjustment,${results.inflation_adjustment}
Competitor Factor,${results.competitor_factor}
Calibrated Elasticity,${results.calibrated_elasticity}

MARKET POSITIONING
Market Average,${results.market_average || 'N/A'}
Market Lowest,${results.market_lowest || 'N/A'}
Market Highest,${results.market_highest || 'N/A'}
Position vs Market,${results.position_vs_market ? results.position_vs_market.toFixed(2) + '%' : 'N/A'}
`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI-TRUEST-${baseline.product_name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Report exported successfully',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <p className="text-lg">Loading results...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-lg mb-4">No results found</p>
          <Button onClick={() => navigate('/')}>Return to Upload</Button>
        </Card>
      </div>
    );
  }

  const { baseline, results, competitors } = data;
  const priceChange = ((results.suggested_price - baseline.current_price) / baseline.current_price) * 100;
  const isPriceIncrease = priceChange > 0;

  return (
    <div className="min-h-screen bg-gradient-hero p-4 md:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="mb-6 hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Upload New Product
          </Button>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
                AI TRUEST™ Pricing Analysis
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-2xl font-bold text-foreground">{baseline.product_name}</p>
                <Badge variant="secondary" className="px-4 py-1 text-base">{baseline.category}</Badge>
                <Badge variant="outline" className="px-4 py-1 text-base">{baseline.currency}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Results Card */}
        <Card className="p-6 md:p-10 mb-8 shadow-elegant hover:shadow-glow transition-all animate-scale-in backdrop-blur-sm bg-white/95">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-foreground">
            <div className="p-3 bg-primary rounded-xl shadow-md">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            Pricing Recommendation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Current Price:</span>
                <span className="text-2xl font-bold">
                  {baseline.currency} {baseline.current_price.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Optimal Price:</span>
                <span className="text-2xl font-bold text-primary">
                  {baseline.currency} {results.optimal_price.toFixed(2)} ⭐
                </span>
              </div>
              
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Suggested Price:</span>
                <span className="text-2xl font-bold">
                  {baseline.currency} {results.suggested_price.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Price Change:</span>
                <div className="flex items-center gap-2">
                  {isPriceIncrease ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                  <span className={`text-xl font-bold ${isPriceIncrease ? 'text-success' : 'text-destructive'}`}>
                    {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Current Monthly Profit:</span>
                <span className="text-lg font-semibold">
                  {baseline.currency} {((baseline.current_price - baseline.cost_per_unit) * baseline.current_quantity).toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Expected Monthly Profit:</span>
                <span className="text-lg font-semibold text-success">
                  {baseline.currency} {results.expected_monthly_profit?.toFixed(2) || '0.00'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Profit Increase:</span>
                <span className="text-xl font-bold text-success">
                  +{baseline.currency} {results.profit_increase_amount?.toFixed(2) || '0.00'} 
                  <span className="text-sm ml-1">
                    (+{results.profit_increase_percent?.toFixed(1) || '0.0'}%)
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Warning if present */}
          {results.has_warning && (
            <Alert className="bg-warning/10 border-warning">
              <AlertDescription className="text-warning-foreground">
                <strong>⚠️ Note:</strong> {results.warning_message}
              </AlertDescription>
            </Alert>
          )}
        </Card>

        {/* Elasticity Details */}
        <Card className="p-6 md:p-10 mb-8 shadow-elegant hover:shadow-glow transition-all animate-scale-in backdrop-blur-sm bg-white/95">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-foreground">
            <div className="p-3 bg-secondary rounded-xl shadow-md">
              <span className="text-2xl">📊</span>
            </div>
            Elasticity Calculation
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
              <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">Base Elasticity</p>
              <p className="text-3xl font-bold text-foreground">{results.base_elasticity.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">({baseline.category})</p>
            </div>
            
            <div className="p-6 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
              <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {baseline.currency === 'SAR' ? 'SAMA' : 'US Federal'} Inflation
              </p>
              <p className="text-3xl font-bold text-warning">{(results.inflation_rate * 100).toFixed(2)}%</p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                {baseline.currency === 'SAR' ? '🇸🇦 Saudi Arabia' : '🇺🇸 United States'}
              </p>
            </div>
            
            <div className="p-6 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
              <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">Inflation Adjustment</p>
              <p className="text-3xl font-bold text-foreground">×{results.inflation_adjustment.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">Price modifier</p>
            </div>
            
            <div className="p-6 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
              <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">Competitor Factor</p>
              <p className="text-3xl font-bold text-accent">×{results.competitor_factor.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                {results.competitor_factor > 1 ? '📈 Below market avg' : results.competitor_factor < 1 ? '📉 Above market avg' : '➡️ At market avg'}
              </p>
            </div>
            
            <div className="p-6 bg-primary/10 rounded-xl border-2 border-primary shadow-lg md:col-span-2 hover:shadow-glow transition-all">
              <p className="text-sm font-bold text-primary mb-2 uppercase tracking-wide">Final Calibrated Elasticity</p>
              <p className="text-4xl font-bold text-primary mb-2">{results.calibrated_elasticity.toFixed(3)}</p>
              <p className="text-base font-semibold text-primary">
                {Math.abs(results.calibrated_elasticity) > 1 ? '🎯 Elastic demand' : '🎯 Inelastic demand'}
              </p>
            </div>
          </div>

          <div className="mt-8 p-6 bg-gradient-card rounded-xl border-2 border-primary/20 shadow-lg">
            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <span className="text-2xl">💡</span>
              </div>
              <div>
                <p className="font-bold text-lg text-primary mb-2">Interpretation</p>
                <p className="text-foreground leading-relaxed font-medium">
                  {Math.abs(results.calibrated_elasticity) > 1 
                    ? 'Customers are price-sensitive. Price changes will significantly affect sales volume. Consider gradual price adjustments.'
                    : 'Customers are less price-sensitive. You have more pricing flexibility and can implement price increases with minimal impact on volume.'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Competitor Intelligence */}
        {competitors && competitors.length > 0 && (
          <Card className="p-6 md:p-10 mb-8 shadow-elegant hover:shadow-glow transition-all animate-scale-in backdrop-blur-sm bg-white/95">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-foreground">
              <div className="p-3 bg-accent rounded-xl shadow-md">
                <span className="text-2xl">🛒</span>
              </div>
              Competitive Intelligence
            </h2>
            
            <div className="space-y-5">
              {competitors.map((comp: any) => (
                <div key={comp.id} className="p-6 border-2 rounded-xl bg-gradient-card hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-xl uppercase text-foreground">{comp.marketplace}</h3>
                      {comp.fetch_status === 'success' ? (
                        <Badge variant="default" className="px-3 py-1">✓ Found {comp.products_found} products</Badge>
                      ) : comp.fetch_status === 'no_data' ? (
                        <Badge variant="secondary" className="px-3 py-1">No data available</Badge>
                      ) : (
                        <Badge variant="destructive" className="px-3 py-1">Failed to fetch</Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      🕒 Updated {new Date(comp.last_updated).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {comp.fetch_status === 'success' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white/50 rounded-lg border border-success/20">
                        <span className="text-sm font-medium text-muted-foreground block mb-1">Lowest Price</span>
                        <span className="text-2xl font-bold text-success">{comp.currency} {comp.lowest_price?.toFixed(2)}</span>
                      </div>
                      <div className="p-4 bg-white/50 rounded-lg border border-primary/20">
                        <span className="text-sm font-medium text-muted-foreground block mb-1">Average Price</span>
                        <span className="text-2xl font-bold text-primary">{comp.currency} {comp.average_price?.toFixed(2)}</span>
                      </div>
                      <div className="p-4 bg-white/50 rounded-lg border border-destructive/20">
                        <span className="text-sm font-medium text-muted-foreground block mb-1">Highest Price</span>
                        <span className="text-2xl font-bold text-destructive">{comp.currency} {comp.highest_price?.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Market Positioning */}
        {results.market_average && (
          <Card className="p-6 md:p-10 mb-8 shadow-elegant hover:shadow-glow transition-all animate-scale-in backdrop-blur-sm bg-white/95">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3 text-foreground">
              <div className="p-3 bg-success rounded-xl shadow-md">
                <span className="text-2xl">📍</span>
              </div>
              Market Positioning
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-5 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Market Average</span>
                    <span className="text-2xl font-bold text-foreground">{baseline.currency} {results.market_average.toFixed(2)}</span>
                  </div>
                </div>
                <div className="p-5 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Market Range</span>
                    <span className="text-xl font-bold text-foreground">
                      {baseline.currency} {results.market_lowest.toFixed(2)} - {results.market_highest.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="p-5 bg-primary/10 rounded-xl border-2 border-primary shadow-md">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-primary">Your Suggested Price</span>
                    <span className="text-2xl font-bold text-primary">
                      {baseline.currency} {results.suggested_price.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="p-5 bg-gradient-card rounded-xl border border-primary/10 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Position vs Market</span>
                    <span className={`text-2xl font-bold ${results.position_vs_market < 0 ? 'text-success' : 'text-destructive'}`}>
                      {results.position_vs_market > 0 ? '+' : ''}{results.position_vs_market?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="p-6 bg-gradient-card rounded-xl border-2 border-success/30 shadow-lg flex items-start gap-3 flex-1">
                  <div className="p-2 bg-success/10 rounded-lg h-fit">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-success mb-2">Competitive Position</p>
                    <p className="text-foreground leading-relaxed font-medium">
                      Your price is {results.position_vs_market < 0 ? 'competitively positioned below' : 'positioned above'} market average
                      {results.position_vs_market < 0 ? ', giving you a competitive advantage and potential for higher market share.' : ', targeting premium positioning with focus on quality and brand value.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-10 animate-slide-up">
          <Button size="lg" className="flex-1 sm:flex-none shadow-lg hover:shadow-glow transition-all text-lg px-8 py-6">
            ✨ Apply Suggested Price
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="flex-1 sm:flex-none shadow-md hover:shadow-lg transition-all text-lg px-8 py-6"
            onClick={handleRefreshCompetitors}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Competitor Data'}
          </Button>
          <Button 
            size="lg" 
            variant="secondary" 
            className="flex-1 sm:flex-none shadow-md hover:shadow-lg transition-all text-lg px-8 py-6"
            onClick={exportToCSV}
          >
            <Download className="w-5 h-5 mr-2" />
            Download Report
          </Button>
        </div>

        {/* Footer */}
        <footer className="text-center py-10 border-t border-border/50 mt-12">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            © 2025 AI TRUEST™ Saudi Arabia. All Rights Reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>📩 <a href="mailto:info@paybacksa.com" className="hover:text-primary hover:underline transition-colors font-medium">info@paybacksa.com</a></span>
            <span className="text-border">•</span>
            <span>📍 Riyadh, Saudi Arabia</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
