import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  your_product_name: string;
  competitor_product_name: string;
  marketplace: string;
  baseline_price: number;
  competitor_price: number;
  similarity_score: number;
}

interface ValidationResponse {
  decision: 'match' | 'accessory' | 'different_product';
  confidence: number;
  reasoning: string;
  cached: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ValidationRequest = await req.json();
    const { your_product_name, competitor_product_name, marketplace, baseline_price, competitor_price, similarity_score } = body;

    console.log(`Validating: "${your_product_name}" vs "${competitor_product_name}" (similarity: ${similarity_score})`);

    // Create hash for cache lookup
    const productPairHash = `${your_product_name.toLowerCase().trim()}_${competitor_product_name.toLowerCase().trim()}_${marketplace}`;

    // RULE 1: High confidence (80-100%) - Auto-match, no AI needed
    if (similarity_score >= 0.80) {
      console.log('High confidence match (≥80%), no AI needed');
      return new Response(JSON.stringify({
        decision: 'match',
        confidence: similarity_score,
        reasoning: 'High similarity score indicates strong product match',
        cached: false,
      } as ValidationResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RULE 2 & 3: Medium/Low confidence (30-79%) - Check cache first
    if (similarity_score >= 0.30) {
      // Check cache
      const { data: cachedResult, error: cacheError } = await supabase
        .from('ai_validation_cache')
        .select('*')
        .eq('product_pair_hash', productPairHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cachedResult && !cacheError) {
        console.log('Using cached AI decision');
        // Update hit count
        await supabase
          .from('ai_validation_cache')
          .update({ hit_count: cachedResult.hit_count + 1 })
          .eq('id', cachedResult.id);

        return new Response(JSON.stringify({
          decision: cachedResult.ai_decision,
          confidence: cachedResult.confidence_score,
          reasoning: cachedResult.reasoning,
          cached: true,
        } as ValidationResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // No cache, call AI
      console.log('No cache found, calling Lovable AI for validation');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const aiPrompt = `You are a product matching expert for e-commerce competitive analysis.

TASK: Determine if these two products are the SAME product, an ACCESSORY, or DIFFERENT products.

YOUR PRODUCT: "${your_product_name}"
Price: $${baseline_price}

COMPETITOR PRODUCT: "${competitor_product_name}"
Price: $${competitor_price}
Marketplace: ${marketplace}

SIMILARITY SCORE: ${(similarity_score * 100).toFixed(0)}%

RULES:
1. match - Same product model/brand (e.g., "iPhone 14 Pro" vs "Apple iPhone 14 Pro Max" = match)
2. accessory - Related accessory or replacement part (e.g., "iPhone 14" vs "iPhone 14 Case" = accessory)
3. different_product - Completely different product (e.g., "iPhone 14" vs "Samsung Galaxy S23" = different_product)

CRITICAL: Always use lowercase for decision values. Never use DIFFERENT, MATCH, ACCESSORY - use lowercase with underscore.

Consider:
- Brand names (Apple vs Samsung)
- Model numbers (iPhone 14 vs iPhone 13)
- Product type (phone vs case vs charger)
- Price reasonableness (accessories should be much cheaper)

Respond in JSON format:
{
  "decision": "match|accessory|different_product",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation (1-2 sentences)"
}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a product matching expert. Always respond with valid JSON.' },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', aiResponse.status, errorText);
        
        // Fallback to rule-based decision
        return new Response(JSON.stringify({
          decision: similarity_score > 0.50 ? 'match' : 'different_product',
          confidence: similarity_score,
          reasoning: 'AI unavailable, using rule-based decision',
          cached: false,
        } as ValidationResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices[0].message.content;
      
      // Parse JSON response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI response not in JSON format');
      }
      
      const aiResult = JSON.parse(jsonMatch[0]);

      // Cache the AI decision
      await supabase.from('ai_validation_cache').insert({
        product_pair_hash: productPairHash,
        your_product_name,
        competitor_product_name,
        marketplace,
        ai_decision: aiResult.decision,
        confidence_score: aiResult.confidence,
        reasoning: aiResult.reasoning,
        merchant_id: user.id,
      });

      console.log(`AI decision: ${aiResult.decision} (confidence: ${aiResult.confidence})`);

      return new Response(JSON.stringify({
        decision: aiResult.decision,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        cached: false,
      } as ValidationResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RULE 4: Very low confidence (<30%) - Don't reject, let refresh-competitors try other marketplaces
    console.log('Very low confidence (<30%), marking for alternative marketplace search');
    return new Response(JSON.stringify({
      decision: 'different_product',
      confidence: similarity_score,
      reasoning: 'Low confidence - should try alternative marketplaces or Google fallback',
      cached: false,
    } as ValidationResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-competitor:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});