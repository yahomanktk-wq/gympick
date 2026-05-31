import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL    = 'gympick.official@gmail.com';

serve(async (req: Request) => {
  try {
    const body = await req.json();

    // Supabase Database Webhook payload 구조
    const record = body?.record;
    if (!record) {
      return new Response(JSON.stringify({ error: 'No record found' }), { status: 400 });
    }

    const gymName       = record.gym_name       ?? '(헬스장명 없음)';
    const applicantName = record.applicant_name  ?? '(이름 없음)';
    const phone         = record.phone           ?? '(전화번호 없음)';
    const message       = record.message         ?? '(메시지 없음)';
    const createdAt     = record.created_at      ?? '';
    const userId        = record.user_id         ?? '';

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #C6FF00; background: #000; padding: 16px; border-radius: 8px;">
          🏋️ GymPick 매니저 신청 접수
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">헬스장명</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${gymName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">신청자</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${applicantName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">전화번호</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">메시지</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${message}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">유저 ID</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${userId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">신청 일시</td>
            <td style="padding: 10px;">${new Date(createdAt).toLocaleString('ko-KR')}</td>
          </tr>
        </table>
        <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; color: #666;">
            Supabase 대시보드에서 manager_requests 테이블을 확인하고 승인/거절 처리해주세요.
          </p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'GymPick <onboarding@resend.dev>',
        to:      [ADMIN_EMAIL],
        subject: `[GymPick] 매니저 신청 접수 - ${gymName} / ${applicantName}`,
        html:    emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, data }), { status: 200 });

  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
