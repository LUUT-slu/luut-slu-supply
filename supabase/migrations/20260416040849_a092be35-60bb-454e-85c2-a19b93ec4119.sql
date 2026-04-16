
-- Update the grant_welcome_discount function to give EC$10 instead of EC$5
CREATE OR REPLACE FUNCTION public.grant_welcome_discount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.customer_discounts (user_id, discount_type, discount_amount, currency_code)
  VALUES (NEW.id, 'welcome', 10.00, 'XCD')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;
