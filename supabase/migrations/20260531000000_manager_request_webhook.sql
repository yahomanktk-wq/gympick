-- pg_net extension 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Webhook trigger 함수 생성
CREATE OR REPLACE FUNCTION notify_manager_request_webhook()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://okrouzqqvfioodfieljv.supabase.co/functions/v1/notify-manager-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcm91enFxdmZpb29kZmllbGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MjI2NDEsImV4cCI6MjA2MDE5ODY0MX0.sCGsAnAXHaJJMYfGCMV3Mn3FRNfCcVHMqpMV1BGKLBU'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 생성
DROP TRIGGER IF EXISTS on_manager_request_insert ON public.manager_requests;
CREATE TRIGGER on_manager_request_insert
  AFTER INSERT ON public.manager_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_manager_request_webhook();
