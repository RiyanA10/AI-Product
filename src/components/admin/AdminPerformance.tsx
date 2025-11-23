import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatPrice } from '@/lib/utils';
import { TrendingUp, Target, AlertCircle } from 'lucide-react';

interface PerformanceMetric {
  id: string;
  product_name: string;
  suggested_price: number;
  applied_price: number | null;
  predicted_sales: number;
  actual_sales: number | null;
  sales_accuracy_score: number | null;
  created_at: string;
  currency: string;
}

export default function AdminPerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchPerformanceMetrics();
  }, []);
  
  const fetchPerformanceMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_performance')
        .select(`
          id,
          suggested_price,
          applied_price,
          predicted_sales,
          actual_sales,
          sales_accuracy_score,
          created_at,
          baseline_id,
          product_baselines!inner(product_name, currency)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const formatted = data?.map((d: any) => ({
        id: d.id,
        product_name: d.product_baselines.product_name,
        currency: d.product_baselines.currency,
        suggested_price: d.suggested_price,
        applied_price: d.applied_price,
        predicted_sales: d.predicted_sales,
        actual_sales: d.actual_sales,
        sales_accuracy_score: d.sales_accuracy_score,
        created_at: d.created_at
      })) || [];
      
      setMetrics(formatted);
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const calculateOverallAccuracy = () => {
    const withActuals = metrics.filter(m => m.actual_sales && m.sales_accuracy_score);
    if (withActuals.length === 0) return null;
    
    const avgAccuracy = withActuals.reduce((sum, m) => sum + (m.sales_accuracy_score || 0), 0) / withActuals.length;
    return (1 - avgAccuracy) * 100;
  };
  
  const overallAccuracy = calculateOverallAccuracy();
  
  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading performance data...</p>;
  }
  
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Algorithm Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Total Predictions</p>
              <p className="text-3xl font-bold text-primary">{formatNumber(metrics.length, 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Pricing recommendations made</p>
            </div>
            <div className="p-4 bg-success/5 rounded-lg border border-success/20">
              <p className="text-sm text-muted-foreground mb-1">With Actual Data</p>
              <p className="text-3xl font-bold text-success">
                {formatNumber(metrics.filter(m => m.actual_sales).length, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">User-reported outcomes</p>
            </div>
            <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
              <p className="text-sm text-muted-foreground mb-1">Average Accuracy</p>
              <p className="text-3xl font-bold text-foreground">
                {overallAccuracy ? `${overallAccuracy.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Prediction accuracy score</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Prediction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No performance data available yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Data will appear as products are analyzed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-semibold">Product</th>
                    <th className="text-right p-3 font-semibold">Suggested Price</th>
                    <th className="text-right p-3 font-semibold">Predicted Sales</th>
                    <th className="text-right p-3 font-semibold">Actual Sales</th>
                    <th className="text-right p-3 font-semibold">Accuracy</th>
                    <th className="text-left p-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(metric => (
                    <tr key={metric.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 max-w-xs truncate">{metric.product_name}</td>
                      <td className="text-right p-3 font-medium">
                        {formatPrice(metric.suggested_price, metric.currency)}
                      </td>
                      <td className="text-right p-3">{formatNumber(metric.predicted_sales, 0)}</td>
                      <td className="text-right p-3">
                        {metric.actual_sales ? formatNumber(metric.actual_sales, 0) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-right p-3">
                        {metric.sales_accuracy_score ? (
                          <Badge 
                            variant={metric.sales_accuracy_score < 0.2 ? 'default' : 'destructive'}
                            className="font-semibold"
                          >
                            {((1 - metric.sales_accuracy_score) * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(metric.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}