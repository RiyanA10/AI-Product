import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function ProcessingPage() {
  const { baselineId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState({
    upload: 'completed',
    inflation: 'processing',
    competitors: 'pending',
    calculation: 'pending',
  });

  useEffect(() => {
    if (!baselineId) {
      navigate('/');
      return;
    }

    // Start processing automatically
    startProcessing();

    // Poll for status updates
    const interval = setInterval(checkProcessingStatus, 2000);

    return () => clearInterval(interval);
  }, [baselineId]);

  const startProcessing = async () => {
    try {
      // Trigger the processing edge function
      const { error } = await supabase.functions.invoke('process-pricing', {
        body: { baseline_id: baselineId }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to start processing:', error);
      toast({
        title: 'Error',
        description: 'Failed to start pricing analysis',
        variant: 'destructive',
      });
    }
  };

  const checkProcessingStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('processing_status')
        .select('*')
        .eq('baseline_id', baselineId)
        .single();

      if (error) throw error;

      if (data?.status === 'completed') {
        navigate(`/results/${baselineId}`);
      } else if (data?.status === 'failed') {
        toast({
          title: 'Processing Failed',
          description: data.error_message || 'An error occurred during processing',
          variant: 'destructive',
        });
        navigate('/');
      }

      // Update UI status based on current_step
      const step = data?.current_step || '';
      setStatus({
        upload: 'completed',
        inflation: step.includes('inflation') || step.includes('competitor') || step.includes('calculation') ? 'completed' : 'processing',
        competitors: step.includes('competitor') || step.includes('calculation') ? 'processing' : 'pending',
        calculation: step.includes('calculation') ? 'processing' : 'pending',
      });

    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const getStatusIcon = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 shadow-elegant">
        <div className="text-center mb-8">
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
          <h1 className="text-3xl font-bold mb-2">Processing Your Data</h1>
          <p className="text-muted-foreground">
            This typically takes 30-60 seconds
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            {getStatusIcon(status.upload)}
            <div className="flex-1">
              <p className="font-medium">Excel uploaded successfully</p>
              <p className="text-sm text-muted-foreground">Product data validated</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            {getStatusIcon(status.inflation)}
            <div className="flex-1">
              <p className="font-medium">Fetching SAMA inflation rate</p>
              <p className="text-sm text-muted-foreground">Retrieving latest economic data</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            {getStatusIcon(status.competitors)}
            <div className="flex-1">
              <p className="font-medium">Searching competitor prices</p>
              <p className="text-sm text-muted-foreground">
                Amazon, Noon, Extra, Jarir...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            {getStatusIcon(status.calculation)}
            <div className="flex-1">
              <p className="font-medium">Calculating optimal price</p>
              <p className="text-sm text-muted-foreground">AI elasticity calibration in progress</p>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-primary mb-1">What's happening?</p>
              <p className="text-muted-foreground">
                Our AI is analyzing your product against real market data, calculating
                demand elasticity with SAMA inflation adjustments, and calibrating the
                optimal price to maximize your profits.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
